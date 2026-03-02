import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// PATCH: 評価項目を更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; evaluationId: string; itemId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { itemId } = await params
    const body = await request.json()
    const { name, description, category, maxScore, weight } = body

    // 評価項目を取得
    const item = await prisma.employeeEvaluationItem.findUnique({
      where: { id: itemId },
      include: { evaluationTemplateItem: true },
    })

    if (!item) {
      return NextResponse.json(
        { error: "評価項目が見つかりません" },
        { status: 404 }
      )
    }

    // テンプレート項目を更新
    const updatedTemplateItem = await prisma.evaluationTemplateItem.update({
      where: { id: item.evaluationTemplateItemId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(maxScore !== undefined && { maxScore }),
        ...(weight !== undefined && { weight }),
      },
    })

    // 更新された項目を返す
    const updatedItem = await prisma.employeeEvaluationItem.findUnique({
      where: { id: itemId },
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

    return NextResponse.json({ item: updatedItem })
  } catch (error) {
    console.error("評価項目更新エラー:", error)
    return NextResponse.json(
      { error: "評価項目の更新に失敗しました" },
      { status: 500 }
    )
  }
}

// DELETE: 評価項目を削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; evaluationId: string; itemId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { itemId } = await params

    // 評価項目を取得
    const item = await prisma.employeeEvaluationItem.findUnique({
      where: { id: itemId },
    })

    if (!item) {
      return NextResponse.json(
        { error: "評価項目が見つかりません" },
        { status: 404 }
      )
    }

    // 評価項目を削除
    await prisma.employeeEvaluationItem.delete({
      where: { id: itemId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("評価項目削除エラー:", error)
    return NextResponse.json(
      { error: "評価項目の削除に失敗しました" },
      { status: 500 }
    )
  }
}
