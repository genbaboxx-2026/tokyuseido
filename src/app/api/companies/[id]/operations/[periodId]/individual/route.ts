import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type EvaluationStatusType = "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
type Phase = "preparing" | "distributing" | "collected" | "aggregated" | "completed"

// フェーズからステータスへのマッピング
const phaseToStatuses: Record<Phase, EvaluationStatusType[]> = {
  preparing: ["STARTED", "PREPARING"],
  distributing: ["DISTRIBUTED"],
  collected: ["COLLECTED"],
  aggregated: ["AGGREGATING"],
  completed: ["COMPLETED"],
}

// ステータスからフェーズを取得
function getPhaseFromStatus(status: string): Phase {
  switch (status) {
    case "STARTED":
    case "PREPARING":
      return "preparing"
    case "DISTRIBUTED":
      return "distributing"
    case "COLLECTED":
      return "collected"
    case "AGGREGATING":
      return "aggregated"
    case "COMPLETED":
      return "completed"
    default:
      return "preparing"
  }
}

// GET: 個別評価一覧を取得（フェーズフィルター対応）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await params
    const { searchParams } = new URL(request.url)
    const phase = searchParams.get("phase") as Phase | null
    const includeAll = searchParams.get("includeAll") === "true"

    // includeAll=trueの場合はフィルタなし、それ以外は従来通り
    const statusFilter = !includeAll && phase ? phaseToStatuses[phase] : undefined

    const evaluations = await prisma.employeeEvaluation.findMany({
      where: {
        evaluationPeriodId: periodId,
        evaluationType: "individual",
        ...(statusFilter && { status: { in: statusFilter } }),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            individualEvaluatorId: true,
            grade: { select: { id: true, name: true } },
            jobType: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        evaluationTemplate: {
          select: {
            id: true,
            name: true,
            items: {
              select: { id: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        items: {
          select: {
            id: true,
            selfScore: true,
            evaluatorScore: true,
            comment: true,
            evaluationTemplateItemId: true,
            evaluationTemplateItem: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true,
                maxScore: true,
                weight: true,
                sortOrder: true,
              },
            },
          },
          orderBy: {
            evaluationTemplateItem: {
              sortOrder: "asc",
            },
          },
        },
      },
      orderBy: [
        { employee: { lastName: "asc" } },
        { employee: { firstName: "asc" } },
      ],
    })

    // レスポンス用にフォーマット
    const formattedEvaluations = evaluations.map((evaluation) => {
      const itemCount = evaluation.items.length
      const selfScoredCount = evaluation.items.filter((item) => item.selfScore !== null).length
      const managerScoredCount = evaluation.items.filter((item) => item.evaluatorScore !== null).length

      // 詳細ステップを判定（配布フェーズ用）
      let detailStep: "self_reviewing" | "manager_reviewing" | null = null
      if (evaluation.status === "DISTRIBUTED") {
        // 自己評価が全て完了していれば上長評価中、そうでなければ自己評価中
        if (selfScoredCount === itemCount && itemCount > 0) {
          detailStep = "manager_reviewing"
        } else {
          detailStep = "self_reviewing"
        }
      }

      // マスタ（テンプレート）からの変更を検知
      let hasChangesFromMaster = false
      if (evaluation.evaluationTemplate) {
        const templateItemIds = new Set(evaluation.evaluationTemplate.items.map(i => i.id))
        const evaluationItemIds = new Set(evaluation.items.map(i => i.evaluationTemplateItemId))

        // 項目数が違う、または異なる項目がある場合は変更あり
        if (templateItemIds.size !== evaluationItemIds.size) {
          hasChangesFromMaster = true
        } else {
          // 全ての項目IDが一致するか確認
          for (const id of evaluationItemIds) {
            if (!templateItemIds.has(id)) {
              hasChangesFromMaster = true
              break
            }
          }
        }
      }

      return {
        id: evaluation.id,
        employeeId: evaluation.employeeId,
        status: evaluation.status,
        currentPhase: getPhaseFromStatus(evaluation.status),
        detailStep,
        totalScore: evaluation.totalScore,
        finalRating: evaluation.finalRating,
        evaluatorComment: evaluation.evaluatorComment,
        selfComment: evaluation.selfComment,
        selfCompletedAt: evaluation.selfCompletedAt,
        evaluatorCompletedAt: evaluation.evaluatorCompletedAt,
        createdAt: evaluation.createdAt,
        updatedAt: evaluation.updatedAt,
        employee: {
          id: evaluation.employee.id,
          firstName: evaluation.employee.firstName,
          lastName: evaluation.employee.lastName,
          email: evaluation.employee.email,
          individualEvaluatorId: evaluation.employee.individualEvaluatorId,
          grade: evaluation.employee.grade,
          jobType: evaluation.employee.jobType,
          department: evaluation.employee.department,
        },
        evaluator: evaluation.evaluator ? {
          id: evaluation.evaluator.id,
          firstName: evaluation.evaluator.firstName,
          lastName: evaluation.evaluator.lastName,
        } : null,
        evaluatorId: evaluation.evaluatorId,
        template: evaluation.evaluationTemplate ? {
          id: evaluation.evaluationTemplate.id,
          name: evaluation.evaluationTemplate.name,
        } : null,
        hasChangesFromMaster,
        itemStats: {
          total: itemCount,
          selfScored: selfScoredCount,
          managerScored: managerScoredCount,
        },
        items: evaluation.items.map((item) => ({
          id: item.id,
          selfScore: item.selfScore,
          evaluatorScore: item.evaluatorScore,
          comment: item.comment,
          templateItem: item.evaluationTemplateItem ? {
            id: item.evaluationTemplateItem.id,
            name: item.evaluationTemplateItem.name,
            description: item.evaluationTemplateItem.description,
            category: item.evaluationTemplateItem.category,
            maxScore: item.evaluationTemplateItem.maxScore,
            weight: item.evaluationTemplateItem.weight,
          } : null,
        })),
      }
    })

    // includeAll=trueかつphaseが指定されている場合、アクティブ（該当フェーズ）を先にソート
    let sortedEvaluations = formattedEvaluations
    if (includeAll && phase) {
      sortedEvaluations = [...formattedEvaluations].sort((a, b) => {
        const aActive = a.currentPhase === phase
        const bActive = b.currentPhase === phase
        if (aActive && !bActive) return -1
        if (!aActive && bActive) return 1
        return 0
      })
    }

    return NextResponse.json({ evaluations: sortedEvaluations })
  } catch (error) {
    console.error("個別評価一覧取得エラー:", error)
    return NextResponse.json(
      { error: "個別評価の取得に失敗しました" },
      { status: 500 }
    )
  }
}

