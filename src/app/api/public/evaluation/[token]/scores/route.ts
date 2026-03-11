import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 自己評価スコア保存API（認証不要）
 * PUT: スコアを保存
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { scores, selfComment } = body

    // トークンを検証
    const accessToken = await prisma.individualEvaluationAccessToken.findUnique({
      where: { token },
      include: {
        employeeEvaluation: true,
      },
    })

    if (!accessToken) {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 404 }
      )
    }

    // トークンの有効期限をチェック
    if (accessToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "このリンクは期限切れです" },
        { status: 410 }
      )
    }

    // 自己評価トークンかチェック
    if (accessToken.type !== "self") {
      return NextResponse.json(
        { error: "このトークンでは自己評価を保存できません" },
        { status: 403 }
      )
    }

    // 提出済みの場合は編集不可
    if (accessToken.employeeEvaluation.selfCompletedAt) {
      return NextResponse.json(
        { error: "提出済みの評価は編集できません" },
        { status: 400 }
      )
    }

    const evaluationId = accessToken.employeeEvaluationId

    // トランザクションでスコアを更新
    await prisma.$transaction(async (tx) => {
      // 評価アイテムを更新
      if (scores && Array.isArray(scores)) {
        for (const scoreData of scores) {
          const { itemId, selfScore, comment } = scoreData

          await tx.employeeEvaluationItem.update({
            where: { id: itemId },
            data: {
              selfScore: selfScore !== undefined ? selfScore : undefined,
              comment: comment !== undefined ? comment : undefined,
            },
          })
        }
      }

      // コメントを更新
      if (selfComment !== undefined) {
        await tx.employeeEvaluation.update({
          where: { id: evaluationId },
          data: { selfComment },
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: "保存しました",
    })
  } catch (error) {
    console.error("スコア保存エラー:", error)
    return NextResponse.json(
      { error: "保存に失敗しました" },
      { status: 500 }
    )
  }
}
