import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getPeriodTemplateDetail,
  updatePeriodTemplate,
  deletePeriodTemplate,
} from "@/lib/evaluation-template"
import { prisma } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string; periodId: string; templateId: string }>
}

// GET: 期間固有テンプレート詳細を取得
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, templateId } = await context.params

    // テンプレートの存在確認
    const template = await getPeriodTemplateDetail(templateId)

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

    return NextResponse.json(template)
  } catch (error) {
    console.error("期間固有テンプレート詳細取得エラー:", error)
    return NextResponse.json(
      { error: "テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}

// PUT: 期間固有テンプレートを更新
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, templateId } = await context.params
    const body = await request.json()

    // テンプレートの存在確認
    const existing = await prisma.periodEvaluationTemplate.findUnique({
      where: { id: templateId },
    })

    if (!existing) {
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

    if (!period || existing.periodId !== periodId) {
      return NextResponse.json(
        { error: "この評価期間のテンプレートではありません" },
        { status: 403 }
      )
    }

    const { name, description, status, items } = body

    const updated = await updatePeriodTemplate(templateId, {
      name,
      description,
      status,
      items,
    })

    return NextResponse.json({
      template: updated,
      message: "テンプレートを更新しました",
    })
  } catch (error) {
    console.error("期間固有テンプレート更新エラー:", error)
    const message = error instanceof Error ? error.message : "テンプレートの更新に失敗しました"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: 期間固有テンプレートを削除
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, templateId } = await context.params

    // テンプレートの存在確認
    const existing = await prisma.periodEvaluationTemplate.findUnique({
      where: { id: templateId },
    })

    if (!existing) {
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

    if (!period || existing.periodId !== periodId) {
      return NextResponse.json(
        { error: "この評価期間のテンプレートではありません" },
        { status: 403 }
      )
    }

    await deletePeriodTemplate(templateId)

    return NextResponse.json({
      message: "テンプレートを削除しました",
    })
  } catch (error) {
    console.error("期間固有テンプレート削除エラー:", error)
    return NextResponse.json(
      { error: "テンプレートの削除に失敗しました" },
      { status: 500 }
    )
  }
}
