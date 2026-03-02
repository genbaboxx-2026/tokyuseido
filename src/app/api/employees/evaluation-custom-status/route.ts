/**
 * 従業員の評価項目カスタムステータス一括取得API
 * GET /api/employees/evaluation-custom-status?companyId=xxx
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    if (!companyId) {
      return NextResponse.json(
        { error: "companyIdが必要です" },
        { status: 400 }
      )
    }

    // 会社の従業員を取得
    const employees = await prisma.employee.findMany({
      where: { companyId, status: "ACTIVE" },
      select: { id: true },
    })

    const employeeIds = employees.map((e) => e.id)

    // カスタム評価項目を持つ従業員を検索
    const customEvaluations = await prisma.employeeEvaluation.findMany({
      where: {
        employeeId: { in: employeeIds },
        evaluationType: "custom_items",
        evaluatorComment: { not: null },
      },
      select: {
        employeeId: true,
        evaluatorComment: true,
      },
      distinct: ["employeeId"],
    })

    // カスタム評価項目があるかどうかのマップを作成
    const customStatusMap: Record<string, boolean> = {}

    for (const evaluation of customEvaluations) {
      if (evaluation.evaluatorComment) {
        try {
          const items = JSON.parse(evaluation.evaluatorComment)
          // 配列で1つ以上の項目があればカスタム
          if (Array.isArray(items) && items.length > 0) {
            customStatusMap[evaluation.employeeId] = true
          }
        } catch {
          // JSONパースエラーは無視
        }
      }
    }

    return NextResponse.json(customStatusMap)
  } catch (error) {
    console.error("カスタムステータス取得エラー:", error)
    return NextResponse.json(
      { error: "取得に失敗しました" },
      { status: 500 }
    )
  }
}
