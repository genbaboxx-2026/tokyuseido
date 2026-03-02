/**
 * 360度評価テンプレートコンテンツAPI
 * PUT /api/companies/[id]/evaluation-360-templates/[templateId]/content - カテゴリ/項目一括更新
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface UpdateEvaluation360TemplateContentDto {
  categories: {
    name: string
    sortOrder?: number
    items: {
      content: string
      maxScore?: number
      sortOrder?: number
    }[]
  }[]
}

type RouteParams = {
  params: Promise<{ id: string; templateId: string }>
}

/**
 * 360度評価テンプレートのカテゴリ/項目を一括更新
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

    const { id: companyId, templateId } = await context.params
    const body = await request.json() as UpdateEvaluation360TemplateContentDto

    const { categories } = body

    if (!categories || !Array.isArray(categories)) {
      return NextResponse.json(
        { error: "カテゴリデータが必要です" },
        { status: 400 }
      )
    }

    const existingTemplate = await prisma.evaluation360Template.findFirst({
      where: {
        id: templateId,
        companyId,
      },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    // トランザクションで更新
    const template = await prisma.$transaction(async (tx) => {
      // 既存のカテゴリとアイテムを削除（カスケードでアイテムも削除される）
      await tx.evaluation360TemplateCategory.deleteMany({
        where: { templateId },
      })

      // 新しいカテゴリとアイテムを作成
      for (let catIndex = 0; catIndex < categories.length; catIndex++) {
        const cat = categories[catIndex]
        await tx.evaluation360TemplateCategory.create({
          data: {
            templateId,
            name: cat.name,
            sortOrder: cat.sortOrder ?? catIndex,
            items: {
              create: cat.items.map((item, itemIndex) => ({
                content: item.content,
                maxScore: item.maxScore ?? 5,
                sortOrder: item.sortOrder ?? itemIndex,
              })),
            },
          },
        })
      }

      // 更新後のテンプレートを取得
      return tx.evaluation360Template.findUnique({
        where: { id: templateId },
        include: {
          grades: {
            include: {
              grade: {
                select: { id: true, name: true, level: true },
              },
            },
          },
          jobTypes: {
            include: {
              jobType: {
                select: { id: true, name: true },
              },
            },
          },
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
    })

    if (!template) {
      return NextResponse.json(
        { error: "テンプレートの更新に失敗しました" },
        { status: 500 }
      )
    }

    // レスポンス用に整形
    const formattedTemplate = {
      id: template.id,
      companyId: template.companyId,
      name: template.name,
      description: template.description,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      grades: template.grades.map((g) => ({
        id: g.grade.id,
        name: g.grade.name,
        level: g.grade.level,
      })),
      jobTypes: template.jobTypes.map((jt) => ({
        id: jt.jobType.id,
        name: jt.jobType.name,
      })),
      categories: template.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
        items: cat.items.map((item) => ({
          id: item.id,
          content: item.content,
          maxScore: item.maxScore,
          sortOrder: item.sortOrder,
        })),
      })),
    }

    return NextResponse.json(formattedTemplate)
  } catch (error) {
    console.error("360度評価テンプレートコンテンツ更新エラー:", error)
    return NextResponse.json(
      { error: "360度評価テンプレートのコンテンツ更新に失敗しました" },
      { status: 500 }
    )
  }
}
