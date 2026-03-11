import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"

/**
 * 評価者パスワード検証API（認証不要）
 * POST: パスワードを検証
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json(
        { error: "パスワードを入力してください" },
        { status: 400 }
      )
    }

    // トークンを検証
    const accessToken = await prisma.individualEvaluationAccessToken.findUnique({
      where: { token },
      include: {
        employeeEvaluation: {
          include: {
            evaluator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
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

    return NextResponse.json({
      success: true,
      evaluator: evaluator
        ? {
            id: evaluator.id,
            firstName: evaluator.firstName,
            lastName: evaluator.lastName,
          }
        : null,
    })
  } catch (error) {
    console.error("パスワード検証エラー:", error)
    return NextResponse.json(
      { error: "検証に失敗しました" },
      { status: 500 }
    )
  }
}
