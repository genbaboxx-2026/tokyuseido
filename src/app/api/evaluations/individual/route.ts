import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { individualEvaluationCreateSchema } from "@/lib/evaluation/schemas"

// GET: 個別評価一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const evaluationPeriodId = searchParams.get("evaluationPeriodId")
    const employeeId = searchParams.get("employeeId")
    const evaluatorId = searchParams.get("evaluatorId")
    const status = searchParams.get("status")

    const where: {
      evaluationPeriodId?: string
      employeeId?: string
      evaluatorId?: string
      status?: "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
    } = {}

    if (evaluationPeriodId) where.evaluationPeriodId = evaluationPeriodId
    if (employeeId) where.employeeId = employeeId
    if (evaluatorId) where.evaluatorId = evaluatorId
    if (status) where.status = status as "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"

    const evaluations = await prisma.individualEvaluation.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        evaluationPeriod: {
          select: { id: true, name: true, periodType: true, status: true },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { id: true, name: true } },
            grade: { select: { id: true, name: true } },
          },
        },
        evaluator: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { scores: true },
        },
      },
    })

    return NextResponse.json(evaluations)
  } catch (error) {
    console.error("個別評価一覧取得エラー:", error)
    return NextResponse.json({ error: "個別評価一覧の取得に失敗しました" }, { status: 500 })
  }
}

// POST: 個別評価作成
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = individualEvaluationCreateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { evaluationPeriodId, employeeId, evaluatorId } = validationResult.data

    // 評価期間の存在確認
    const period = await prisma.evaluationPeriod.findUnique({
      where: { id: evaluationPeriodId },
    })

    if (!period) {
      return NextResponse.json({ error: "評価期間が見つかりません" }, { status: 404 })
    }

    // 従業員の存在確認
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    })

    if (!employee) {
      return NextResponse.json({ error: "従業員が見つかりません" }, { status: 404 })
    }

    // 評価者の存在確認
    const evaluator = await prisma.user.findUnique({
      where: { id: evaluatorId },
    })

    if (!evaluator) {
      return NextResponse.json({ error: "評価者が見つかりません" }, { status: 404 })
    }

    // 同一期間・同一従業員・同一評価者の重複チェック
    const existingEvaluation = await prisma.individualEvaluation.findFirst({
      where: {
        evaluationPeriodId,
        employeeId,
        evaluatorId,
      },
    })

    if (existingEvaluation) {
      return NextResponse.json(
        { error: "この評価期間・従業員・評価者の組み合わせは既に存在します" },
        { status: 400 }
      )
    }

    const evaluation = await prisma.individualEvaluation.create({
      data: {
        evaluationPeriodId,
        employeeId,
        evaluatorId,
        status: "STARTED",
      },
      include: {
        evaluationPeriod: {
          select: { id: true, name: true },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        evaluator: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(evaluation, { status: 201 })
  } catch (error) {
    console.error("個別評価作成エラー:", error)
    return NextResponse.json({ error: "個別評価の作成に失敗しました" }, { status: 500 })
  }
}
