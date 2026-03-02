import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET: 会社の評価期間一覧を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId } = await params

    // 全クエリを並列実行（レイテンシ削減）
    const [company, bonusSettings, evaluationPeriods] = await Promise.all([
      // 会社の給与設定を取得
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          salaryReflectionMonth: true,
          salaryReflectionDay: true,
        },
      }),
      // 賞与設定を取得
      prisma.bonusSetting.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          paymentDate: true,
        },
      }),
      // 評価期間と評価件数を1クエリで取得
      prisma.evaluationPeriod.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          periodType: true,
          startDate: true,
          endDate: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              individualEvaluations: true,
              evaluation360s: true,
            },
          },
        },
      }),
    ])

    // EmployeeEvaluationのカウントを取得（評価期間がある場合のみ）
    let countMap = new Map<string | null, number>()
    let completedCountMap = new Map<string | null, number>()
    if (evaluationPeriods.length > 0) {
      const [employeeEvalCounts, completedCounts] = await Promise.all([
        // 全体のカウント
        prisma.employeeEvaluation.groupBy({
          by: ["evaluationPeriodId"],
          where: {
            evaluationPeriodId: { in: evaluationPeriods.map((p) => p.id) },
          },
          _count: { id: true },
        }),
        // 完了のカウント
        prisma.employeeEvaluation.groupBy({
          by: ["evaluationPeriodId"],
          where: {
            evaluationPeriodId: { in: evaluationPeriods.map((p) => p.id) },
            status: "COMPLETED",
          },
          _count: { id: true },
        }),
      ])
      countMap = new Map(
        employeeEvalCounts.map((c) => [c.evaluationPeriodId, c._count.id])
      )
      completedCountMap = new Map(
        completedCounts.map((c) => [c.evaluationPeriodId, c._count.id])
      )
    }

    const periodsWithCount = evaluationPeriods.map((period) => {
      const total = countMap.get(period.id) || 0
      const completed = completedCountMap.get(period.id) || 0
      return {
        ...period,
        _count: {
          evaluations: total,
          completed: completed,
        },
      }
    })

    return NextResponse.json({
      periods: periodsWithCount,
      salarySettings: {
        reflectionMonth: company?.salaryReflectionMonth,
        reflectionDay: company?.salaryReflectionDay,
      },
      bonusSettings,
    })
  } catch (error) {
    console.error("評価期間一覧取得エラー:", error)
    return NextResponse.json(
      { error: "評価期間一覧の取得に失敗しました" },
      { status: 500 }
    )
  }
}
