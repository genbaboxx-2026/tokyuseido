import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

interface EvaluatorTokenInfo {
  evaluatorId: string
  evaluatorName: string
  token: string | null
  maskedPassword: string | null
  rawPassword: string | null
  employeeCount: number
  collectionRate: {
    selfCompleted: number
    evaluatorCompleted: number
    total: number
  }
  url: string | null
  employees: Array<{
    id: string
    name: string
    selfCompleted: boolean
    evaluatorCompleted: boolean
  }>
}

// GET: 評価者ごとのトークン・パスワード・回収率を返す
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await params

    // DISTRIBUTED または COLLECTED 状態の個別評価を取得
    const evaluations = await prisma.employeeEvaluation.findMany({
      where: {
        evaluationPeriodId: periodId,
        evaluationType: "individual",
        status: {
          in: ["DISTRIBUTED", "COLLECTED"],
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        accessTokens: {
          where: {
            type: "evaluator",
          },
          select: {
            token: true,
            password: true,
            rawPassword: true,
          },
        },
      },
    })

    // evaluatorIdでグループ化
    const evaluatorMap = new Map<string, {
      evaluator: { id: string; firstName: string; lastName: string }
      evaluations: typeof evaluations
    }>()

    for (const evaluation of evaluations) {
      if (!evaluation.evaluator) continue

      const evaluatorId = evaluation.evaluator.id
      if (!evaluatorMap.has(evaluatorId)) {
        evaluatorMap.set(evaluatorId, {
          evaluator: evaluation.evaluator,
          evaluations: [],
        })
      }
      evaluatorMap.get(evaluatorId)!.evaluations.push(evaluation)
    }

    // 評価者ごとの情報をフォーマット
    const evaluators: EvaluatorTokenInfo[] = []

    for (const [evaluatorId, data] of evaluatorMap) {
      const { evaluator, evaluations: evals } = data

      // 評価者用のトークン（最初の評価のものを使用）
      const accessToken = evals.find(e => e.accessTokens.length > 0)?.accessTokens[0]

      // 回収率を計算
      const selfCompletedCount = evals.filter(e => e.selfCompletedAt !== null).length
      const evaluatorCompletedCount = evals.filter(e => e.evaluatorCompletedAt !== null).length

      // パスワードのマスク処理（最初の5文字 + ...）
      let maskedPassword: string | null = null
      if (accessToken?.rawPassword) {
        const pwd = accessToken.rawPassword
        maskedPassword = pwd.length > 5 ? pwd.slice(0, 5) + "..." : pwd
      }

      // URL を生成
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      const url = accessToken?.token
        ? `${baseUrl}/public/evaluation/evaluator/${accessToken.token}`
        : null

      // 担当従業員リスト
      const employees = evals.map(e => ({
        id: e.employee.id,
        name: `${e.employee.lastName} ${e.employee.firstName}`,
        selfCompleted: e.selfCompletedAt !== null,
        evaluatorCompleted: e.evaluatorCompletedAt !== null,
      }))

      evaluators.push({
        evaluatorId,
        evaluatorName: `${evaluator.lastName} ${evaluator.firstName}`,
        token: accessToken?.token || null,
        maskedPassword,
        rawPassword: accessToken?.rawPassword || null,
        employeeCount: evals.length,
        collectionRate: {
          selfCompleted: selfCompletedCount,
          evaluatorCompleted: evaluatorCompletedCount,
          total: evals.length,
        },
        url,
        employees,
      })
    }

    // 評価者名でソート
    evaluators.sort((a, b) => a.evaluatorName.localeCompare(b.evaluatorName, "ja"))

    return NextResponse.json({ evaluators })
  } catch (error) {
    console.error("評価者トークン一覧取得エラー:", error)
    return NextResponse.json(
      { error: "評価者トークンの取得に失敗しました" },
      { status: 500 }
    )
  }
}
