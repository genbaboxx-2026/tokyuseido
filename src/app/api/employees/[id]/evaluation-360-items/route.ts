import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 個人の360度評価項目を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params

    // 従業員の個人360度評価項目を取得
    const employee360Items = await prisma.employee360EvaluationItem.findMany({
      where: { employeeId },
      orderBy: [{ categoryOrder: "asc" }, { itemOrder: "asc" }],
    })

    if (employee360Items.length === 0) {
      return NextResponse.json({ categories: [] })
    }

    // カテゴリごとにグループ化
    const categoriesMap = new Map<
      string,
      {
        id: string
        name: string
        sortOrder: number
        items: Array<{
          id: string
          content: string
          maxScore: number
          sortOrder: number
        }>
      }
    >()

    let categoryIndex = 0
    employee360Items.forEach((item) => {
      const categoryKey = item.categoryName
      if (!categoriesMap.has(categoryKey)) {
        categoriesMap.set(categoryKey, {
          id: `cat-${categoryIndex++}-${Date.now()}`,
          name: item.categoryName,
          sortOrder: item.categoryOrder,
          items: [],
        })
      }
      categoriesMap.get(categoryKey)!.items.push({
        id: item.id,
        content: item.content,
        maxScore: item.maxScore,
        sortOrder: item.itemOrder,
      })
    })

    const categories = Array.from(categoriesMap.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    )

    return NextResponse.json({ categories })
  } catch (error) {
    console.error("個人360度評価項目取得エラー:", error)
    return NextResponse.json(
      { error: "個人360度評価項目の取得に失敗しました" },
      { status: 500 }
    )
  }
}

// 個人の360度評価項目を保存
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params
    const body = await request.json()
    const { categories } = body

    if (!categories || !Array.isArray(categories)) {
      return NextResponse.json(
        { error: "カテゴリデータが不正です" },
        { status: 400 }
      )
    }

    // 従業員が存在するか確認
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    })

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      )
    }

    // 既存の項目を削除
    await prisma.employee360EvaluationItem.deleteMany({
      where: { employeeId },
    })

    // 新しい項目を作成
    const itemsToCreate: Array<{
      employeeId: string
      categoryName: string
      categoryOrder: number
      content: string
      maxScore: number
      itemOrder: number
    }> = []

    categories.forEach(
      (
        category: {
          name: string
          sortOrder: number
          items: Array<{ content: string; maxScore: number; sortOrder: number }>
        },
        catIdx: number
      ) => {
        if (category.items && Array.isArray(category.items)) {
          category.items.forEach((item, itemIdx) => {
            if (item.content && item.content.trim()) {
              itemsToCreate.push({
                employeeId,
                categoryName: category.name || `カテゴリ${catIdx + 1}`,
                categoryOrder: category.sortOrder ?? catIdx,
                content: item.content,
                maxScore: item.maxScore ?? 5,
                itemOrder: item.sortOrder ?? itemIdx,
              })
            }
          })
        }
      }
    )

    if (itemsToCreate.length > 0) {
      await prisma.employee360EvaluationItem.createMany({
        data: itemsToCreate,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("個人360度評価項目保存エラー:", error)
    const errorMessage = error instanceof Error ? error.message : "個人360度評価項目の保存に失敗しました"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