// POST: 個別評価レコードを一括作成（対象従業員の選択）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await params
    const body = await request.json()
    const { employeeIds } = body as { employeeIds: string[] }

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { error: "従業員IDが必要です" },
        { status: 400 }
      )
    }

    // 既存のレコードを確認
    const existingRecords = await prisma.employeeEvaluation.findMany({
      where: {
        evaluationPeriodId: periodId,
        evaluationType: "individual",
        employeeId: { in: employeeIds },
      },
      select: { employeeId: true },
    })

    const existingEmployeeIds = new Set(existingRecords.map((r) => r.employeeId))
    const newEmployeeIds = employeeIds.filter((id) => !existingEmployeeIds.has(id))

    if (newEmployeeIds.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: employeeIds.length,
        message: "すべての従業員は既にレコードが存在します",
      })
    }

    // 従業員情報を取得（gradeId, jobTypeId, individualEvaluatorIdを含む）
    const employees = await prisma.employee.findMany({
      where: { id: { in: newEmployeeIds } },
      select: {
        id: true,
        gradeId: true,
        jobTypeId: true,
        individualEvaluatorId: true,
      },
    })

    // 従業員ごとにテンプレートを取得
    const employeeTemplateMap = new Map<string, string>()
    for (const emp of employees) {
      if (emp.gradeId && emp.jobTypeId) {
        // GradeJobTypeConfigからテンプレートを取得
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

    // テンプレートがある従業員のみレコードを作成
    const employeesWithTemplate = newEmployeeIds.filter((id) =>
      employeeTemplateMap.has(id)
    )

    if (employeesWithTemplate.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: employeeIds.length,
        message: "対象従業員の評価テンプレートが見つかりません。等級・職種の設定を確認してください。",
      })
    }

    // 従業員IDから評価者IDへのマップを作成
    const employeeEvaluatorMap = new Map<string, string | null>()
    employees.forEach((emp) => {
      employeeEvaluatorMap.set(emp.id, emp.individualEvaluatorId)
    })

    // 新しいレコードを作成
    const createdRecords = await prisma.employeeEvaluation.createMany({
      data: employeesWithTemplate.map((employeeId) => ({
        evaluationPeriodId: periodId,
        employeeId,
        evaluationType: "individual",
        status: "STARTED" as const,
        evaluationTemplateId: employeeTemplateMap.get(employeeId)!,
        // マスター設定の評価者をコピー
        evaluatorId: employeeEvaluatorMap.get(employeeId) ?? null,
      })),
    })

    return NextResponse.json({
      created: createdRecords.count,
      skipped: employeeIds.length - newEmployeeIds.length,
      message: `${createdRecords.count}件のレコードを作成しました`,
    })
  } catch (error) {
    console.error("個別評価レコード作成エラー:", error)
    return NextResponse.json(
      { error: "個別評価レコードの作成に失敗しました" },
      { status: 500 }
    )
  }
}
