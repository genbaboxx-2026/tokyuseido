import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET: 評価項目一覧を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; evaluationId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { evaluationId } = await params

    const items = await prisma.employeeEvaluationItem.findMany({
      where: { employeeEvaluationId: evaluationId },
      include: {
        evaluationTemplateItem: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            maxScore: true,
            weight: true,
            sortOrder: true,
          },
        },
      },
      orderBy: {
        evaluationTemplateItem: {
          sortOrder: "asc",
        },
      },
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error("評価項目取得エラー:", error)
    return NextResponse.json(
      { error: "評価項目の取得に失敗しました" },
      { status: 500 }
    )
  }
}

// POST: 新しい評価項目を追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; evaluationId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { evaluationId } = await params
    const body = await request.json()
    const { name, description, category, maxScore = 5, weight = 1.0 } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: "項目名とカテゴリは必須です" },
        { status: 400 }
      )
    }

    // 評価が存在するか確認
    const evaluation = await prisma.employeeEvaluation.findUnique({
      where: { id: evaluationId },
      include: { evaluationTemplate: true },
    })

    if (!evaluation) {
      return NextResponse.json(
        { error: "評価が見つかりません" },
        { status: 404 }
      )
    }

    // 新しいテンプレート項目を作成（カスタム項目として）
    const templateItem = await prisma.evaluationTemplateItem.create({
      data: {
        evaluationTemplateId: evaluation.evaluationTemplateId,
        name,
        description: description || null,
        category,
        maxScore,
        weight,
        sortOrder: 9999, // カスタム項目は最後に
      },
    })

    // 評価項目を作成
    const item = await prisma.employeeEvaluationItem.create({
      data: {
        employeeEvaluationId: evaluationId,
        evaluationTemplateItemId: templateItem.id,
      },
      include: {
        evaluationTemplateItem: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            maxScore: true,
            weight: true,
            sortOrder: true,
          },
        },
      },
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error("評価項目追加エラー:", error)
    return NextResponse.json(
      { error: "評価項目の追加に失敗しました" },
      { status: 500 }
    )
  }
}
