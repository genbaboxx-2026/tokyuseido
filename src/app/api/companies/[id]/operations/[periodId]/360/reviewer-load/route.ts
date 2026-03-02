import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET: 評価者負荷一覧（全評価者の担当人数・提出状況）
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

    // この評価期間の全評価者アサインメントを取得
    const assignments = await prisma.evaluation360ReviewerAssignment.findMany({
      where: {
        record: {
          evaluationPeriodId: periodId,
          companyId,
        },
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    })

    // 評価者ごとに集計
    const reviewerMap = new Map<
      string,
      {
        reviewer: {
          id: string
          firstName: string
          lastName: string
          department: { id: string; name: string } | null
        }
        totalAssigned: number
        submitted: number
        inProgress: number
        notStarted: number
      }
    >()

    for (const assignment of assignments) {
      const reviewerId = assignment.reviewerId
      const existing = reviewerMap.get(reviewerId)

      if (existing) {
        existing.totalAssigned++
        if (assignment.status === "submitted") {
          existing.submitted++
        } else if (assignment.status === "in_progress") {
          existing.inProgress++
        } else {
          existing.notStarted++
        }
      } else {
        reviewerMap.set(reviewerId, {
          reviewer: assignment.reviewer,
          totalAssigned: 1,
          submitted: assignment.status === "submitted" ? 1 : 0,
          inProgress: assignment.status === "in_progress" ? 1 : 0,
          notStarted: assignment.status === "not_started" ? 1 : 0,
        })
      }
    }

    // 負荷レベルを計算
    const result = Array.from(reviewerMap.values()).map((item) => ({
      ...item,
      // 負荷レベル: green (10以下), yellow (11-15), red (16以上)
      loadLevel:
        item.totalAssigned <= 10
          ? "green"
          : item.totalAssigned <= 15
          ? "yellow"
          : "red",
    }))

    // 担当人数の多い順にソート
    result.sort((a, b) => b.totalAssigned - a.totalAssigned)

    return NextResponse.json(result)
  } catch (error) {
    console.error("評価者負荷一覧取得エラー:", error)
    return NextResponse.json(
      { error: "評価者負荷一覧の取得に失敗しました" },
      { status: 500 }
    )
  }
}
