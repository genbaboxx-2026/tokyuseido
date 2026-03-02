import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 確定
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
    })

    if (!record) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      )
    }

    if (record.status !== "aggregated") {
      return NextResponse.json(
        { error: "確定は集計済みフェーズからのみ実行できます" },
        { status: 400 }
      )
    }

    // ステータスを completed に変更
    await prisma.evaluation360Record.update({
      where: { id: record.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        completedBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, message: "評価を確定しました" })
  } catch (error) {
    console.error("確定エラー:", error)
    return NextResponse.json(
      { error: "確定に失敗しました" },
      { status: 500 }
    )
  }
}
