/**
 * 360度評価テンプレートAPI
 * GET /api/companies/[id]/evaluation-360-templates - テンプレート一覧取得
 * POST /api/companies/[id]/evaluation-360-templates - テンプレート作成
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// CreateEvaluation360TemplateDto型を直接定義
interface CreateEvaluation360TemplateDto {
  name?: string
  description?: string
  gradeIds?: string[]
  jobTypeIds?: string[]
  status?: "draft" | "confirmed"
  categories?: {
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
  params: Promise<{ id: string }>
}

/**
 * 360度評価テンプレート一覧取得
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

    const { id: companyId } = await context.params

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json(
        { error: "会社が見つかりません" },
        { status: 404 }
      )
    }

    const templates = await prisma.evaluation360Template.findMany({
      where: { companyId },
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
      orderBy: { createdAt: "desc" },
    })

    // レスポンス用に整形
    const formattedTemplates = templates.map((template) => ({
      id: template.id,
      companyId: template.companyId,
      name: template.name,
      description: template.description,
      isActive: template.isActive,
      status: template.status,
      periodId: template.periodId,
      sourceTemplateId: template.sourceTemplateId,
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
      gradesCount: template.grades.length,
      jobTypesCount: template.jobTypes.length,
      categoriesCount: template.categories.length,
      itemsCount: template.categories.reduce((acc, cat) => acc + cat.items.length, 0),
    }))

    return NextResponse.json({
      templates: formattedTemplates,
      total: formattedTemplates.length,
    })
  } catch (error) {
    console.error("360度評価テンプレート取得エラー:", error)
    return NextResponse.json(
      { error: "360度評価テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 360度評価テンプレート作成
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

    const { id: companyId } = await context.params
    const body = await request.json() as CreateEvaluation360TemplateDto

    const { name = "", description, gradeIds, jobTypeIds, status = "draft", categories } = body

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json(
        { error: "会社が見つかりません" },
        { status: 404 }
      )
    }

    // 等級IDと職種IDを決定（指定がない場合は全件取得）
    let finalGradeIds: string[] = gradeIds || []
    let finalJobTypeIds: string[] = jobTypeIds || []

    // gradeIdsが指定されていない場合、全等級を取得
    if (!gradeIds || gradeIds.length === 0) {
      const allGrades = await prisma.grade.findMany({
        where: { companyId },
        select: { id: true },
      })
      finalGradeIds = allGrades.map((g) => g.id)
    } else {
      // 指定がある場合は存在確認
      const grades = await prisma.grade.findMany({
        where: {
          id: { in: gradeIds },
          companyId,
        },
      })

      if (grades.length !== gradeIds.length) {
        return NextResponse.json(
          { error: "無効な等級が含まれています" },
          { status: 400 }
        )
      }
    }

    // jobTypeIdsが指定されていない場合、全職種を取得
    if (!jobTypeIds || jobTypeIds.length === 0) {
      const allJobTypes = await prisma.jobType.findMany({
        where: { jobCategory: { companyId } },
        select: { id: true },
      })
      finalJobTypeIds = allJobTypes.map((jt) => jt.id)
    } else {
      // 指定がある場合は存在確認
      const jobTypes = await prisma.jobType.findMany({
        where: {
          id: { in: jobTypeIds },
          jobCategory: { companyId },
        },
      })

      if (jobTypes.length !== jobTypeIds.length) {
        return NextResponse.json(
          { error: "無効な職種が含まれています" },
          { status: 400 }
        )
      }
    }

    // テンプレート作成
    const template = await prisma.evaluation360Template.create({
      data: {
        companyId,
        name,
        description,
        status,
        grades: finalGradeIds.length > 0 ? {
          create: finalGradeIds.map((gradeId) => ({
            gradeId,
          })),
        } : undefined,
        jobTypes: finalJobTypeIds.length > 0 ? {
          create: finalJobTypeIds.map((jobTypeId) => ({
            jobTypeId,
          })),
        } : undefined,
        categories: categories
          ? {
              create: categories.map((cat, catIndex) => ({
                name: cat.name,
                sortOrder: cat.sortOrder ?? catIndex,
                items: {
                  create: cat.items.map((item, itemIndex) => ({
                    content: item.content,
                    maxScore: item.maxScore ?? 5,
                    sortOrder: item.sortOrder ?? itemIndex,
                  })),
                },
              })),
            }
          : undefined,
      },
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

    return NextResponse.json(formattedTemplate, { status: 201 })
  } catch (error) {
    console.error("360度評価テンプレート作成エラー:", error)
    return NextResponse.json(
      { error: "360度評価テンプレートの作成に失敗しました" },
      { status: 500 }
    )
  }
}
