import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { randomBytes } from "crypto"
import { sendIndividualSelfEvaluationRequestEmail, APP_URL } from "@/lib/email"

// POST: 準備完了者を一括配布（PREPARING → DISTRIBUTED）
// メール送信 + トークン作成を含む完全な配布処理
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
    const body = await request.json().catch(() => ({}))
    const { responseDeadline } = body

    // 回答期限が指定されていない場合は2週間後をデフォルトに
    const deadline = responseDeadline
      ? new Date(responseDeadline)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    // 会社情報と評価期間を取得
    const [company, period] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }),
      prisma.evaluationPeriod.findUnique({
        where: { id: periodId },
        select: { name: true },
      }),
    ])

    if (!company || !period) {
      return NextResponse.json(
        { error: "会社または評価期間が見つかりません" },
        { status: 404 }
      )
    }

    // PREPARING ステータスの評価を取得
    const preparingEvaluations = await prisma.employeeEvaluation.findMany({
      where: {
        evaluationPeriodId: periodId,
        evaluationType: "individual",
        status: "PREPARING",
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
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
        emailSent: 0,
        message: "配布可能な評価がありません",
      })
    }

    const results = {
      distributed: 0,
      emailSent: 0,
      emailFailed: 0,
      errors: [] as string[],
    }

    // 各評価に対してトークンを生成し、メールを送信
    for (const evaluation of evaluationsToDistribute) {
      const employee = evaluation.employee

      // トークンを生成（64文字のランダム文字列）
      const token = randomBytes(32).toString("hex")
      const expiresAt = new Date(deadline)
      expiresAt.setDate(expiresAt.getDate() + 7) // 期限+7日の猶予

      // トランザクションで評価更新とトークン作成
      await prisma.$transaction(async (tx) => {
        // 既存のトークンを削除
        await tx.individualEvaluationAccessToken.deleteMany({
          where: {
            employeeEvaluationId: evaluation.id,
            type: "self",
          },
        })

        // 新しいトークンを作成
        await tx.individualEvaluationAccessToken.create({
          data: {
            token,
            employeeEvaluationId: evaluation.id,
            type: "self",
            expiresAt,
          },
        })

        // 評価を配布ステータスに更新
        await tx.employeeEvaluation.update({
          where: { id: evaluation.id },
          data: {
            status: "DISTRIBUTED",
            responseDeadline: deadline,
            distributedAt: new Date(),
          },
        })
      })

      results.distributed++

      // メール送信
      if (employee.email) {
        const accessUrl = `${APP_URL}/public/evaluation/${token}`
        const emailResult = await sendIndividualSelfEvaluationRequestEmail({
          employeeName: `${employee.lastName} ${employee.firstName}`,
          employeeEmail: employee.email,
          deadline,
          accessUrl,
          companyName: company.name,
          periodName: period.name,
        })

        if (emailResult.success) {
          results.emailSent++
        } else {
          results.emailFailed++
          results.errors.push(
            `${employee.lastName}${employee.firstName}: ${emailResult.error}`
          )
        }
      } else {
        results.errors.push(
          `${employee.lastName}${employee.firstName}: メールアドレスが未設定`
        )
      }
    }

    return NextResponse.json({
      success: true,
      distributed: results.distributed,
      emailSent: results.emailSent,
      message: `${results.distributed}件を配布しました（メール送信: ${results.emailSent}件）`,
      results,
    })
  } catch (error) {
    console.error("一括配布エラー:", error)
    return NextResponse.json(
      { error: "一括配布に失敗しました" },
      { status: 500 }
    )
  }
}
