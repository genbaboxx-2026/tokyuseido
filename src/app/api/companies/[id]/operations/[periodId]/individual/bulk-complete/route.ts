import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 集計済み者を一括確定（AGGREGATING → COMPLETED）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId } = await params

    // AGGREGATING ステータスの評価を取得
    const aggregatingEvaluations = await prisma.employeeEvaluation.findMany({
      where: {
        evaluationPeriodId: periodId,
        evaluationType: "individual",
        status: "AGGREGATING",
      },
    })

    if (aggregatingEvaluations.length === 0) {
      return NextResponse.json({
        success: true,
        completed: 0,
        message: "確定可能な評価がありません",
      })
    }

    // 一括更新
    await prisma.employeeEvaluation.updateMany({
      where: {
        id: { in: aggregatingEvaluations.map((e) => e.id) },
      },
      data: {
        status: "COMPLETED",
      },
    })

    return NextResponse.json({
      success: true,
      completed: aggregatingEvaluations.length,
      message: `${aggregatingEvaluations.length}件を確定しました`,
    })
  } catch (error) {
    console.error("一括確定エラー:", error)
    return NextResponse.json(
      { error: "一括確定に失敗しました" },
      { status: 500 }
    )
  }
}
