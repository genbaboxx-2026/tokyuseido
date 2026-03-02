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

    const { companyId, evaluationPeriodId, periodName, periodType, startDate, endDate, evaluationType, eventEvaluationTypes } = validationResult.data

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

    // 2. 会社の全アクティブ従業員を取得
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
      },
    })

    // 3. 等級×職種 → 評価テンプレートのマッピングを取得
    const templates = await prisma.evaluationTemplate.findMany({
      where: {
        gradeJobTypeConfig: {
          grade: { companyId },
          isEnabled: true,
        },
        isActive: true,
      },
      include: {
        gradeJobTypeConfig: {
          select: { gradeId: true, jobTypeId: true },
        },
        items: {
          orderBy: { sortOrder: "asc" },
          select: { id: true },
        },
      },
    })

    const templateMap = new Map<string, typeof templates[0]>()
    for (const template of templates) {
      const key = `${template.gradeJobTypeConfig.gradeId}-${template.gradeJobTypeConfig.jobTypeId}`
      templateMap.set(key, template)
    }

    // 4. 従業員ごとにEmployeeEvaluation + EmployeeEvaluationItemを一括作成
    let createdCount = 0
    let skippedCount = 0
    const skippedReasons: { noTemplate: number; alreadyExists: number } = {
      noTemplate: 0,
      alreadyExists: 0,
    }

    for (const emp of employees) {
      const key = `${emp.gradeId}-${emp.jobTypeId}`
      const template = templateMap.get(key)

      if (!template || template.items.length === 0) {
        skippedCount++
        skippedReasons.noTemplate++
        continue
      }

      let empSkipped = false

      // 各評価種別ごとにEmployeeEvaluationを作成
      for (const evalType of evaluationTypesToCreate) {
        // 同一期間・同一従業員・同一テンプレート・同一評価種別で既に存在するか確認
        const existing = await prisma.employeeEvaluation.findFirst({
          where: {
            employeeId: emp.id,
            evaluationTemplateId: template.id,
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
            evaluationTemplateId: template.id,
            evaluationPeriodId: period.id,
            evaluationType: evalType,
            status: "STARTED",
            items: {
              create: template.items.map((item) => ({
                evaluationTemplateItemId: item.id,
              })),
            },
          },
        })

        createdCount++
      }

      if (empSkipped && createdCount === 0) {
        skippedCount++
        skippedReasons.alreadyExists++
      }
    }

    // 5. 360度評価レコードを一括作成（評価種別に360が含まれる場合）
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

      // 新規対象者のみフィルタ
      const new360Employees = employees.filter((emp) => !existing360EmployeeIds.has(emp.id))

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

    // 6. 評価期間のステータスをDISTRIBUTEDに更新（作成があった場合）
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
        skippedEmployees: skippedCount,
        skippedReasons,
      },
    })
  } catch (error) {
    console.error("評価一括開始エラー:", error)
    return NextResponse.json({ error: "評価の開始に失敗しました" }, { status: 500 })
  }
}
