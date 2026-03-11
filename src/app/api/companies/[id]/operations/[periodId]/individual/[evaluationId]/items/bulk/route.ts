import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

interface ItemData {
  id?: string
  name: string
  maxScore: number
}

// PUT: 評価項目を一括保存（既存の項目を置換）
export async function PUT(
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
    const { items } = body as { items: ItemData[] }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "itemsは配列で指定してください" },
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

    // トランザクションで既存の項目を削除して新しい項目を作成
    await prisma.$transaction(async (tx) => {
      // 既存の評価項目を取得
      const existingItems = await tx.employeeEvaluationItem.findMany({
        where: { employeeEvaluationId: evaluationId },
        include: { evaluationTemplateItem: true },
      })

      // 既存の評価項目を削除
      await tx.employeeEvaluationItem.deleteMany({
        where: { employeeEvaluationId: evaluationId },
      })

      // 既存のテンプレート項目も削除（この評価専用に作成されたもの）
      // 注意: 共有テンプレート項目は削除しない
      const templateItemIds = existingItems.map((item) => item.evaluationTemplateItemId)
      if (templateItemIds.length > 0) {
        // この評価テンプレートに紐づく項目のみ削除
        await tx.evaluationTemplateItem.deleteMany({
          where: {
            id: { in: templateItemIds },
            evaluationTemplateId: evaluation.evaluationTemplateId,
          },
        })
      }

      // 新しいテンプレート項目と評価項目を作成
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item.name || item.name.trim() === "") continue

        // テンプレート項目を作成
        const templateItem = await tx.evaluationTemplateItem.create({
          data: {
            evaluationTemplateId: evaluation.evaluationTemplateId,
            name: item.name,
            description: null,
            category: "一般",
            maxScore: item.maxScore,
            weight: 1.0,
            sortOrder: i,
          },
        })

        // 評価項目を作成
        await tx.employeeEvaluationItem.create({
          data: {
            employeeEvaluationId: evaluationId,
            evaluationTemplateItemId: templateItem.id,
          },
        })
      }

      // ステータスを更新（項目が設定されたらPREPARINGに）
      if (items.length > 0 && evaluation.status === "STARTED") {
        await tx.employeeEvaluation.update({
          where: { id: evaluationId },
          data: { status: "PREPARING" },
        })
      }
    })

    return NextResponse.json({ success: true, message: "保存しました" })
  } catch (error) {
    console.error("評価項目一括保存エラー:", error)
    return NextResponse.json(
      { error: "評価項目の保存に失敗しました" },
      { status: 500 }
    )
  }
}
