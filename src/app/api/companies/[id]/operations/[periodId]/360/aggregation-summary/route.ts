import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// シャッフル関数（シードベース） - 匿名表示で一貫した順序を維持
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

// GET: 集計テーブル用データ取得（評価者別合計点）
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

    // aggregated または completed ステータスのレコードを取得
    const records = await prisma.evaluation360Record.findMany({
      where: {
        companyId,
        evaluationPeriodId: periodId,
        status: { in: ["aggregated", "completed"] },
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
              select: {
                score: true,
              },
            },
          },
        },
      },
      orderBy: {
        employee: {
          lastName: "asc",
        },
      },
    })

    // 全レコードのカスタム項目の満点を取得
    const employeeIds = records.map((r) => r.employeeId)
    const itemCounts = await prisma.evaluationCustomItem.groupBy({
      by: ["employeeId"],
      where: {
        companyId,
        periodId,
        evaluationType: "360",
        isDeleted: false,
        employeeId: { in: employeeIds },
      },
      _sum: { maxScore: true },
    })

    const maxScoreMap = new Map(
      itemCounts.map((c) => [c.employeeId, c._sum.maxScore || 0])
    )

    // 各レコードの評価者別スコアを計算
    const formattedRecords = records.map((record) => {
      const totalReviewers = record.reviewerAssignments.length
      const submittedCount = record.reviewerAssignments.length
      const maxScore = maxScoreMap.get(record.employeeId) || 0

      // 匿名設定の場合、ラベルをシャッフル
      const shuffledAssignments = record.isAnonymous
        ? seededShuffle(record.reviewerAssignments, record.id)
        : record.reviewerAssignments

      // 評価者別の合計点を計算
      const reviewerScores = shuffledAssignments.map((assignment, index) => {
        const totalScore = assignment.scores.reduce(
          (sum, s) => sum + (s.score ?? 0),
          0
        )
        return {
          label: record.isAnonymous
            ? `評価者${String.fromCharCode(65 + index)}`
            : `${assignment.reviewer.lastName} ${assignment.reviewer.firstName}`,
          totalScore,
        }
      })

      // 全評価者の平均スコア
      const totalScoreSum = reviewerScores.reduce((sum, r) => sum + r.totalScore, 0)
      const averageScore = reviewerScores.length > 0
        ? Math.round((totalScoreSum / reviewerScores.length) * 10) / 10
        : 0

      // 回収率の表示
      const collectionRate = `${submittedCount}/${totalReviewers}件`

      return {
        id: record.id,
        employeeId: record.employeeId,
        employee: record.employee,
        status: record.status,
        isAnonymous: record.isAnonymous,
        collectionRate,
        reviewerScores,
        averageScore,
        maxScore,
        percentage: maxScore > 0
          ? Math.round((averageScore / maxScore) * 1000) / 10
          : 0,
        completedAt: record.completedAt,
      }
    })

    // aggregated を先に、completed を後にソート
    const sortedRecords = formattedRecords.sort((a, b) => {
      if (a.status === "aggregated" && b.status === "completed") return -1
      if (a.status === "completed" && b.status === "aggregated") return 1
      return 0
    })

    return NextResponse.json({ records: sortedRecords })
  } catch (error) {
    console.error("集計テーブルデータ取得エラー:", error)
    return NextResponse.json(
      { error: "集計テーブルデータの取得に失敗しました" },
      { status: 500 }
    )
  }
}
