/**
 * 個別評価の評価者API
 * GET /api/employees/[id]/evaluator-individual - 評価者取得
 * PUT /api/employees/[id]/evaluator-individual - 評価者更新
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * 評価者取得
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id } = await context.params

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { individualEvaluatorId: true },
    })

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      )
    }

    return NextResponse.json({ evaluatorId: employee.individualEvaluatorId })
  } catch (error) {
    console.error("評価者取得エラー:", error)
    return NextResponse.json(
      { error: "取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 評価者更新
 */
export async function PUT(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id } = await context.params
    const body = await request.json()
    const { evaluatorId } = body

    // evaluatorIdはstring | nullを許可
    if (evaluatorId !== null && typeof evaluatorId !== "string") {
      return NextResponse.json(
        { error: "evaluatorIdは文字列またはnullで指定してください" },
        { status: 400 }
      )
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { individualEvaluatorId: evaluatorId },
      select: { individualEvaluatorId: true },
    })

    return NextResponse.json({ evaluatorId: employee.individualEvaluatorId })
  } catch (error) {
    console.error("評価者更新エラー:", error)
    return NextResponse.json(
      { error: "更新に失敗しました" },
      { status: 500 }
    )
  }
}
