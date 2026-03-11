import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"

/**
 * 評価者スコア保存API（認証不要、パスワード必要）
 * PUT: 評価者スコアを保存
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; employeeId: string }> }
) {
  try {
    const { token, employeeId } = await params
    const body = await request.json()
    const { password, scores, evaluatorComment } = body

    if (!password) {
      return NextResponse.json(
        { error: "パスワードが必要です" },
        { status: 401 }
      )
    }

    // トークンを検証
    const accessToken = await prisma.individualEvaluationAccessToken.findUnique({
      where: { token },
      include: {
        employeeEvaluation: {
          include: {
            evaluator: {
              select: { id: true },
            },
          },
        },
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

    // 評価者トークンかチェック
    if (accessToken.type !== "evaluator") {
      return NextResponse.json(
        { error: "無効なトークンタイプです" },
        { status: 403 }
      )
    }

    // パスワードをハッシュ化して比較
    const hashedPassword = createHash("sha256").update(password).digest("hex")

    if (accessToken.password !== hashedPassword) {
      return NextResponse.json(
        { error: "パスワードが正しくありません" },
        { status: 401 }
      )
    }

    const { evaluator } = accessToken.employeeEvaluation

    if (!evaluator) {
      return NextResponse.json(
        { error: "評価者が設定されていません" },
        { status: 400 }
      )
    }

    // 対象の評価を取得
    const evaluation = await prisma.employeeEvaluation.findFirst({
      where: {
        employeeId,
        evaluatorId: evaluator.id,
        evaluationPeriodId: accessToken.employeeEvaluation.evaluationPeriodId,
        evaluationType: "individual",
      },
    })

    if (!evaluation) {
      return NextResponse.json(
        { error: "評価が見つかりません" },
        { status: 404 }
      )
    }

    // 提出済みの場合は編集不可
    if (evaluation.evaluatorCompletedAt) {
      return NextResponse.json(
        { error: "提出済みの評価は編集できません" },
        { status: 400 }
      )
    }

    // トランザクションでスコアを更新
    await prisma.$transaction(async (tx) => {
      // 評価アイテムを更新
      if (scores && Array.isArray(scores)) {
        for (const scoreData of scores) {
          const { itemId, evaluatorScore, comment } = scoreData

          await tx.employeeEvaluationItem.update({
            where: { id: itemId },
            data: {
              evaluatorScore:
                evaluatorScore !== undefined ? evaluatorScore : undefined,
              comment: comment !== undefined ? comment : undefined,
            },
          })
        }
      }

      // コメントを更新
      if (evaluatorComment !== undefined) {
        await tx.employeeEvaluation.update({
          where: { id: evaluation.id },
          data: { evaluatorComment },
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: "保存しました",
    })
  } catch (error) {
    console.error("評価者スコア保存エラー:", error)
    return NextResponse.json(
      { error: "保存に失敗しました" },
      { status: 500 }
    )
  }
}
