/**
 * 360度評価テンプレート詳細API
 * GET /api/companies/[id]/evaluation-360-templates/[templateId] - テンプレート詳細取得
 * PUT /api/companies/[id]/evaluation-360-templates/[templateId] - テンプレート更新
 * DELETE /api/companies/[id]/evaluation-360-templates/[templateId] - テンプレート削除
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface UpdateEvaluation360TemplateDto {
  name?: string
  description?: string
  isActive?: boolean
  status?: "draft" | "confirmed"
  gradeIds?: string[]
  jobTypeIds?: string[]
}

type RouteParams = {
  params: Promise<{ id: string; templateId: string }>
}

/**
 * 360度評価テンプレート詳細取得
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

    const { id: companyId, templateId } = await context.params

    const template = await prisma.evaluation360Template.findFirst({
      where: {
        id: templateId,
        companyId,
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

    if (!template) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    // レスポンス用に整形
    const formattedTemplate = {
      id: template.id,
      companyId: template.companyId,
      name: template.name,
      description: template.description,
      isActive: template.isActive,
      status: template.status,
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
    console.error("360度評価テンプレート取得エラー:", error)
    return NextResponse.json(
      { error: "360度評価テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 360度評価テンプレート更新
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
    const body = await request.json() as UpdateEvaluation360TemplateDto

    const { name, description, isActive, status, gradeIds, jobTypeIds } = body

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

    // 等級と職種の検証
    if (gradeIds && gradeIds.length > 0) {
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

    if (jobTypeIds && jobTypeIds.length > 0) {
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

    // トランザクションで更新
    const template = await prisma.$transaction(async (tx) => {
      // 等級関連の更新
      if (gradeIds) {
        await tx.evaluation360TemplateGrade.deleteMany({
          where: { templateId },
        })
        await tx.evaluation360TemplateGrade.createMany({
          data: gradeIds.map((gradeId) => ({
            templateId,
            gradeId,
          })),
        })
      }

      // 職種関連の更新
      if (jobTypeIds) {
        await tx.evaluation360TemplateJobType.deleteMany({
          where: { templateId },
        })
        await tx.evaluation360TemplateJobType.createMany({
          data: jobTypeIds.map((jobTypeId) => ({
            templateId,
            jobTypeId,
          })),
        })
      }

      // テンプレート本体の更新
      return tx.evaluation360Template.update({
        where: { id: templateId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
          ...(status !== undefined && { status }),
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
    })

    // レスポンス用に整形
    const formattedTemplate = {
      id: template.id,
      companyId: template.companyId,
      name: template.name,
      description: template.description,
      isActive: template.isActive,
      status: template.status,
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
    console.error("360度評価テンプレート更新エラー:", error)
    return NextResponse.json(
      { error: "360度評価テンプレートの更新に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 360度評価テンプレート削除
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

    const { id: companyId, templateId } = await context.params

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

    await prisma.evaluation360Template.delete({
      where: { id: templateId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("360度評価テンプレート削除エラー:", error)
    return NextResponse.json(
      { error: "360度評価テンプレートの削除に失敗しました" },
      { status: 500 }
    )
  }
}
