import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 前期の評価項目をコピー
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, employeeId } = await params

    // 現在のレコードを取得
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
        { error: "評価項目のコピーは準備フェーズでのみ可能です" },
        { status: 400 }
      )
    }

    // 同一従業員の直前の評価期間を検索
    const previousRecord = await prisma.evaluation360Record.findFirst({
      where: {
        employeeId,
        companyId,
        evaluationPeriodId: { not: periodId },
        status: { in: ["aggregated", "completed"] }, // 完了済みのレコードのみ
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        evaluationPeriod: {
          select: { name: true },
        },
      },
    })

    if (!previousRecord) {
      return NextResponse.json(
        { error: "コピー元となる過去の評価レコードが見つかりません" },
        { status: 404 }
      )
    }

    // 前期のカスタム項目を取得
    const previousItems = await prisma.evaluationCustomItem.findMany({
      where: {
        employeeId,
        companyId,
        periodId: previousRecord.evaluationPeriodId,
        evaluationType: "360",
        isDeleted: false,
      },
      orderBy: [
        { categorySortOrder: "asc" },
        { sortOrder: "asc" },
      ],
    })

    if (previousItems.length === 0) {
      return NextResponse.json(
        { error: "コピー元の評価項目がありません" },
        { status: 400 }
      )
    }

    // トランザクションで既存の項目を削除して新規作成
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

      // 前期の項目をコピー
      const itemsToCreate = previousItems.map((item) => ({
        companyId,
        employeeId,
        periodId,
        evaluationType: "360",
        sourceTemplateItemId: item.sourceTemplateItemId,
        itemName: item.itemName,
        description: item.description,
        maxScore: item.maxScore,
        sortOrder: item.sortOrder,
        categoryName: item.categoryName,
        categorySortOrder: item.categorySortOrder,
        isCustomized: item.isCustomized,
        isAdded: item.isAdded,
        isDeleted: false,
      }))

      await tx.evaluationCustomItem.createMany({
        data: itemsToCreate,
      })

      // ステータスを preparing_items に変更
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

    const categories = Array.from(categoriesMap.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    )

    // 更新後のレコードを取得
    const updatedRecord = await prisma.evaluation360Record.findUnique({
      where: { id: record.id },
    })

    return NextResponse.json({
      success: true,
      copiedFrom: previousRecord.evaluationPeriod.name,
      record: {
        ...updatedRecord,
        categories,
      },
    })
  } catch (error) {
    console.error("評価項目コピーエラー:", error)
    return NextResponse.json(
      { error: "評価項目のコピーに失敗しました" },
      { status: 500 }
    )
  }
}
