import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 準備完了者を一括配布（PREPARING → DISTRIBUTED）
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

    // PREPARING ステータスの評価を取得
    const preparingEvaluations = await prisma.employeeEvaluation.findMany({
      where: {
        evaluationPeriodId: periodId,
        evaluationType: "individual",
        status: "PREPARING",
      },
      include: {
        items: true,
      },
    })

    // 項目が設定されている評価のみ配布対象
    const evaluationsToDistribute = preparingEvaluations.filter(
      (e) => e.items.length > 0
    )

    if (evaluationsToDistribute.length === 0) {
      return NextResponse.json({
        success: true,
        distributed: 0,
        message: "配布可能な評価がありません",
      })
    }

    // 一括更新
    await prisma.employeeEvaluation.updateMany({
      where: {
        id: { in: evaluationsToDistribute.map((e) => e.id) },
      },
      data: {
        status: "DISTRIBUTED",
      },
    })

    return NextResponse.json({
      success: true,
      distributed: evaluationsToDistribute.length,
      message: `${evaluationsToDistribute.length}件を配布しました`,
    })
  } catch (error) {
    console.error("一括配布エラー:", error)
    return NextResponse.json(
      { error: "一括配布に失敗しました" },
      { status: 500 }
    )
  }
}
