import "dotenv/config"
import { PrismaClient, PeriodType, EvaluationStatus } from "../generated/prisma/client"

const prisma = new PrismaClient()

/**
 * 360度評価 集計画面テスト用シードデータ
 *
 * 使用方法:
 *   npx tsx src/prisma/seed-360-aggregation-test.ts
 *
 * 前提条件:
 *   - 基本のシード（seed.ts）が実行済みであること
 */

async function main() {
  console.log("Seeding 360 aggregation test data...")

  const companyId = "test-company-1"

  // 会社の存在確認
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })
  if (!company) {
    throw new Error("会社が見つかりません。先に seed.ts を実行してください。")
  }

  // 1. 評価期間を作成
  const now = new Date()
  const periodStartDate = new Date(now.getFullYear(), 0, 1) // 今年の1/1
  const periodEndDate = new Date(now.getFullYear(), 5, 30) // 今年の6/30

  const evaluationPeriod = await prisma.evaluationPeriod.upsert({
    where: { id: "test-period-360" },
    update: {},
    create: {
      id: "test-period-360",
      companyId,
      name: `${now.getFullYear()}年上期評価`,
      periodType: PeriodType.FIRST_HALF,
      startDate: periodStartDate,
      endDate: periodEndDate,
      status: EvaluationStatus.STARTED,
    },
  })
  console.log(`Created evaluation period: ${evaluationPeriod.name}`)

  // 2. 従業員を取得（被評価者3名、評価者用に使う）
  const employees = await prisma.employee.findMany({
    where: { companyId },
    take: 8,
    orderBy: { employeeCode: "asc" },
  })

  if (employees.length < 6) {
    throw new Error("従業員が足りません。先に seed.ts を実行してください。")
  }

  // 被評価者: 田中太郎(EMP001)、佐藤花子(EMP002)、山本健一(EMP003)
  const targetEmployees = employees.slice(0, 3)
  // 評価者プール: 残りの従業員
  const reviewerPool = employees.slice(3)

  // 3. 360度評価テンプレートのカテゴリ・項目を取得
  const templateCategories = await prisma.evaluation360TemplateCategory.findMany({
    where: {
      template: {
        companyId,
        periodId: null, // マスターテンプレート
      },
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  if (templateCategories.length === 0) {
    throw new Error("360度評価テンプレートが見つかりません。先に seed.ts を実行してください。")
  }

  console.log(`Found ${templateCategories.length} categories with items`)

  // 既存のレコードをクリア
  await prisma.evaluation360Record.deleteMany({
    where: { evaluationPeriodId: evaluationPeriod.id },
  })
  console.log("Cleared existing 360 records")

  // 4. 各被評価者に対して評価レコードを作成
  for (let targetIndex = 0; targetIndex < targetEmployees.length; targetIndex++) {
    const targetEmployee = targetEmployees[targetIndex]
    const isCompleted = targetIndex === 2 // 3人目は completed

    console.log(`\nProcessing: ${targetEmployee.lastName} ${targetEmployee.firstName}`)

    // 評価者を3名割り当て（ランダムに選択）
    const assignedReviewers = reviewerPool.slice(0, 3)

    // 4.1 Evaluation360Record を作成
    const record = await prisma.evaluation360Record.create({
      data: {
        evaluationPeriodId: evaluationPeriod.id,
        employeeId: targetEmployee.id,
        companyId,
        status: isCompleted ? "completed" : "aggregated",
        evaluationMethod: "web",
        isAnonymous: true,
        distributedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7日前
        completedAt: isCompleted ? now : null,
      },
    })
    console.log(`  Created 360 record: ${record.id} (status: ${record.status})`)

    // 4.2 EvaluationCustomItem を作成（テンプレートからコピー）
    const customItems: { id: string; maxScore: number; categoryName: string; sortOrder: number }[] = []

    for (const category of templateCategories) {
      for (const item of category.items) {
        const customItem = await prisma.evaluationCustomItem.create({
          data: {
            companyId,
            employeeId: targetEmployee.id,
            periodId: evaluationPeriod.id,
            evaluationType: "360",
            sourceTemplateItemId: item.id,
            itemName: item.content,
            maxScore: item.maxScore,
            sortOrder: item.sortOrder,
            categoryName: category.name,
            categorySortOrder: category.sortOrder,
            isCustomized: false,
            isAdded: false,
            isDeleted: false,
          },
        })
        customItems.push({
          id: customItem.id,
          maxScore: item.maxScore,
          categoryName: category.name,
          sortOrder: item.sortOrder,
        })
      }
    }
    console.log(`  Created ${customItems.length} custom items`)

    // 4.3 各評価者の Reviewer Assignment と Score を作成
    for (let reviewerIndex = 0; reviewerIndex < assignedReviewers.length; reviewerIndex++) {
      const reviewer = assignedReviewers[reviewerIndex]

      // ReviewerAssignment を作成
      const assignment = await prisma.evaluation360ReviewerAssignment.create({
        data: {
          recordId: record.id,
          reviewerId: reviewer.id,
          status: "submitted",
          submittedAt: new Date(now.getTime() - (3 - reviewerIndex) * 24 * 60 * 60 * 1000), // 異なる日に提出
          comment: generateComment(reviewer, targetEmployee, reviewerIndex),
        },
      })
      console.log(`  Created reviewer assignment: ${reviewer.lastName} ${reviewer.firstName}`)

      // 各項目のスコアを作成
      for (const customItem of customItems) {
        // maxScore が 0 の項目はスキップ（パワハラ・セクハラ等のマイナス項目）
        const score = customItem.maxScore > 0
          ? generateScore(customItem.maxScore, reviewerIndex, targetIndex)
          : null

        await prisma.evaluation360Score.create({
          data: {
            evaluationCustomItemId: customItem.id,
            reviewerAssignmentId: assignment.id,
            score,
          },
        })
      }
    }
    console.log(`  Created scores for all reviewers`)
  }

  console.log("\n360 aggregation test data seeding completed!")
  console.log("=".repeat(50))
  console.log("テスト手順:")
  console.log(`1. /companies/${companyId}/operations/${evaluationPeriod.id} にアクセス`)
  console.log("2. 360度評価セクションの「集計」タブを開く")
  console.log("3. 被評価者名をクリックして詳細モーダルを確認")
  console.log("4. 「全員を一括確定」で完了タブに移動することを確認")
  console.log("=".repeat(50))
}

// スコア生成（評価者・被評価者によってばらつきを持たせる）
function generateScore(maxScore: number, reviewerIndex: number, targetIndex: number): number {
  // 基本スコア（70%〜95%の範囲）
  const basePercentage = 0.7 + (Math.random() * 0.25)

  // 評価者による傾向（厳しめ/甘め）
  const reviewerBias = [0, 0.1, -0.05][reviewerIndex] || 0

  // 被評価者による傾向
  const targetBias = [0.05, 0, -0.05][targetIndex] || 0

  const percentage = Math.min(1, Math.max(0, basePercentage + reviewerBias + targetBias))
  const score = Math.round(maxScore * percentage * 10) / 10

  return Math.min(maxScore, Math.max(0, score))
}

// コメント生成
function generateComment(
  reviewer: { firstName: string; lastName: string },
  target: { firstName: string; lastName: string },
  reviewerIndex: number
): string {
  const comments = [
    `${target.lastName}さんは仕事に対する姿勢や熱量が非常に高いです。特にチームワークの面で周囲のメンバーを積極的にサポートしており、現場の雰囲気づくりに貢献しています。今後は後輩の育成にも力を入れていただければと思います。`,
    `業務スキルは着実に向上しています。安全意識も高く、日々の作業において細かい点まで気を配れています。コミュニケーション面では、もう少し積極的に発言できるとさらに良いと思います。`,
    `現場での判断力と実行力が優れています。困難な状況でも冷静に対応できる点は高く評価できます。改善提案も積極的に行っており、今後のさらなる成長に期待しています。`,
  ]

  return comments[reviewerIndex] || comments[0]
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
