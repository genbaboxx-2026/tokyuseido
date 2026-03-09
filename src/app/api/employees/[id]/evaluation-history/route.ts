import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET: 従業員の評価履歴を取得
 * 360度評価と個別評価の両方を取得し、期間ごとにまとめて返す
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: employeeId } = await params

    // 従業員の存在確認
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, companyId: true },
    })

    if (!employee) {
      return NextResponse.json({ error: "従業員が見つかりません" }, { status: 404 })
    }

    // 360度評価の履歴を取得
    const evaluation360Records = await prisma.evaluation360Record.findMany({
      where: { employeeId },
      include: {
        evaluationPeriod: {
          select: {
            id: true,
            name: true,
            periodType: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { evaluationPeriod: { startDate: "desc" } },
    })

    // 個別評価の履歴を取得
    const individualEvaluations = await prisma.individualEvaluation.findMany({
      where: { employeeId },
      include: {
        evaluationPeriod: {
          select: {
            id: true,
            name: true,
            periodType: true,
            startDate: true,
            endDate: true,
          },
        },
        evaluator: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { evaluationPeriod: { startDate: "desc" } },
    })

    // 評価履歴をまとめる
    const history = []

    // 360度評価
    for (const record of evaluation360Records) {
      history.push({
        id: record.id,
        type: "360" as const,
        periodId: record.evaluationPeriod.id,
        periodName: record.evaluationPeriod.name,
        periodType: record.evaluationPeriod.periodType,
        startDate: record.evaluationPeriod.startDate,
        endDate: record.evaluationPeriod.endDate,
        status: record.status,
        averageScore: null, // 360度評価の平均スコアは別途集計が必要
        finalRating: null,
        evaluatorName: null,
      })
    }

    // 個別評価
    for (const evaluation of individualEvaluations) {
      history.push({
        id: evaluation.id,
        type: "individual" as const,
        periodId: evaluation.evaluationPeriod.id,
        periodName: evaluation.evaluationPeriod.name,
        periodType: evaluation.evaluationPeriod.periodType,
        startDate: evaluation.evaluationPeriod.startDate,
        endDate: evaluation.evaluationPeriod.endDate,
        status: evaluation.status,
        averageScore: evaluation.totalScore,
        finalRating: evaluation.finalRating,
        evaluatorName: evaluation.evaluator.name,
      })
    }

    // 日付順でソート（新しい順）
    history.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

    return NextResponse.json({ history })
  } catch (error) {
    console.error("評価履歴取得エラー:", error)
    return NextResponse.json(
      { error: "評価履歴の取得に失敗しました" },
      { status: 500 }
    )
  }
}
