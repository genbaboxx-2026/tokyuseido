import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 回収済み者を一括集計（COLLECTED → AGGREGATING）
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

    // COLLECTED ステータスの評価を取得
    const collectedEvaluations = await prisma.employeeEvaluation.findMany({
      where: {
        evaluationPeriodId: periodId,
        evaluationType: "individual",
        status: "COLLECTED",
      },
    })

    if (collectedEvaluations.length === 0) {
      return NextResponse.json({
        success: true,
        aggregated: 0,
        message: "集計可能な評価がありません",
      })
    }

    // 一括更新
    await prisma.employeeEvaluation.updateMany({
      where: {
        id: { in: collectedEvaluations.map((e) => e.id) },
      },
      data: {
        status: "AGGREGATING",
      },
    })

    return NextResponse.json({
      success: true,
      aggregated: collectedEvaluations.length,
      message: `${collectedEvaluations.length}件を集計に移行しました`,
    })
  } catch (error) {
    console.error("一括集計エラー:", error)
    return NextResponse.json(
      { error: "一括集計に失敗しました" },
      { status: 500 }
    )
  }
}
