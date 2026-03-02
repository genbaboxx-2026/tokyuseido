/**
 * 統合評価項目API（個別評価 / 360度評価共通）
 *
 * GET /api/companies/[id]/employees/[employeeId]/evaluation-items?periodId=xxx&type=individual|360
 *   - 従業員のカスタマイズ済み評価項目を取得
 *   - カスタマイズがなければテンプレートからコピーして初期化
 *
 * POST /api/companies/[id]/employees/[employeeId]/evaluation-items?periodId=xxx&type=individual|360
 *   - 評価項目を保存（全件置換）
 *
 * PUT /api/companies/[id]/employees/[employeeId]/evaluation-items?periodId=xxx&type=individual|360
 *   - 評価項目を部分更新（isDeleted, isCustomized フラグ更新など）
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  params: Promise<{ id: string; employeeId: string }>
}

type EvaluationType = "individual" | "360"

interface CategoryItem {
  id?: string
  sourceTemplateItemId?: string | null
  itemName: string
  description?: string | null
  maxScore: number
  sortOrder: number
  isCustomized?: boolean
  isAdded?: boolean
  isDeleted?: boolean
}

interface Category {
  name: string
  sortOrder: number
  items: CategoryItem[]
}

/**
 * 評価項目取得
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id: companyId, employeeId } = await context.params
    const searchParams = request.nextUrl.searchParams
    const periodId = searchParams.get("periodId")
    const type = searchParams.get("type") as EvaluationType | null

    if (!type || (type !== "individual" && type !== "360")) {
      return NextResponse.json(
        { error: "type パラメータは 'individual' または '360' を指定してください" },
        { status: 400 }
      )
    }

    // 従業員の存在確認
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        grade: true,
        jobType: true,
      },
    })

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      )
    }

    // 既存のカスタム項目を取得
    const existingItems = await prisma.evaluationCustomItem.findMany({
      where: {
        employeeId,
        companyId,
        periodId: periodId || undefined,
        evaluationType: type,
        isDeleted: false,
      },
      orderBy: [
        { categorySortOrder: "asc" },
        { sortOrder: "asc" },
      ],
    })

    // カスタム項目がある場合はそれを返す
    if (existingItems.length > 0) {
      if (type === "360") {
        // 360度評価はカテゴリ付きで返す
        const categoriesMap = new Map<string, Category>()

        existingItems.forEach((item) => {
          const categoryName = item.categoryName || "その他"
          if (!categoriesMap.has(categoryName)) {
            categoriesMap.set(categoryName, {
              name: categoryName,
              sortOrder: item.categorySortOrder || 0,
              items: [],
            })
          }
          categoriesMap.get(categoryName)!.items.push({
            id: item.id,
            sourceTemplateItemId: item.sourceTemplateItemId,
            itemName: item.itemName,
            description: item.description,
            maxScore: item.maxScore,
            sortOrder: item.sortOrder,
            isCustomized: item.isCustomized,
            isAdded: item.isAdded,
            isDeleted: item.isDeleted,
          })
        })

        const categories = Array.from(categoriesMap.values()).sort(
          (a, b) => a.sortOrder - b.sortOrder
        )

        return NextResponse.json({
          employeeId,
          periodId,
          type,
          isInitialized: true,
          categories,
        })
      } else {
        // 個別評価はフラットな配列で返す
        return NextResponse.json({
          employeeId,
          periodId,
          type,
          isInitialized: true,
          items: existingItems.map((item) => ({
            id: item.id,
            sourceTemplateItemId: item.sourceTemplateItemId,
            itemName: item.itemName,
            description: item.description,
            maxScore: item.maxScore,
            sortOrder: item.sortOrder,
            isCustomized: item.isCustomized,
            isAdded: item.isAdded,
            isDeleted: item.isDeleted,
          })),
        })
      }
    }

    // カスタム項目がない場合はテンプレートから初期化
    if (type === "360") {
      return await initializeFrom360Template(companyId, employeeId, periodId, employee)
    } else {
      return await initializeFromIndividualTemplate(companyId, employeeId, periodId, employee)
    }
  } catch (error) {
    console.error("評価項目取得エラー:", error)
    return NextResponse.json(
      { error: "評価項目の取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 360度テンプレートから初期化
 */
