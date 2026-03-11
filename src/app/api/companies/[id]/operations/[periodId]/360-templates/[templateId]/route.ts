import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

// GET: 特定の期間固有テンプレート詳細を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; templateId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { templateId } = await params

    const template = await prisma.evaluation360Template.findUnique({
      where: { id: templateId },
      include: {
        categories: {
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        grades: {
          include: {
            grade: { select: { id: true, name: true } },
          },
        },
        jobTypes: {
          include: {
            jobType: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...template,
      isPeriodSpecific: !!template.periodId,
      grades: template.grades.map((g) => g.grade),
      jobTypes: template.jobTypes.map((jt) => jt.jobType),
    })
  } catch (error) {
    console.error("テンプレート取得エラー:", error)
    return NextResponse.json(
      { error: "テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}

const updateTemplateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "confirmed"]).optional(),
  categories: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    sortOrder: z.number(),
    items: z.array(z.object({
      id: z.string().optional(),
      content: z.string(),
      sortOrder: z.number(),
      maxScore: z.number().default(5),
    })),
  })).optional(),
  gradeIds: z.array(z.string()).optional(),
  jobTypeIds: z.array(z.string()).optional(),
})

// PUT: 期間固有テンプレートを更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; templateId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId, templateId } = await params
    const body = await request.json()

    const validationResult = updateTemplateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { name, description, status, categories, gradeIds, jobTypeIds } = validationResult.data

    // テンプレートを確認
    const template = await prisma.evaluation360Template.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    // 期間固有テンプレートのみ編集可能
    if (!template.periodId) {
      return NextResponse.json(
        { error: "マスターテンプレートは運用画面から編集できません" },
        { status: 400 }
      )
    }

    if (template.periodId !== periodId) {
      return NextResponse.json(
        { error: "この期間のテンプレートではありません" },
        { status: 400 }
      )
    }

    // トランザクションで更新
    await prisma.$transaction(async (tx) => {
      // テンプレート基本情報を更新
      if (name !== undefined || description !== undefined || status !== undefined) {
        await tx.evaluation360Template.update({
          where: { id: templateId },
          data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(status !== undefined && { status }),
          },
        })
      }

      // カテゴリ・アイテムを更新
      if (categories !== undefined) {
        // 既存のカテゴリを削除
        await tx.evaluation360TemplateCategory.deleteMany({
          where: { templateId },
        })

        // 新しいカテゴリを作成
        for (const category of categories) {
          const newCategory = await tx.evaluation360TemplateCategory.create({
            data: {
              templateId,
              name: category.name,
              sortOrder: category.sortOrder,
            },
          })

          // アイテムを作成
          for (const item of category.items) {
            await tx.evaluation360TemplateItem.create({
              data: {
                categoryId: newCategory.id,
                content: item.content,
                sortOrder: item.sortOrder,
                maxScore: item.maxScore,
              },
            })
          }
        }
      }

      // 等級リンクを更新
      if (gradeIds !== undefined) {
        await tx.evaluation360TemplateGrade.deleteMany({
          where: { templateId },
        })
        for (const gradeId of gradeIds) {
          await tx.evaluation360TemplateGrade.create({
            data: { templateId, gradeId },
          })
        }
      }

      // 職種リンクを更新
      if (jobTypeIds !== undefined) {
        await tx.evaluation360TemplateJobType.deleteMany({
          where: { templateId },
        })
        for (const jobTypeId of jobTypeIds) {
          await tx.evaluation360TemplateJobType.create({
            data: { templateId, jobTypeId },
          })
        }
      }
    })

    return NextResponse.json({ message: "テンプレートを更新しました" })
  } catch (error) {
    console.error("テンプレート更新エラー:", error)
    return NextResponse.json(
      { error: "テンプレートの更新に失敗しました" },
      { status: 500 }
    )
  }
}

// DELETE: 期間固有テンプレートを削除（マスターに戻す）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; templateId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { templateId } = await params

    const template = await prisma.evaluation360Template.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    if (!template.periodId) {
      return NextResponse.json(
        { error: "マスターテンプレートは削除できません" },
        { status: 400 }
      )
    }

    await prisma.evaluation360Template.delete({
      where: { id: templateId },
    })

    return NextResponse.json({ message: "テンプレートを削除しました" })
  } catch (error) {
    console.error("テンプレート削除エラー:", error)
    return NextResponse.json(
      { error: "テンプレートの削除に失敗しました" },
      { status: 500 }
    )
  }
}
