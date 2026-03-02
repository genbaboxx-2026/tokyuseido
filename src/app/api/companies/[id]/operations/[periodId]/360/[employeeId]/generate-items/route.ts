import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: テンプレートから評価項目を生成
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

    // レコードを取得
    const record = await prisma.evaluation360Record.findUnique({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId,
        },
      },
      include: {
        employee: {
          select: {
            gradeId: true,
            jobTypeId: true,
          },
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
        { error: "評価項目の生成は準備フェーズでのみ可能です" },
        { status: 400 }
      )
    }

    const { gradeId, jobTypeId } = record.employee

    // 等級×職種に対応するテンプレートを検索
    let template = null

    if (gradeId && jobTypeId) {
      // 等級と職種の両方に紐づくテンプレートを検索
      template = await prisma.evaluation360Template.findFirst({
        where: {
          companyId,
          isActive: true,
          status: "confirmed",
          grades: {
            some: { gradeId },
          },
          jobTypes: {
            some: { jobTypeId },
          },
        },
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      })
    }

    // 見つからない場合は等級のみで検索
    if (!template && gradeId) {
      template = await prisma.evaluation360Template.findFirst({
        where: {
          companyId,
          isActive: true,
          status: "confirmed",
          grades: {
            some: { gradeId },
          },
        },
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      })
    }

    // さらに見つからない場合は会社のデフォルトテンプレートを検索
    if (!template) {
      template = await prisma.evaluation360Template.findFirst({
        where: {
          companyId,
          isActive: true,
          status: "confirmed",
        },
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      })
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

      if (template) {
        // テンプレートからカスタム項目を作成
        const itemsToCreate = template.categories.flatMap((category) =>
          category.items.map((item) => ({
            companyId,
            employeeId,
            periodId,
            evaluationType: "360",
            sourceTemplateItemId: item.id,
            itemName: item.content,
            description: null,
            maxScore: item.maxScore,
            sortOrder: item.sortOrder,
            categoryName: category.name,
            categorySortOrder: category.sortOrder,
            isCustomized: false,
            isAdded: false,
            isDeleted: false,
          }))
        )

        if (itemsToCreate.length > 0) {
          await tx.evaluationCustomItem.createMany({
            data: itemsToCreate,
          })
        }
      }

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
      templateUsed: template?.name || null,
      record: {
        ...updatedRecord,
        categories,
      },
    })
  } catch (error) {
    console.error("評価項目生成エラー:", error)
    return NextResponse.json(
      { error: "評価項目の生成に失敗しました" },
      { status: 500 }
    )
  }
}