async function initializeFrom360Template(
  companyId: string,
  employeeId: string,
  periodId: string | null,
  employee: { gradeId: string | null; jobTypeId: string | null }
) {
  // 適用可能な360度テンプレートを取得
  const template = await prisma.evaluation360Template.findFirst({
    where: {
      companyId,
      isActive: true,
      status: "confirmed",
      grades: employee.gradeId ? {
        some: { gradeId: employee.gradeId },
      } : undefined,
      jobTypes: employee.jobTypeId ? {
        some: { jobTypeId: employee.jobTypeId },
      } : undefined,
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
    orderBy: { updatedAt: "desc" },
  })

  if (!template || template.categories.length === 0) {
    return NextResponse.json({
      employeeId,
      periodId,
      type: "360",
      isInitialized: false,
      categories: [],
      message: "適用可能な360度評価テンプレートがありません",
    })
  }

  // テンプレートからカスタム項目を作成
  const itemsToCreate = template.categories.flatMap((cat) =>
    cat.items.map((item) => ({
      companyId,
      employeeId,
      periodId,
      evaluationType: "360",
      sourceTemplateItemId: item.id,
      itemName: item.content,
      description: null,
      maxScore: item.maxScore,
      sortOrder: item.sortOrder,
      categoryName: cat.name,
      categorySortOrder: cat.sortOrder,
      isCustomized: false,
      isAdded: false,
      isDeleted: false,
    }))
  )

  await prisma.evaluationCustomItem.createMany({
    data: itemsToCreate,
  })

  // 作成した項目を取得して返す
  const createdItems = await prisma.evaluationCustomItem.findMany({
    where: {
      employeeId,
      companyId,
      periodId: periodId || undefined,
      evaluationType: "360",
    },
    orderBy: [
      { categorySortOrder: "asc" },
      { sortOrder: "asc" },
    ],
  })

  const categoriesMap = new Map<string, Category>()
  createdItems.forEach((item) => {
    const categoryName = item.categoryName || "その他"
    if (!categoriesMap.has(categoryName)) {
      categoriesMap.set(categoryName, {
        name: categoryName,
        sortOrder: item.categorySortOrder || 0,
        items: [],
      })
    }
    categoriesMap.get(categoryName)!.items.push({
      id: item.id,
      sourceTemplateItemId: item.sourceTemplateItemId,
      itemName: item.itemName,
      description: item.description,
      maxScore: item.maxScore,
      sortOrder: item.sortOrder,
      isCustomized: item.isCustomized,
      isAdded: item.isAdded,
      isDeleted: item.isDeleted,
    })
  })

  const categories = Array.from(categoriesMap.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder
  )

  return NextResponse.json({
    employeeId,
    periodId,
    type: "360",
    isInitialized: true,
    templateId: template.id,
    templateName: template.name,
    categories,
  })
}

/**
 * 個別評価テンプレートから初期化
 */
async function initializeFromIndividualTemplate(
  companyId: string,
  employeeId: string,
  periodId: string | null,
  employee: { gradeId: string | null; jobTypeId: string | null }
) {
  if (!employee.gradeId || !employee.jobTypeId) {
    return NextResponse.json({
      employeeId,
      periodId,
      type: "individual",
      isInitialized: false,
      items: [],
      message: "等級または職種が設定されていません",
    })
  }

  // GradeJobTypeConfigを検索
  const config = await prisma.gradeJobTypeConfig.findFirst({
    where: {
      gradeId: employee.gradeId,
      jobTypeId: employee.jobTypeId,
      isEnabled: true,
    },
  })

  if (!config) {
    return NextResponse.json({
      employeeId,
      periodId,
      type: "individual",
      isInitialized: false,
      items: [],
      message: "等級×職種の設定が見つかりません",
    })
  }

  // テンプレートを検索
  const template = await prisma.evaluationTemplate.findUnique({
    where: { gradeJobTypeConfigId: config.id },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  let itemsToCreate: {
    companyId: string
    employeeId: string
    periodId: string | null
    evaluationType: string
    sourceTemplateItemId: string | null
    itemName: string
    description: string | null
    maxScore: number
    sortOrder: number
    categoryName: string | null
    categorySortOrder: number | null
    isCustomized: boolean
    isAdded: boolean
    isDeleted: boolean
  }[] = []

  if (template && template.items.length > 0) {
    // テンプレートから項目を作成
    itemsToCreate = template.items.map((item) => ({
      companyId,
      employeeId,
      periodId,
      evaluationType: "individual",
      sourceTemplateItemId: item.id,
      itemName: item.name,
      description: item.description,
      maxScore: 5, // 個別評価のデフォルトスコア
      sortOrder: item.sortOrder,
      categoryName: null, // 個別評価はカテゴリなし
      categorySortOrder: null,
      isCustomized: false,
      isAdded: false,
      isDeleted: false,
    }))
  } else {
    // テンプレートがなければ役割責任から変換
    const role = await prisma.gradeRole.findUnique({
      where: { gradeJobTypeConfigId: config.id },
    })

    if (role?.responsibilities) {
      const responsibilities = role.responsibilities as string[]
      itemsToCreate = responsibilities.map((r, index) => {
        let converted = r
          .replace(/すること[。．]?$/, "できたか")
          .replace(/する[。．]?$/, "できたか")
          .replace(/を行う[。．]?$/, "を行えたか")
          .replace(/できる[。．]?$/, "できたか")
          .replace(/している[。．]?$/, "していたか")
          .replace(/を図る[。．]?$/, "を図れたか")
        if (!converted.endsWith("？") && !converted.endsWith("?")) {
          converted += "？"
        }
        return {
          companyId,
          employeeId,
          periodId,
          evaluationType: "individual",
          sourceTemplateItemId: null,
          itemName: converted,
          description: null,
          maxScore: 5,
          sortOrder: index,
          categoryName: null,
          categorySortOrder: null,
          isCustomized: false,
          isAdded: false,
          isDeleted: false,
        }
      })
    }
  }

  if (itemsToCreate.length === 0) {
    return NextResponse.json({
      employeeId,
      periodId,
      type: "individual",
      isInitialized: false,
      items: [],
      message: "評価項目テンプレートがありません",
    })
  }

  await prisma.evaluationCustomItem.createMany({
    data: itemsToCreate,
  })

  // 作成した項目を取得して返す
  const createdItems = await prisma.evaluationCustomItem.findMany({
    where: {
      employeeId,
      companyId,
      periodId: periodId || undefined,
      evaluationType: "individual",
    },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json({
    employeeId,
    periodId,
    type: "individual",
    isInitialized: true,
    templateId: template?.id,
    items: createdItems.map((item) => ({
      id: item.id,
      sourceTemplateItemId: item.sourceTemplateItemId,
      itemName: item.itemName,
      description: item.description,
      maxScore: item.maxScore,
      sortOrder: item.sortOrder,
      isCustomized: item.isCustomized,
      isAdded: item.isAdded,
      isDeleted: item.isDeleted,
    })),
  })
}

/**
 * 評価項目保存（全件置換）
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id: companyId, employeeId } = await context.params
    const searchParams = request.nextUrl.searchParams
    const periodId = searchParams.get("periodId")
    const type = searchParams.get("type") as EvaluationType | null

    if (!type || (type !== "individual" && type !== "360")) {
      return NextResponse.json(
        { error: "type パラメータは 'individual' または '360' を指定してください" },
        { status: 400 }
      )
    }

    const body = await request.json()

    // 従業員の存在確認
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    })

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      )
    }

    // 既存項目を削除
    await prisma.evaluationCustomItem.deleteMany({
      where: {
        employeeId,
        companyId,
        periodId: periodId || undefined,
        evaluationType: type,
      },
    })

    // 新しい項目を作成
    if (type === "360") {
      const { categories } = body as { categories: Category[] }

      if (!categories || !Array.isArray(categories)) {
        return NextResponse.json(
          { error: "categories が必要です" },
          { status: 400 }
        )
      }

      const itemsToCreate = categories.flatMap((cat, catIdx) =>
        cat.items
          .filter((item) => item.itemName && item.itemName.trim())
          .map((item, itemIdx) => ({
            companyId,
            employeeId,
            periodId,
            evaluationType: "360",
            sourceTemplateItemId: item.sourceTemplateItemId || null,
            itemName: item.itemName,
            description: item.description || null,
            maxScore: item.maxScore ?? 5,
            sortOrder: item.sortOrder ?? itemIdx,
            categoryName: cat.name || `カテゴリ${catIdx + 1}`,
            categorySortOrder: cat.sortOrder ?? catIdx,
            isCustomized: item.isCustomized ?? false,
            isAdded: item.isAdded ?? false,
            isDeleted: item.isDeleted ?? false,
          }))
      )

      if (itemsToCreate.length > 0) {
        await prisma.evaluationCustomItem.createMany({
          data: itemsToCreate,
        })
      }

      return NextResponse.json({ success: true, count: itemsToCreate.length })
    } else {
      const { items } = body as { items: CategoryItem[] }

      if (!items || !Array.isArray(items)) {
        return NextResponse.json(
          { error: "items が必要です" },
          { status: 400 }
        )
      }

      const itemsToCreate = items
        .filter((item) => item.itemName && item.itemName.trim())
        .map((item, idx) => ({
          companyId,
          employeeId,
          periodId,
          evaluationType: "individual",
          sourceTemplateItemId: item.sourceTemplateItemId || null,
          itemName: item.itemName,
          description: item.description || null,
          maxScore: item.maxScore ?? 5,
          sortOrder: item.sortOrder ?? idx,
          categoryName: null,
          categorySortOrder: null,
          isCustomized: item.isCustomized ?? false,
          isAdded: item.isAdded ?? false,
          isDeleted: item.isDeleted ?? false,
        }))

      if (itemsToCreate.length > 0) {
        await prisma.evaluationCustomItem.createMany({
          data: itemsToCreate,
        })
      }

      return NextResponse.json({ success: true, count: itemsToCreate.length })
    }
  } catch (error) {
    console.error("評価項目保存エラー:", error)
    return NextResponse.json(
      { error: "評価項目の保存に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 評価項目部分更新
 */
export async function PUT(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id: companyId, employeeId } = await context.params
    const body = await request.json()
    const { itemId, updates } = body as {
      itemId: string
      updates: {
        itemName?: string
        description?: string | null
        maxScore?: number
        isCustomized?: boolean
        isDeleted?: boolean
      }
    }

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId が必要です" },
        { status: 400 }
      )
    }

    // 項目の存在確認
    const item = await prisma.evaluationCustomItem.findFirst({
      where: {
        id: itemId,
        employeeId,
        companyId,
      },
    })

    if (!item) {
      return NextResponse.json(
        { error: "評価項目が見つかりません" },
        { status: 404 }
      )
    }

    // 更新
    const updatedItem = await prisma.evaluationCustomItem.update({
      where: { id: itemId },
      data: {
        ...(updates.itemName !== undefined && { itemName: updates.itemName }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.maxScore !== undefined && { maxScore: updates.maxScore }),
        ...(updates.isCustomized !== undefined && { isCustomized: updates.isCustomized }),
        ...(updates.isDeleted !== undefined && { isDeleted: updates.isDeleted }),
      },
    })

    return NextResponse.json({
      success: true,
      item: {
        id: updatedItem.id,
        itemName: updatedItem.itemName,
        description: updatedItem.description,
        maxScore: updatedItem.maxScore,
        isCustomized: updatedItem.isCustomized,
        isAdded: updatedItem.isAdded,
        isDeleted: updatedItem.isDeleted,
      },
    })
  } catch (error) {
    console.error("評価項目更新エラー:", error)
    return NextResponse.json(
      { error: "評価項目の更新に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 評価項目削除（テンプレートからリセット用）
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id: companyId, employeeId } = await context.params
    const searchParams = request.nextUrl.searchParams
    const periodId = searchParams.get("periodId")
    const type = searchParams.get("type") as EvaluationType | null

    if (!type || (type !== "individual" && type !== "360")) {
      return NextResponse.json(
        { error: "type パラメータは 'individual' または '360' を指定してください" },
        { status: 400 }
      )
    }

    // 従業員の存在確認
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    })

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      )
    }

    // カスタム項目を削除
    const deleted = await prisma.evaluationCustomItem.deleteMany({
      where: {
        employeeId,
        companyId,
        periodId: periodId || undefined,
        evaluationType: type,
      },
    })

    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
    })
  } catch (error) {
    console.error("評価項目削除エラー:", error)
    return NextResponse.json(
      { error: "評価項目の削除に失敗しました" },
      { status: 500 }
    )
  }
}
