import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const startEvaluationSchema = z.object({
  companyId: z.string().min(1),
  evaluationPeriodId: z.string().min(1).optional(),
  periodName: z.string().min(1).max(100).optional(),
  periodType: z.enum(["FIRST_HALF", "SECOND_HALF"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  // 旧形式（後方互換性）
  evaluationType: z.enum(["individual", "360"]).optional(),
  // 新形式: 各イベントごとの評価種別
  evaluationEventIds: z.array(z.string()).optional(),
  eventEvaluationTypes: z.record(z.string(), z.array(z.enum(["individual", "360"]))).optional(),
  // 期間固有テンプレート自動作成オプション
  createPeriodTemplates: z.boolean().optional(),
}).refine(
  (data) => data.evaluationPeriodId || (data.periodName && data.periodType && data.startDate && data.endDate),
  { message: "既存の評価期間IDまたは新規作成に必要な情報を指定してください" }
).refine(
  (data) => data.evaluationType || data.eventEvaluationTypes,
  { message: "評価種別を指定してください" }
)

// POST: 評価一括開始
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = startEvaluationSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { companyId, evaluationPeriodId, periodName, periodType, startDate, endDate, evaluationType, eventEvaluationTypes, createPeriodTemplates } = validationResult.data

    // 評価種別リストを構築（新形式 or 旧形式）
    type EvalType = "individual" | "360"
    let evaluationTypesToCreate: EvalType[] = []
    if (eventEvaluationTypes) {
      // 新形式: 全イベントの評価種別をフラット化（重複除去）
      const allTypes = new Set<EvalType>()
      Object.values(eventEvaluationTypes).forEach((types) => {
        types.forEach((t) => allTypes.add(t))
      })
      evaluationTypesToCreate = Array.from(allTypes)
    } else if (evaluationType) {
      // 旧形式
      evaluationTypesToCreate = [evaluationType]
    }

    // 1. 評価期間を取得 or 作成
    let period
    if (evaluationPeriodId) {
      period = await prisma.evaluationPeriod.findUnique({
        where: { id: evaluationPeriodId },
      })
      if (!period) {
        return NextResponse.json({ error: "評価期間が見つかりません" }, { status: 404 })
      }
      if (period.companyId !== companyId) {
        return NextResponse.json({ error: "この会社の評価期間ではありません" }, { status: 400 })
      }
    } else {
      const existingPeriod = await prisma.evaluationPeriod.findFirst({
        where: { companyId, name: periodName! },
      })
      if (existingPeriod) {
        return NextResponse.json(
          { error: "同じ評価期間名が既に存在します" },
          { status: 400 }
        )
      }

      period = await prisma.evaluationPeriod.create({
        data: {
          companyId,
          name: periodName!,
          periodType: periodType!,
          startDate: new Date(startDate!),
          endDate: new Date(endDate!),
          status: "STARTED",
        },
      })
    }

    // 2. 期間固有テンプレートの自動作成（オプション）
    let periodTemplatesCreated = 0
    if (createPeriodTemplates && evaluationTypesToCreate.includes("individual")) {
      // 確定済みのマスターテンプレートを取得
      const masterTemplates = await prisma.evaluationTemplate.findMany({
        where: {
          status: "confirmed",
          gradeJobTypeConfig: {
            grade: { companyId },
          },
        },
        include: {
          items: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
          gradeJobTypeConfig: {
            include: {
              grade: { select: { id: true, name: true } },
              jobType: { select: { id: true, name: true } },
            },
          },
        },
      })

      for (const masterTemplate of masterTemplates) {
        const config = masterTemplate.gradeJobTypeConfig
        if (!config) continue

        // 既存の期間固有テンプレートをチェック
        const existing = await prisma.periodEvaluationTemplate.findUnique({
          where: {
            periodId_gradeId_jobTypeId: {
              periodId: period.id,
              gradeId: config.grade.id,
              jobTypeId: config.jobType.id,
            },
          },
        })

        if (existing) continue

        // 期間固有テンプレートを作成
        await prisma.periodEvaluationTemplate.create({
          data: {
            periodId: period.id,
            sourceTemplateId: masterTemplate.id,
            gradeId: config.grade.id,
            jobTypeId: config.jobType.id,
            name: masterTemplate.name,
            description: masterTemplate.description,
            status: "draft",
            items: {
              create: masterTemplate.items.map((item) => ({
                sourceItemId: item.id,
                name: item.name,
                description: item.description,
                category: item.category,
                maxScore: item.maxScore,
                weight: item.weight,
                sortOrder: item.sortOrder,
                isAdded: false,
                isDeleted: false,
                isModified: false,
              })),
            },
          },
        })
        periodTemplatesCreated++
      }

      console.log(`期間固有テンプレート作成数: ${periodTemplatesCreated}`)
    }

    // 3. 会社の全アクティブ従業員を取得（評価フラグ付き）
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        status: "ACTIVE",
        gradeId: { not: null },
        jobTypeId: { not: null },
      },
      select: {
        id: true,
        gradeId: true,
        jobTypeId: true,
        has360Evaluation: true,
        hasIndividualEvaluation: true,
        firstName: true,
        lastName: true,
        individualEvaluatorId: true,
      },
    })

    // デバッグログ
    console.log("=== 評価開始デバッグ ===")
    console.log("評価種別:", evaluationTypesToCreate)
    console.log("従業員数:", employees.length)
    console.log("個別評価対象:", employees.filter(e => e.hasIndividualEvaluation).map(e => `${e.lastName}${e.firstName}`))
    console.log("360対象:", employees.filter(e => e.has360Evaluation).map(e => `${e.lastName}${e.firstName}`))

    // 4. 従業員ごとにテンプレートを取得（GradeJobTypeConfig経由）
    // 「対象者を追加」APIと同じロジック
    const employeeTemplateMap = new Map<string, string>()

    // デバッグ: 最初の従業員のconfigを詳しくログ
    if (employees.length > 0) {
      const firstEmp = employees[0]
      const debugConfig = await prisma.gradeJobTypeConfig.findFirst({
        where: {
          gradeId: firstEmp.gradeId!,
          jobTypeId: firstEmp.jobTypeId!,
        },
        include: {
          evaluationTemplate: true,
        },
      })
      console.log(`デバッグ: ${firstEmp.lastName}${firstEmp.firstName}のconfig:`, JSON.stringify(debugConfig, null, 2))
    }

    for (const emp of employees) {
      if (emp.gradeId && emp.jobTypeId) {
        const config = await prisma.gradeJobTypeConfig.findFirst({
          where: {
            gradeId: emp.gradeId,
            jobTypeId: emp.jobTypeId,
          },
          include: {
            evaluationTemplate: { select: { id: true } },
          },
        })
        if (config?.evaluationTemplate?.id) {
          employeeTemplateMap.set(emp.id, config.evaluationTemplate.id)
        }
      }
    }

    console.log("テンプレートマップ:", employeeTemplateMap.size, "件")

    // 5. 従業員ごとにEmployeeEvaluation + EmployeeEvaluationItemを一括作成
    let createdCount = 0
    let skippedCount = 0
    const skippedReasons: { noTemplate: number; alreadyExists: number } = {
      noTemplate: 0,
      alreadyExists: 0,
    }

    let individualCreatedCount = 0
    let evaluation360CreatedCount = 0

    for (const emp of employees) {
      const templateId = employeeTemplateMap.get(emp.id)

      if (!templateId) {
        console.log(`スキップ(テンプレートなし): ${emp.lastName}${emp.firstName} - gradeId=${emp.gradeId}, jobTypeId=${emp.jobTypeId}`)
        skippedCount++
        skippedReasons.noTemplate++
        continue
      }

      let empSkipped = false

      // 各評価種別ごとにEmployeeEvaluationを作成
      for (const evalType of evaluationTypesToCreate) {
        // 評価フラグに基づいてフィルタリング
        // 個別評価: hasIndividualEvaluation=true の従業員のみ
        // 360評価: has360Evaluation=true の従業員のみ
        if (evalType === "individual" && !emp.hasIndividualEvaluation) {
          console.log(`スキップ(個別対象外): ${emp.lastName}${emp.firstName}`)
          continue
        }
        if (evalType === "360" && !emp.has360Evaluation) {
          console.log(`スキップ(360対象外): ${emp.lastName}${emp.firstName}`)
          continue
        }

        // 同一期間・同一従業員・同一評価種別で既に存在するか確認
        const existing = await prisma.employeeEvaluation.findFirst({
          where: {
            employeeId: emp.id,
            evaluationPeriodId: period.id,
            evaluationType: evalType,
          },
        })

        if (existing) {
          empSkipped = true
          continue
        }

        await prisma.employeeEvaluation.create({
          data: {
            employeeId: emp.id,
            evaluationTemplateId: templateId,
            evaluationPeriodId: period.id,
            evaluationType: evalType,
            status: "STARTED",
            // 個別評価の場合、マスター設定の評価者をコピー
            evaluatorId: evalType === "individual" ? emp.individualEvaluatorId : null,
          },
        })

        console.log(`作成成功: ${emp.lastName}${emp.firstName} - ${evalType}`)
        createdCount++
        if (evalType === "individual") individualCreatedCount++
        if (evalType === "360") evaluation360CreatedCount++
      }

      if (empSkipped && createdCount === 0) {
        skippedCount++
        skippedReasons.alreadyExists++
      }
    }

    console.log(`=== EmployeeEvaluation作成結果 ===`)
    console.log(`個別評価作成数: ${individualCreatedCount}`)
    console.log(`360評価作成数: ${evaluation360CreatedCount}`)
    console.log(`スキップ数: ${skippedCount}`)

    // 6. 360度評価レコードを一括作成（評価種別に360が含まれる場合）
    let created360Count = 0
    if (evaluationTypesToCreate.includes("360")) {
      // 既存の360度評価レコードを取得
      const existing360Records = await prisma.evaluation360Record.findMany({
        where: {
          evaluationPeriodId: period.id,
          companyId,
        },
        select: { employeeId: true },
      })
      const existing360EmployeeIds = new Set(existing360Records.map((r) => r.employeeId))

      // has360Evaluation=true かつ 新規対象者のみフィルタ
      const new360Employees = employees.filter(
        (emp) => emp.has360Evaluation && !existing360EmployeeIds.has(emp.id)
      )

      if (new360Employees.length > 0) {
        await prisma.evaluation360Record.createMany({
          data: new360Employees.map((emp) => ({
            evaluationPeriodId: period.id,
            employeeId: emp.id,
            companyId,
            status: "draft",
          })),
        })
        created360Count = new360Employees.length
      }
    }

    // 7. 評価期間のステータスをDISTRIBUTEDに更新（作成があった場合）
    if ((createdCount > 0 || created360Count > 0) && period.status === "STARTED") {
      await prisma.evaluationPeriod.update({
        where: { id: period.id },
        data: { status: "DISTRIBUTED" },
      })
    }

    return NextResponse.json({
      evaluationPeriod: period,
      summary: {
        totalEmployees: employees.length,
        createdEvaluations: createdCount,
        created360Records: created360Count,
        createdPeriodTemplates: periodTemplatesCreated,
        skippedEmployees: skippedCount,
        skippedReasons,
      },
    })
  } catch (error) {
    console.error("評価一括開始エラー:", error)
    return NextResponse.json({ error: "評価の開始に失敗しました" }, { status: 500 })
  }
}
