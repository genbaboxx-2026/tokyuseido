import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"

/**
 * 評価者提出API（認証不要、パスワード必要）
 * POST: 評価を提出（COLLECTED状態に更新）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; employeeId: string }> }
) {
  try {
    const { token, employeeId } = await params
    const body = await request.json()
    const { password } = body

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
      include: {
        items: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!evaluation) {
      return NextResponse.json(
        { error: "評価が見つかりません" },
        { status: 404 }
      )
    }

    // 提出済みの場合は再提出不可
    if (evaluation.evaluatorCompletedAt) {
      return NextResponse.json(
        { error: "すでに提出済みです" },
        { status: 400 }
      )
    }

    // 全ての項目に評価者スコアが入力されているかチェック
    const unscoredItems = evaluation.items.filter(
      (item) => item.evaluatorScore === null
    )
    if (unscoredItems.length > 0) {
      return NextResponse.json(
        {
          error: `未入力の項目が${unscoredItems.length}件あります`,
          unscoredCount: unscoredItems.length,
        },
        { status: 400 }
      )
    }

    // 提出処理
    await prisma.employeeEvaluation.update({
      where: { id: evaluation.id },
      data: {
        evaluatorCompletedAt: new Date(),
        status: "COLLECTED",
      },
    })

    const employeeName = `${evaluation.employee.lastName} ${evaluation.employee.firstName}`

    return NextResponse.json({
      success: true,
      message: `${employeeName}さんの評価を提出しました`,
    })
  } catch (error) {
    console.error("評価者提出エラー:", error)
    return NextResponse.json(
      { error: "提出に失敗しました" },
      { status: 500 }
    )
  }
}
