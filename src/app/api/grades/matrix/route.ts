import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { matrixUpdateSchema } from "@/lib/grade/schemas"

// GET: 等級×職種マトリクス取得
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    if (!companyId) {
      return NextResponse.json({ error: "会社IDは必須です" }, { status: 400 })
    }

    // 等級一覧を取得
    const grades = await prisma.grade.findMany({
      where: { companyId },
      orderBy: [{ employmentType: "asc" }, { level: "desc" }],
    })

    // 職種大分類と小分類を取得
    const jobCategories = await prisma.jobCategory.findMany({
      where: { companyId },
      include: {
        jobTypes: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    })

    // 全ての等級×職種設定を取得
    const configs = await prisma.gradeJobTypeConfig.findMany({
      where: {
        grade: { companyId },
      },
      include: {
        gradeRole: true,
      },
    })

    // マトリクス形式にデータを整形
    const configMap = new Map(
      configs.map((config) => [`${config.gradeId}-${config.jobTypeId}`, config])
    )

    const matrix = grades.map((grade) => ({
      grade,
      jobTypes: jobCategories.flatMap((category) =>
        category.jobTypes.map((jobType) => {
          const configKey = `${grade.id}-${jobType.id}`
          const config = configMap.get(configKey)
          return {
            jobType,
            jobCategory: { id: category.id, name: category.name },
            config: config || null,
            isEnabled: config?.isEnabled ?? false,
            hasRole: config?.gradeRole !== null && config?.gradeRole !== undefined,
          }
        })
      ),
    }))

    return NextResponse.json({
      grades,
      jobCategories,
      matrix,
    })
  } catch (error) {
    console.error("マトリクス取得エラー:", error)
    return NextResponse.json({ error: "マトリクスの取得に失敗しました" }, { status: 500 })
  }
}

// PUT: 等級×職種の有効/無効を一括更新
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()
    console.log("Matrix update request body:", JSON.stringify(body, null, 2))

    const validationResult = matrixUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.issues)
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { updates } = validationResult.data

    // 各更新を順次実行（トランザクションではなく個別に）
    for (const update of updates) {
      await prisma.gradeJobTypeConfig.upsert({
        where: {
          gradeId_jobTypeId: {
            gradeId: update.gradeId,
            jobTypeId: update.jobTypeId,
          },
        },
        update: {
          isEnabled: update.isEnabled,
        },
        create: {
          gradeId: update.gradeId,
          jobTypeId: update.jobTypeId,
          isEnabled: update.isEnabled,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("マトリクス更新エラー:", error)
    const errorMessage = error instanceof Error ? error.message : "マトリクスの更新に失敗しました"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
