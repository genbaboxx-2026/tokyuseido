import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 集計実行
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId, employeeId } = await params

    // レコードを取得
    const record = await prisma.evaluation360Record.findUnique({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId,
        },
      },
      include: {
        reviewerAssignments: {
          where: { status: "submitted" },
        },
      },
    })

    if (!record) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      )
    }

    if (record.status !== "collecting") {
      return NextResponse.json(
        { error: "集計は回収フェーズからのみ実行できます" },
        { status: 400 }
      )
    }

    // 少なくとも1人以上の提出が必要
    if (record.reviewerAssignments.length === 0) {
      return NextResponse.json(
        { error: "提出済みの評価者が1人以上必要です" },
        { status: 400 }
      )
    }

    // ステータスを aggregated に変更
    await prisma.evaluation360Record.update({
      where: { id: record.id },
      data: { status: "aggregated" },
    })

    return NextResponse.json({
      success: true,
      message: "集計を完了しました",
      submittedCount: record.reviewerAssignments.length,
    })
  } catch (error) {
    console.error("集計エラー:", error)
    return NextResponse.json(
      { error: "集計に失敗しました" },
      { status: 500 }
    )
  }
}
