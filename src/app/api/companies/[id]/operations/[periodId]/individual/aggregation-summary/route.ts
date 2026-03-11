import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * 集計サマリーAPI
 * GET: 集計対象の評価の詳細サマリーを取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId } = await params
    const { searchParams } = new URL(request.url)
    const evaluationId = searchParams.get("evaluationId")

    if (!evaluationId) {
      return NextResponse.json(
        { error: "評価IDが必要です" },
        { status: 400 }
      )
    }

    // 評価を取得
    const evaluation = await prisma.employeeEvaluation.findFirst({
      where: {
        id: evaluationId,
        evaluationPeriodId: periodId,
        evaluationType: "individual",
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            grade: { select: { name: true } },
            jobType: { select: { name: true } },
          },
        },
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
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
        },
      },
    })

    if (!evaluation) {
      return NextResponse.json(
        { error: "評価が見つかりません" },
        { status: 404 }
      )
    }

    // カテゴリごとにグループ化し、集計
    const categoriesMap = new Map<
      string,
      {
        name: string;
        sortOrder: number;
        items: Array<{
          id: string;
          itemName: string;
          description: string | null;
          maxScore: number;
          weight: number;
          selfScore: number | null;
          evaluatorScore: number | null;
          averageScore: number | null;
          comment: string | null;
        }>;
        selfTotal: number;
        evaluatorTotal: number;
        averageTotal: number;
        maxTotal: number;
      }
    >()

    for (const item of evaluation.items) {
      const templateItem = item.evaluationTemplateItem
      if (!templateItem) continue

      const categoryName = templateItem.category || "その他"
      const categorySortOrder = templateItem.sortOrder

      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          name: categoryName,
          sortOrder: categorySortOrder,
          items: [],
          selfTotal: 0,
          evaluatorTotal: 0,
          averageTotal: 0,
          maxTotal: 0,
        })
      }

      const category = categoriesMap.get(categoryName)!

      const selfScore = item.selfScore
      const evaluatorScore = item.evaluatorScore
      const averageScore =
        selfScore !== null && evaluatorScore !== null
          ? Math.round(((selfScore + evaluatorScore) / 2) * 10) / 10
          : null

      category.items.push({
        id: item.id,
        itemName: templateItem.name,
        description: templateItem.description,
        maxScore: templateItem.maxScore,
        weight: templateItem.weight,
        selfScore,
        evaluatorScore,
        averageScore,
        comment: item.comment,
      })

      if (selfScore !== null) {
        category.selfTotal += selfScore * templateItem.weight
      }
      if (evaluatorScore !== null) {
        category.evaluatorTotal += evaluatorScore * templateItem.weight
      }
      if (averageScore !== null) {
        category.averageTotal += averageScore * templateItem.weight
      }
      category.maxTotal += templateItem.maxScore * templateItem.weight
    }

    // カテゴリをソート
    const categories = Array.from(categoriesMap.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => ({
        ...category,
        items: category.items.sort((a, b) => {
          const aSort = evaluation.items.find((i) => i.id === a.id)
            ?.evaluationTemplateItem?.sortOrder ?? 0
          const bSort = evaluation.items.find((i) => i.id === b.id)
            ?.evaluationTemplateItem?.sortOrder ?? 0
          return aSort - bSort
        }),
        selfPercentage:
          category.maxTotal > 0
            ? Math.round((category.selfTotal / category.maxTotal) * 100)
            : 0,
        evaluatorPercentage:
          category.maxTotal > 0
            ? Math.round((category.evaluatorTotal / category.maxTotal) * 100)
            : 0,
        averagePercentage:
          category.maxTotal > 0
            ? Math.round((category.averageTotal / category.maxTotal) * 100)
            : 0,
      }))

    // 全体の集計
    let totalSelfScore = 0
    let totalEvaluatorScore = 0
    let totalMaxScore = 0
    let totalWeight = 0

    for (const item of evaluation.items) {
      const templateItem = item.evaluationTemplateItem
      if (!templateItem) continue

      if (item.selfScore !== null) {
        totalSelfScore += item.selfScore * templateItem.weight
      }
      if (item.evaluatorScore !== null) {
        totalEvaluatorScore += item.evaluatorScore * templateItem.weight
      }
      totalMaxScore += templateItem.maxScore * templateItem.weight
      totalWeight += templateItem.weight
    }

    const averageTotal =
      (totalSelfScore + totalEvaluatorScore) / 2

    return NextResponse.json({
      evaluation: {
        id: evaluation.id,
        status: evaluation.status,
        selfComment: evaluation.selfComment,
        evaluatorComment: evaluation.evaluatorComment,
        selfCompletedAt: evaluation.selfCompletedAt,
        evaluatorCompletedAt: evaluation.evaluatorCompletedAt,
      },
      employee: {
        id: evaluation.employee.id,
        firstName: evaluation.employee.firstName,
        lastName: evaluation.employee.lastName,
        department: evaluation.employee.department?.name || null,
        grade: evaluation.employee.grade?.name || null,
        jobType: evaluation.employee.jobType?.name || null,
      },
      evaluator: evaluation.evaluator
        ? {
            id: evaluation.evaluator.id,
            firstName: evaluation.evaluator.firstName,
            lastName: evaluation.evaluator.lastName,
          }
        : null,
      categories,
      summary: {
        totalItems: evaluation.items.length,
        totalSelfScore: Math.round(totalSelfScore * 10) / 10,
        totalEvaluatorScore: Math.round(totalEvaluatorScore * 10) / 10,
        totalAverageScore: Math.round(averageTotal * 10) / 10,
        totalMaxScore: Math.round(totalMaxScore * 10) / 10,
        selfPercentage:
          totalMaxScore > 0
            ? Math.round((totalSelfScore / totalMaxScore) * 100)
            : 0,
        evaluatorPercentage:
          totalMaxScore > 0
            ? Math.round((totalEvaluatorScore / totalMaxScore) * 100)
            : 0,
        averagePercentage:
          totalMaxScore > 0
            ? Math.round((averageTotal / totalMaxScore) * 100)
            : 0,
      },
    })
  } catch (error) {
    console.error("集計サマリー取得エラー:", error)
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    )
  }
}
