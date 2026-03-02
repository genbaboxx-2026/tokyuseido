/**
 * 360度評価テンプレート複製API
 * POST /api/companies/[id]/evaluation-360-templates/[templateId]/duplicate
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  params: Promise<{ id: string; templateId: string }>
}

/**
 * 360度評価テンプレート複製
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

    const { id: companyId, templateId } = await context.params

    // 元のテンプレートを取得
    const sourceTemplate = await prisma.evaluation360Template.findFirst({
      where: {
        id: templateId,
        companyId,
      },
      include: {
        grades: true,
        jobTypes: true,
        categories: {
          include: {
            items: true,
          },
        },
      },
    })

    if (!sourceTemplate) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    // 複製を作成（名前に「のコピー」を追加、statusはdraftに）
    const duplicatedTemplate = await prisma.evaluation360Template.create({
      data: {
        companyId,
        name: sourceTemplate.name ? `${sourceTemplate.name}のコピー` : "コピー",
        description: sourceTemplate.description,
        status: "draft",
        isActive: false,
        grades: {
          create: sourceTemplate.grades.map((g) => ({
            gradeId: g.gradeId,
          })),
        },
        jobTypes: {
          create: sourceTemplate.jobTypes.map((jt) => ({
            jobTypeId: jt.jobTypeId,
          })),
        },
        categories: {
          create: sourceTemplate.categories.map((cat) => ({
            name: cat.name,
            sortOrder: cat.sortOrder,
            items: {
              create: cat.items.map((item) => ({
                content: item.content,
                maxScore: item.maxScore,
                sortOrder: item.sortOrder,
              })),
            },
          })),
        },
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
      id: duplicatedTemplate.id,
      companyId: duplicatedTemplate.companyId,
      name: duplicatedTemplate.name,
      description: duplicatedTemplate.description,
      isActive: duplicatedTemplate.isActive,
      status: duplicatedTemplate.status,
      createdAt: duplicatedTemplate.createdAt,
      updatedAt: duplicatedTemplate.updatedAt,
      grades: duplicatedTemplate.grades.map((g) => ({
        id: g.grade.id,
        name: g.grade.name,
        level: g.grade.level,
      })),
      jobTypes: duplicatedTemplate.jobTypes.map((jt) => ({
        id: jt.jobType.id,
        name: jt.jobType.name,
      })),
      categories: duplicatedTemplate.categories.map((cat) => ({
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
    console.error("360度評価テンプレート複製エラー:", error)
    return NextResponse.json(
      { error: "360度評価テンプレートの複製に失敗しました" },
      { status: 500 }
    )
  }
}
