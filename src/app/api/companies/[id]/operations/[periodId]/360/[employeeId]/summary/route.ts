import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// シャッフル関数（シードベース）
function seededShuffle<T>(array: T[], seed: string): T[] {
  const result = [...array]
  let seedHash = 0
  for (let i = 0; i < seed.length; i++) {
    seedHash = ((seedHash << 5) - seedHash + seed.charCodeAt(i)) | 0
  }

  for (let i = result.length - 1; i > 0; i--) {
    seedHash = (seedHash * 1103515245 + 12345) | 0
    const j = Math.abs(seedHash) % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

// 標準偏差を計算
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squareDiffs = values.map((value) => Math.pow(value - mean, 2))
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(avgSquareDiff)
}

// GET: 集計結果を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, employeeId } = await params

    // レコードを取得
    const record = await prisma.evaluation360Record.findUnique({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            grade: { select: { id: true, name: true } },
            jobType: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        reviewerAssignments: {
          where: { status: "submitted" },
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            scores: {
              include: {
                evaluationCustomItem: true,
              },
            },
          },
        },
      },
    })

    if (!record) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      )
    }

    if (record.status !== "aggregated" && record.status !== "completed") {
      return NextResponse.json(
        { error: "集計結果は集計・完了フェーズでのみ表示可能です" },
        { status: 400 }
      )
    }

    // EvaluationCustomItemから評価項目を取得
    const customItems = await prisma.evaluationCustomItem.findMany({
      where: {
        employeeId,
        companyId,
        periodId,
        evaluationType: "360",
        isDeleted: false,
      },
      orderBy: [
        { categorySortOrder: "asc" },
        { sortOrder: "asc" },
      ],
    })

    // カテゴリごとにグループ化
    const categoriesMap = new Map<string, {
      id: string
      name: string
      sortOrder: number
      items: {
        id: string
        content: string
        maxScore: number
        sortOrder: number
      }[]
    }>()

    customItems.forEach((item) => {
      const categoryName = item.categoryName || "その他"
      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          id: `cat-${categoriesMap.size}`,
          name: categoryName,
          sortOrder: item.categorySortOrder || 0,
          items: [],
        })
      }
      categoriesMap.get(categoryName)!.items.push({
        id: item.id,
        content: item.itemName,
        maxScore: item.maxScore,
        sortOrder: item.sortOrder,
      })
    })

    const categories = Array.from(categoriesMap.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    )

    // 匿名設定の場合、評価者名をシャッフルした匿名IDに変換
    const reviewerIdMap = new Map<string, string>()
    if (record.isAnonymous) {
      const shuffledAssignments = seededShuffle(
        record.reviewerAssignments,
        record.id
      )
      shuffledAssignments.forEach((assignment, index) => {
        reviewerIdMap.set(assignment.id, String.fromCharCode(65 + index)) // A, B, C, ...
      })
    }

    // 評価者ごとのスコアマップを作成
    const reviewerScoreMap = new Map<
      string,
      {
        anonymousId: string | null
        reviewerName: string | null
        totalScore: number
        maxPossibleScore: number
        scores: Map<string, number>
        comment: string | null
      }
    >()

    for (const assignment of record.reviewerAssignments) {
      const scoreMap = new Map<string, number>()
      let totalScore = 0

      for (const score of assignment.scores) {
        if (score.score !== null) {
          scoreMap.set(score.evaluationCustomItemId, score.score)
          totalScore += score.score
        }
      }

      const maxPossibleScore = customItems.reduce(
        (sum, item) => sum + item.maxScore,
        0
      )

      reviewerScoreMap.set(assignment.id, {
        anonymousId: record.isAnonymous
          ? reviewerIdMap.get(assignment.id) || null
          : null,
        reviewerName: record.isAnonymous
          ? null
          : `${assignment.reviewer.lastName} ${assignment.reviewer.firstName}`,
        totalScore,
        maxPossibleScore,
        scores: scoreMap,
        comment: assignment.comment,
      })
    }

    // カテゴリー別・項目別の集計
    const categoryResults = []
    const highlights = {
      high: [] as { itemId: string; content: string; category: string; avgScore: number; maxScore: number; percentage: number }[],
      low: [] as { itemId: string; content: string; category: string; avgScore: number; maxScore: number; percentage: number }[],
      highVariance: [] as { itemId: string; content: string; category: string; stdDev: number; scores: { label: string; score: number }[] }[],
    }

    let totalAvgSum = 0
    let totalMaxSum = 0

    for (const category of categories) {
      const itemResults = []
      let categoryAvgSum = 0
      let categoryMaxSum = 0

      for (const item of category.items) {
        const itemScores: { label: string; score: number }[] = []

        for (const [, reviewerData] of reviewerScoreMap) {
          const score = reviewerData.scores.get(item.id)
          if (score !== undefined) {
            itemScores.push({
              label: reviewerData.anonymousId || reviewerData.reviewerName || "不明",
              score,
            })
          }
        }

        const scores = itemScores.map((s) => s.score)
        const avgScore =
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0
        const stdDev = calculateStdDev(scores)
        const percentage = item.maxScore > 0 ? (avgScore / item.maxScore) * 100 : 0

        categoryAvgSum += avgScore
        categoryMaxSum += item.maxScore

        const itemResult = {
          id: item.id,
          content: item.content,
          maxScore: item.maxScore,
          scores: itemScores,
          avgScore: Math.round(avgScore * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          percentage: Math.round(percentage * 10) / 10,
        }

        itemResults.push(itemResult)

        // ハイライト判定
        if (item.maxScore > 0) {
          if (percentage >= 90) {
            highlights.high.push({
              itemId: item.id,
              content: item.content,
              category: category.name,
              avgScore: itemResult.avgScore,
              maxScore: item.maxScore,
              percentage: itemResult.percentage,
            })
          } else if (percentage <= 60) {
            highlights.low.push({
              itemId: item.id,
              content: item.content,
              category: category.name,
              avgScore: itemResult.avgScore,
              maxScore: item.maxScore,
              percentage: itemResult.percentage,
            })
          }
        }

        if (stdDev >= 1.0 && scores.length > 1) {
          highlights.highVariance.push({
            itemId: item.id,
            content: item.content,
            category: category.name,
            stdDev: itemResult.stdDev,
            scores: itemScores,
          })
        }
      }

      totalAvgSum += categoryAvgSum
      totalMaxSum += categoryMaxSum

      categoryResults.push({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        items: itemResults,
        avgScore: Math.round(categoryAvgSum * 100) / 100,
        maxScore: categoryMaxSum,
        percentage:
          categoryMaxSum > 0
            ? Math.round((categoryAvgSum / categoryMaxSum) * 1000) / 10
            : 0,
      })
    }

    // 評価者別サマリー
    const reviewerSummaries = Array.from(reviewerScoreMap.values()).map(
      (data) => ({
        label: data.anonymousId || data.reviewerName || "不明",
        totalScore: data.totalScore,
        maxPossibleScore: data.maxPossibleScore,
        percentage:
          data.maxPossibleScore > 0
            ? Math.round((data.totalScore / data.maxPossibleScore) * 1000) / 10
            : 0,
      })
    )

    // コメント一覧
    const comments = Array.from(reviewerScoreMap.values())
      .filter((data) => data.comment)
      .map((data) => ({
        label: data.anonymousId || data.reviewerName || "不明",
        comment: data.comment,
      }))

    return NextResponse.json({
      record: {
        id: record.id,
        status: record.status,
        isAnonymous: record.isAnonymous,
        completedAt: record.completedAt,
        completedBy: record.completedBy,
      },
      employee: record.employee,
      summary: {
        totalAvgScore: Math.round(totalAvgSum * 100) / 100,
        totalMaxScore: totalMaxSum,
        percentage:
          totalMaxSum > 0
            ? Math.round((totalAvgSum / totalMaxSum) * 1000) / 10
            : 0,
        reviewerCount: record.reviewerAssignments.length,
      },
      reviewerSummaries,
      categories: categoryResults,
      highlights,
      comments,
    })
  } catch (error) {
    console.error("集計結果取得エラー:", error)
    return NextResponse.json(
      { error: "集計結果の取得に失敗しました" },
      { status: 500 }
    )
  }
}
