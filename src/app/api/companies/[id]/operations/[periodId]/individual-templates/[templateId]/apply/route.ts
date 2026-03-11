import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { applyPeriodTemplateToEmployees } from "@/lib/evaluation-template"
import { prisma } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string; periodId: string; templateId: string }>
}

// POST: 期間固有テンプレートを従業員評価に反映
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, templateId } = await context.params
    const body = await request.json()

    // テンプレートの存在確認
    const template = await prisma.periodEvaluationTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    // 期間の会社確認
    const period = await prisma.evaluationPeriod.findFirst({
      where: {
        id: periodId,
        companyId,
      },
    })

    if (!period || template.periodId !== periodId) {
      return NextResponse.json(
        { error: "この評価期間のテンプレートではありません" },
        { status: 403 }
      )
    }

    const { employeeIds, overwrite = false } = body

    const result = await applyPeriodTemplateToEmployees(templateId, {
      employeeIds,
      overwrite,
    })

    return NextResponse.json({
      success: true,
      appliedCount: result.appliedCount,
      skippedCount: result.skippedCount,
      message: `${result.appliedCount}名の従業員に反映しました`,
      details: result.details,
    })
  } catch (error) {
    console.error("テンプレート反映エラー:", error)
    const message = error instanceof Error ? error.message : "反映に失敗しました"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
