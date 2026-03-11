import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { randomBytes, createHash } from "crypto"
import { sendIndividualEvaluatorNotificationEmail, APP_URL } from "@/lib/email"

/**
 * 自己評価提出API（認証不要）
 * POST: 自己評価を提出し、上司に通知メールを送信
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // トークンを検証
    const accessToken = await prisma.individualEvaluationAccessToken.findUnique({
      where: { token },
      include: {
        employeeEvaluation: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                company: { select: { id: true, name: true } },
              },
            },
            evaluator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            items: true,
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

    // 自己評価トークンかチェック
    if (accessToken.type !== "self") {
      return NextResponse.json(
        { error: "このトークンでは自己評価を提出できません" },
        { status: 403 }
      )
    }

    const { employeeEvaluation } = accessToken
    const { employee, evaluator, items } = employeeEvaluation

    // 提出済みの場合は再提出不可
    if (employeeEvaluation.selfCompletedAt) {
      return NextResponse.json(
        { error: "すでに提出済みです" },
        { status: 400 }
      )
    }

    // 全ての項目にスコアが入力されているかチェック
    const unscoredItems = items.filter((item) => item.selfScore === null)
    if (unscoredItems.length > 0) {
      return NextResponse.json(
        {
          error: `未入力の項目が${unscoredItems.length}件あります`,
          unscoredCount: unscoredItems.length,
        },
        { status: 400 }
      )
    }

    // 評価期間情報を取得
    let period = null
    if (employeeEvaluation.evaluationPeriodId) {
      period = await prisma.evaluationPeriod.findUnique({
        where: { id: employeeEvaluation.evaluationPeriodId },
        select: { id: true, name: true },
      })
    }

    // 提出処理
    await prisma.$transaction(async (tx) => {
      // 自己評価完了日時を設定
      await tx.employeeEvaluation.update({
        where: { id: employeeEvaluation.id },
        data: {
          selfCompletedAt: new Date(),
        },
      })

      // トークンを使用済みにする
      await tx.individualEvaluationAccessToken.update({
        where: { id: accessToken.id },
        data: { usedAt: new Date() },
      })
    })

    // 評価者に通知メールを送信
    if (evaluator?.email) {
      // 同じ評価者が担当する他の評価を取得（自己評価完了済みのもの）
      const otherEvaluations = await prisma.employeeEvaluation.findMany({
        where: {
          evaluatorId: evaluator.id,
          evaluationPeriodId: employeeEvaluation.evaluationPeriodId,
          evaluationType: "individual",
          status: "DISTRIBUTED",
          selfCompletedAt: { not: null },
          evaluatorCompletedAt: null,
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      })

      // 評価者トークンが存在するかチェック
      const existingEvaluatorToken = await prisma.individualEvaluationAccessToken.findFirst({
        where: {
          employeeEvaluationId: employeeEvaluation.id,
          type: "evaluator",
          expiresAt: { gt: new Date() },
        },
      })

      let evaluatorToken: string
      let password: string

      if (existingEvaluatorToken) {
        evaluatorToken = existingEvaluatorToken.token
        // 既存のトークンがある場合、パスワードは再通知できないので新しく生成
        password = randomBytes(4).toString("hex").toUpperCase()
        const hashedPassword = createHash("sha256").update(password).digest("hex")

        await prisma.individualEvaluationAccessToken.update({
          where: { id: existingEvaluatorToken.id },
          data: { password: hashedPassword, rawPassword: password },
        })
      } else {
        // 新しい評価者トークンを生成
        evaluatorToken = randomBytes(32).toString("hex")
        password = randomBytes(4).toString("hex").toUpperCase()
        const hashedPassword = createHash("sha256").update(password).digest("hex")

        const expiresAt = employeeEvaluation.responseDeadline
          ? new Date(employeeEvaluation.responseDeadline)
          : new Date()
        expiresAt.setDate(expiresAt.getDate() + 14) // 2週間の猶予

        await prisma.individualEvaluationAccessToken.create({
          data: {
            token: evaluatorToken,
            employeeEvaluationId: employeeEvaluation.id,
            type: "evaluator",
            password: hashedPassword,
            rawPassword: password,
            expiresAt,
          },
        })
      }

      // 全ての対象者（今回提出した従業員を含む）
      const targetEmployees = [
        { name: `${employee.lastName} ${employee.firstName}` },
        ...otherEvaluations.map((e) => ({
          name: `${e.employee.lastName} ${e.employee.firstName}`,
        })),
      ]

      const deadline = employeeEvaluation.responseDeadline || new Date()
      const accessUrl = `${APP_URL}/public/evaluation/evaluator/${evaluatorToken}`

      await sendIndividualEvaluatorNotificationEmail({
        evaluatorName: `${evaluator.lastName} ${evaluator.firstName}`,
        evaluatorEmail: evaluator.email,
        targetEmployees,
        deadline,
        accessUrl,
        password,
        companyName: employee.company.name,
        periodName: period?.name || "評価期間",
      })
    }

    return NextResponse.json({
      success: true,
      message: "自己評価を提出しました",
    })
  } catch (error) {
    console.error("提出エラー:", error)
    return NextResponse.json(
      { error: "提出に失敗しました" },
      { status: 500 }
    )
  }
}
