import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET: 期間固有の360度テンプレート一覧を取得（なければマスターを返す）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await params

    // まず期間固有テンプレートを取得
    const periodTemplates = await prisma.evaluation360Template.findMany({
      where: {
        companyId,
        periodId,
        isActive: true,
      },
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
      orderBy: { createdAt: "desc" },
    })

    // 期間固有テンプレートがある場合はそれを返す
    if (periodTemplates.length > 0) {
      const templates = periodTemplates.map((t) => ({
        ...t,
        isPeriodSpecific: true,
        grades: t.grades.map((g) => g.grade),
        jobTypes: t.jobTypes.map((jt) => jt.jobType),
      }))
      return NextResponse.json({ templates })
    }

    // なければマスターテンプレートを返す
    const masterTemplates = await prisma.evaluation360Template.findMany({
      where: {
        companyId,
        periodId: null,
        isActive: true,
        status: "confirmed",
      },
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
      orderBy: { createdAt: "desc" },
    })

    const templates = masterTemplates.map((t) => ({
      ...t,
      isPeriodSpecific: false,
      grades: t.grades.map((g) => g.grade),
      jobTypes: t.jobTypes.map((jt) => jt.jobType),
    }))

    return NextResponse.json({ templates })
  } catch (error) {
    console.error("テンプレート取得エラー:", error)
    return NextResponse.json(
      { error: "テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}

// POST: マスターテンプレートを期間固有にコピー
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await params
    const body = await request.json()
    const { sourceTemplateId } = body as { sourceTemplateId: string }

    if (!sourceTemplateId) {
      return NextResponse.json(
        { error: "コピー元テンプレートIDが必要です" },
        { status: 400 }
      )
    }

    // 既存の期間固有テンプレートをチェック
    const existing = await prisma.evaluation360Template.findFirst({
      where: {
        periodId,
        sourceTemplateId,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "このテンプレートは既にコピーされています", templateId: existing.id },
        { status: 400 }
      )
    }

    // マスターテンプレートを取得
    const source = await prisma.evaluation360Template.findUnique({
      where: { id: sourceTemplateId },
      include: {
        categories: {
          include: {
            items: true,
          },
        },
        grades: true,
        jobTypes: true,
      },
    })

    if (!source) {
      return NextResponse.json(
        { error: "コピー元テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    // トランザクションでコピーを作成
    const newTemplate = await prisma.$transaction(async (tx) => {
      // テンプレート本体をコピー
      const template = await tx.evaluation360Template.create({
        data: {
          companyId,
          name: source.name,
          description: source.description,
          status: "confirmed",
          periodId,
          sourceTemplateId,
        },
      })

      // カテゴリとアイテムをコピー
      for (const category of source.categories) {
        const newCategory = await tx.evaluation360TemplateCategory.create({
          data: {
            templateId: template.id,
            name: category.name,
            sortOrder: category.sortOrder,
          },
        })

        // アイテムをコピー
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

      // 等級リンクをコピー
      for (const grade of source.grades) {
        await tx.evaluation360TemplateGrade.create({
          data: {
            templateId: template.id,
            gradeId: grade.gradeId,
          },
        })
      }

      // 職種リンクをコピー
      for (const jobType of source.jobTypes) {
        await tx.evaluation360TemplateJobType.create({
          data: {
            templateId: template.id,
            jobTypeId: jobType.jobTypeId,
          },
        })
      }

      return template
    })

    return NextResponse.json({
      message: "テンプレートをコピーしました",
      templateId: newTemplate.id,
    })
  } catch (error) {
    console.error("テンプレートコピーエラー:", error)
    return NextResponse.json(
      { error: "テンプレートのコピーに失敗しました" },
      { status: 500 }
    )
  }
}
