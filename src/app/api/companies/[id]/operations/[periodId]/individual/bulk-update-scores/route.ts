import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

interface ScoreUpdate {
  evaluationId: string
  itemId: string
  evaluatorScore: number | null
  evaluatorComment: string | null
}

// POST: 複数の評価項目スコアを一括更新
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
    const body = await request.json()
    const { updates } = body as { updates: ScoreUpdate[] }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "更新データが必要です" },
        { status: 400 }
      )
    }

    // 一括更新を実行
    const results = await Promise.all(
      updates.map(async (update) => {
        return prisma.employeeEvaluationItem.update({
          where: { id: update.itemId },
          data: {
            evaluatorScore: update.evaluatorScore,
            comment: update.evaluatorComment,
          },
        })
      })
    )

    // 各評価のevaluatorCompletedAtを更新（全項目にスコアが入っている場合）
    const evaluationIds = [...new Set(updates.map((u) => u.evaluationId))]

    for (const evaluationId of evaluationIds) {
      const evaluation = await prisma.employeeEvaluation.findUnique({
        where: { id: evaluationId },
        include: { items: true },
      })

      if (evaluation) {
        const allItemsScored = evaluation.items.every(
          (item) => item.evaluatorScore !== null
        )

        if (allItemsScored && !evaluation.evaluatorCompletedAt) {
          await prisma.employeeEvaluation.update({
            where: { id: evaluationId },
            data: { evaluatorCompletedAt: new Date() },
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: results.length,
      message: `${results.length}件のスコアを更新しました`,
    })
  } catch (error) {
    console.error("スコア一括更新エラー:", error)
    return NextResponse.json(
      { error: "スコアの更新に失敗しました" },
      { status: 500 }
    )
  }
}
