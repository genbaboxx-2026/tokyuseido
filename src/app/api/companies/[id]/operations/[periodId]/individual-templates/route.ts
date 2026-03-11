import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getPeriodTemplates,
  createPeriodTemplateFromMaster,
} from "@/lib/evaluation-template"
import { prisma } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string; periodId: string }>
}

// GET: 期間固有テンプレート一覧を取得
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await context.params

    // 期間の存在と権限確認
    const period = await prisma.evaluationPeriod.findFirst({
      where: {
        id: periodId,
        companyId,
      },
    })

    if (!period) {
      return NextResponse.json(
        { error: "評価期間が見つかりません" },
        { status: 404 }
      )
    }

    const templates = await getPeriodTemplates(periodId)

    return NextResponse.json({ templates })
  } catch (error) {
    console.error("期間固有テンプレート一覧取得エラー:", error)
    return NextResponse.json(
      { error: "テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}

// POST: マスターテンプレートから期間固有テンプレートを作成
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await context.params
    const body = await request.json()

    // 期間の存在と権限確認
    const period = await prisma.evaluationPeriod.findFirst({
      where: {
        id: periodId,
        companyId,
      },
    })

    if (!period) {
      return NextResponse.json(
        { error: "評価期間が見つかりません" },
        { status: 404 }
      )
    }

    const { sourceTemplateId } = body

    if (!sourceTemplateId) {
      return NextResponse.json(
        { error: "ソーステンプレートIDが必要です" },
        { status: 400 }
      )
    }

    // マスターテンプレートの会社確認
    const sourceTemplate = await prisma.evaluationTemplate.findUnique({
      where: { id: sourceTemplateId },
      include: {
        gradeJobTypeConfig: {
          include: {
            grade: { select: { companyId: true } },
          },
        },
      },
    })

    if (!sourceTemplate) {
      return NextResponse.json(
        { error: "ソーステンプレートが見つかりません" },
        { status: 404 }
      )
    }

    if (sourceTemplate.gradeJobTypeConfig?.grade.companyId !== companyId) {
      return NextResponse.json(
        { error: "この会社のテンプレートではありません" },
        { status: 403 }
      )
    }

    const template = await createPeriodTemplateFromMaster(periodId, sourceTemplateId)

    return NextResponse.json({
      template,
      message: "期間固有テンプレートを作成しました",
    })
  } catch (error) {
    console.error("期間固有テンプレート作成エラー:", error)
    const message = error instanceof Error ? error.message : "テンプレートの作成に失敗しました"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
