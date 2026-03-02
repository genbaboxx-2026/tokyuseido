import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const itemSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1, "項目内容は必須です"),
  maxScore: z.number().default(5),
  sortOrder: z.number().int().default(0),
})

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "カテゴリー名は必須です"),
  sortOrder: z.number().int().default(0),
  description: z.string().nullable().optional(),
  items: z.array(itemSchema),
})

const updateItemsSchema = z.object({
  categories: z.array(categorySchema),
})

// PUT: カテゴリーと項目の一括保存
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, employeeId } = await params
    const body = await request.json()

    const validationResult = updateItemsSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { categories } = validationResult.data

    // レコードを取得
    const record = await prisma.evaluation360Record.findUnique({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId,
        },
      },
    })

    if (!record) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      )
    }

    if (record.status !== "draft" && record.status !== "preparing_items") {
      return NextResponse.json(
        { error: "評価項目の編集は準備フェーズでのみ可能です" },
        { status: 400 }
      )
    }

    // トランザクションで全置換
    await prisma.$transaction(async (tx) => {
      // 既存のカスタム項目を削除
      await tx.evaluationCustomItem.deleteMany({
        where: {
          employeeId,
          companyId,
          periodId,
          evaluationType: "360",
        },
      })

      // 新しいカスタム項目を作成
      const itemsToCreate = categories.flatMap((category, catIdx) =>
        category.items
          .filter((item) => item.content && item.content.trim())
          .map((item, itemIdx) => ({
            companyId,
            employeeId,
            periodId,
            evaluationType: "360",
            sourceTemplateItemId: null,
            itemName: item.content,
            description: null,
            maxScore: item.maxScore,
            sortOrder: item.sortOrder ?? itemIdx,
            categoryName: category.name,
            categorySortOrder: category.sortOrder ?? catIdx,
            isCustomized: true,
            isAdded: false,
            isDeleted: false,
          }))
      )

      if (itemsToCreate.length > 0) {
        await tx.evaluationCustomItem.createMany({
          data: itemsToCreate,
        })
      }

      // ステータスを preparing_items に変更（draft の場合）
      if (record.status === "draft") {
        await tx.evaluation360Record.update({
          where: { id: record.id },
          data: { status: "preparing_items" },
        })
      }
    })

    // 更新後のカスタム項目を取得
    const customItems = await prisma.evaluationCustomItem.findMany({
      where: {
        employeeId,
        companyId,
        periodId,
        evaluationType: "360",
        isDeleted: false,
      },
      orderBy: [
        { categorySortOrder: "asc" },
        { sortOrder: "asc" },
      ],
    })

    // カテゴリごとにグループ化
    const categoriesMap = new Map<string, {
      id: string
      name: string
      sortOrder: number
      items: {
        id: string
        content: string
        maxScore: number
        sortOrder: number
      }[]
    }>()

    customItems.forEach((item) => {
      const categoryName = item.categoryName || "その他"
      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          id: `cat-${categoriesMap.size}`,
          name: categoryName,
          sortOrder: item.categorySortOrder || 0,
          items: [],
        })
      }
      categoriesMap.get(categoryName)!.items.push({
        id: item.id,
        content: item.itemName,
        maxScore: item.maxScore,
        sortOrder: item.sortOrder,
      })
    })

    const resultCategories = Array.from(categoriesMap.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    )

    // 更新後のレコードを取得
    const updatedRecord = await prisma.evaluation360Record.findUnique({
      where: { id: record.id },
    })

    return NextResponse.json({
      ...updatedRecord,
      categories: resultCategories,
    })
  } catch (error) {
    console.error("評価項目更新エラー:", error)
    return NextResponse.json(
      { error: "評価項目の更新に失敗しました" },
      { status: 500 }
    )
  }
}
