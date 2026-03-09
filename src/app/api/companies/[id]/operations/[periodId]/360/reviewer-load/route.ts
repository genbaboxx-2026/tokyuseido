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
            email: true,
            department: { select: { id: true, name: true } },
            grade: { select: { id: true, name: true } },
          },
        },
        accessToken: {
          select: {
            id: true,
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
          email: string | null
          department: { id: string; name: string } | null
          grade: { id: string; name: string } | null
        }
        totalAssigned: number
        submitted: number
        inProgress: number
        notStarted: number
        emailSentAt: Date | null
        hasAccessToken: boolean
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
        // メール送信日時は最新のものを使用
        if (assignment.emailSentAt && (!existing.emailSentAt || assignment.emailSentAt > existing.emailSentAt)) {
          existing.emailSentAt = assignment.emailSentAt
        }
        // トークンがあればフラグを立てる
        if (assignment.accessToken) {
          existing.hasAccessToken = true
        }
      } else {
        reviewerMap.set(reviewerId, {
          reviewer: assignment.reviewer,
          totalAssigned: 1,
          submitted: assignment.status === "submitted" ? 1 : 0,
          inProgress: assignment.status === "in_progress" ? 1 : 0,
          notStarted: assignment.status === "not_started" ? 1 : 0,
          emailSentAt: assignment.emailSentAt,
          hasAccessToken: !!assignment.accessToken,
        })
      }
    }

    // 負荷レベルを計算し、フロントエンド用の形式に変換
    const reviewers = Array.from(reviewerMap.values()).map((item) => ({
      employeeId: item.reviewer.id,
      employeeName: `${item.reviewer.lastName} ${item.reviewer.firstName}`,
      email: item.reviewer.email,
      department: item.reviewer.department?.name || null,
      grade: item.reviewer.grade?.name || null,
      assignedCount: item.totalAssigned,
      submittedCount: item.submitted,
      pendingCount: item.totalAssigned - item.submitted,
      // 負荷レベル: green (10以下), yellow (11-15), red (16以上)
      loadLevel:
        item.totalAssigned <= 10
          ? "green"
          : item.totalAssigned <= 15
          ? "yellow"
          : ("red" as "green" | "yellow" | "red"),
      emailSentAt: item.emailSentAt?.toISOString() || null,
      hasAccessToken: item.hasAccessToken,
    }))

    // 担当人数の多い順にソート
    reviewers.sort((a, b) => b.assignedCount - a.assignedCount)

    return NextResponse.json({ reviewers })
  } catch (error) {
    console.error("評価者負荷一覧取得エラー:", error)
    return NextResponse.json(
      { error: "評価者負荷一覧の取得に失敗しました" },
      { status: 500 }
    )
  }
}
