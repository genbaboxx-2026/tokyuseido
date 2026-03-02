import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { evaluationItemCreateSchema } from "@/lib/evaluation/schemas"

// GET: 評価項目一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const gradeJobTypeConfigId = searchParams.get("gradeJobTypeConfigId")
    const category = searchParams.get("category")

    const where: {
      gradeJobTypeConfigId?: string | null
      category?: string
    } = {}

    // gradeJobTypeConfigIdがある場合はそのConfigに紐づく項目を取得
    // ない場合は共通項目（gradeJobTypeConfigId=null）を取得
    if (gradeJobTypeConfigId) {
      where.gradeJobTypeConfigId = gradeJobTypeConfigId
    }

    if (category) {
      where.category = category
    }

    const items = await prisma.evaluationItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        gradeJobTypeConfig: gradeJobTypeConfigId
          ? {
              select: {
                id: true,
                grade: { select: { id: true, name: true } },
                jobType: { select: { id: true, name: true } },
              },
            }
          : false,
      },
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error("評価項目一覧取得エラー:", error)
    return NextResponse.json({ error: "評価項目一覧の取得に失敗しました" }, { status: 500 })
  }
}

// POST: 評価項目作成
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()

    // 役割責任からプリセット作成の場合
    if (body.presetFromRoles && body.gradeJobTypeConfigId) {
      const configId = body.gradeJobTypeConfigId as string

      // GradeJobTypeConfigの存在確認
      const config = await prisma.gradeJobTypeConfig.findUnique({
        where: { id: configId },
        include: {
          gradeRole: true,
        },
      })

      if (!config) {
        return NextResponse.json(
          { error: "等級×職種設定が見つかりません" },
          { status: 404 }
        )
      }

      // 既存の評価項目をチェック
      const existingItems = await prisma.evaluationItem.findMany({
        where: { gradeJobTypeConfigId: configId },
      })

      // 役割責任から評価項目を作成
      const newItems: Array<{
        name: string
        description: string | null
        category: string
        weight: number | null
        gradeJobTypeConfigId: string
      }> = []

      // GradeRoleのresponsibilitiesはJSON形式（配列）
      if (config.gradeRole?.responsibilities) {
        const responsibilities = config.gradeRole.responsibilities as Array<{
          content: string
          category: string
        }>

        for (const responsibility of responsibilities) {
          // 既に同名の評価項目が存在する場合はスキップ
          const exists = existingItems.some((item) => item.name === responsibility.content)
          if (!exists) {
            newItems.push({
              name: responsibility.content,
              description: null,
              category: responsibility.category,
              weight: 1,
              gradeJobTypeConfigId: configId,
            })
          }
        }
      }

      if (newItems.length === 0) {
        return NextResponse.json(
          { message: "作成する評価項目がありません", items: [] },
          { status: 200 }
        )
      }

      const createdItems = await prisma.evaluationItem.createMany({
        data: newItems,
      })

      // 作成した項目を取得
      const items = await prisma.evaluationItem.findMany({
        where: { gradeJobTypeConfigId: configId },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      })

      return NextResponse.json(
        { message: `${createdItems.count}件の評価項目を作成しました`, items },
        { status: 201 }
      )
    }

    // 通常の評価項目作成
    const validationResult = evaluationItemCreateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { name, description, category, weight, gradeJobTypeConfigId } = validationResult.data

    // gradeJobTypeConfigIdがある場合は存在確認
    if (gradeJobTypeConfigId) {
      const config = await prisma.gradeJobTypeConfig.findUnique({
        where: { id: gradeJobTypeConfigId },
      })

      if (!config) {
        return NextResponse.json(
          { error: "等級×職種設定が見つかりません" },
          { status: 404 }
        )
      }
    }

    const item = await prisma.evaluationItem.create({
      data: {
        name,
        description,
        category,
        weight,
        gradeJobTypeConfigId,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error("評価項目作成エラー:", error)
    return NextResponse.json({ error: "評価項目の作成に失敗しました" }, { status: 500 })
  }
}
