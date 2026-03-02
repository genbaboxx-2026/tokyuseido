import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 全員一括確定
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

    // aggregated ステータスのレコードを取得
    const aggregatedRecords = await prisma.evaluation360Record.findMany({
      where: {
        companyId,
        evaluationPeriodId: periodId,
        status: "aggregated",
      },
    })

    if (aggregatedRecords.length === 0) {
      return NextResponse.json({
        success: true,
        completed: 0,
        message: "確定可能なレコードがありません",
      })
    }

    // 一括更新
    const now = new Date()
    await prisma.evaluation360Record.updateMany({
      where: {
        id: { in: aggregatedRecords.map((r) => r.id) },
      },
      data: {
        status: "completed",
        completedAt: now,
        completedBy: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      completed: aggregatedRecords.length,
      message: `${aggregatedRecords.length}件の評価を確定しました`,
    })
  } catch (error) {
    console.error("一括確定エラー:", error)
    return NextResponse.json(
      { error: "一括確定に失敗しました" },
      { status: 500 }
    )
  }
}
