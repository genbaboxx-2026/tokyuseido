import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 配布実行
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
        reviewerAssignments: true,
      },
    })

    if (!record) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      )
    }

    if (record.status !== "ready") {
      return NextResponse.json(
        { error: "配布は準備完了状態からのみ実行できます" },
        { status: 400 }
      )
    }

    if (record.reviewerAssignments.length === 0) {
      return NextResponse.json(
        { error: "評価者が設定されていません" },
        { status: 400 }
      )
    }

    // トランザクションで更新
    await prisma.$transaction(async (tx) => {
      // 評価者ステータスをリセット
      await tx.evaluation360ReviewerAssignment.updateMany({
        where: { recordId: record.id },
        data: {
          status: "not_started",
          submittedAt: null,
        },
      })

      // レコードのステータスを distributing に変更
      await tx.evaluation360Record.update({
        where: { id: record.id },
        data: { status: "distributing" },
      })
    })

    return NextResponse.json({ success: true, message: "配布を開始しました" })
  } catch (error) {
    console.error("配布エラー:", error)
    return NextResponse.json(
      { error: "配布に失敗しました" },
      { status: 500 }
    )
  }
}
