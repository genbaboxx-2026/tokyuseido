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
          include: {
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
        createdAt: evaluation.createdAt,
        updatedAt: evaluation.updatedAt,
        employee: {
          id: evaluation.employee.id,
          firstName: evaluation.employee.firstName,
          lastName: evaluation.employee.lastName,
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
