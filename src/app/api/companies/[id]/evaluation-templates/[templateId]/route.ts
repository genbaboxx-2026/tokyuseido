/**
 * 評価テンプレート個別操作API
 * GET /api/companies/[id]/evaluation-templates/[templateId] - テンプレート詳細取得
 * PUT /api/companies/[id]/evaluation-templates/[templateId] - テンプレート更新
 * DELETE /api/companies/[id]/evaluation-templates/[templateId] - テンプレート削除
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  params: Promise<{ id: string; templateId: string }>
}

/**
 * 評価テンプレート詳細取得
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, templateId } = await context.params

    const template = await prisma.evaluationTemplate.findFirst({
      where: {
        id: templateId,
        gradeJobTypeConfig: {
          grade: { companyId },
        },
      },
      include: {
        gradeJobTypeConfig: {
          include: {
            grade: { select: { id: true, name: true } },
            jobType: { select: { id: true, name: true } },
          },
        },
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: "評価テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error("評価テンプレート取得エラー:", error)
    return NextResponse.json(
      { error: "評価テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 評価テンプレート更新
 */
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, templateId } = await context.params
    const body = await request.json()

    const { name, description, status, items } = body as {
      name?: string
      description?: string
      status?: "draft" | "confirmed"
      items?: Array<{
        id?: string
        name: string
        description?: string
        category: string
        maxScore?: number
        weight?: number
        sortOrder?: number
      }>
    }

    // テンプレートが存在し、同じ会社に属しているか確認
    const existingTemplate = await prisma.evaluationTemplate.findFirst({
      where: {
        id: templateId,
        gradeJobTypeConfig: {
          grade: { companyId },
        },
      },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "評価テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    // トランザクションで更新
    const updatedTemplate = await prisma.$transaction(async (tx) => {
      // 項目が指定されている場合は、既存項目を削除して再作成
      if (items !== undefined) {
        await tx.evaluationTemplateItem.deleteMany({
          where: { evaluationTemplateId: templateId },
        })
      }

      return tx.evaluationTemplate.update({
        where: { id: templateId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(status !== undefined && { status }),
          ...(items !== undefined && {
            items: {
              create: items.map((item, index) => ({
                name: item.name,
                description: item.description,
                category: item.category || "一般",
                maxScore: item.maxScore ?? 5,
                weight: item.weight ?? 1.0,
                sortOrder: item.sortOrder ?? index,
              })),
            },
          }),
        },
        include: {
          gradeJobTypeConfig: {
            include: {
              grade: { select: { id: true, name: true } },
              jobType: { select: { id: true, name: true } },
            },
          },
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    })

    return NextResponse.json(updatedTemplate)
  } catch (error) {
    console.error("評価テンプレート更新エラー:", error)
    return NextResponse.json(
      { error: "評価テンプレートの更新に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 評価テンプレート削除
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, templateId } = await context.params

    // テンプレートが存在し、同じ会社に属しているか確認
    const existingTemplate = await prisma.evaluationTemplate.findFirst({
      where: {
        id: templateId,
        gradeJobTypeConfig: {
          grade: { companyId },
        },
      },
      include: {
        _count: {
          select: {
            employeeEvaluations: true,
          },
        },
      },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "評価テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    // 使用中の評価がある場合は削除不可
    if (existingTemplate._count.employeeEvaluations > 0) {
      return NextResponse.json(
        {
          error: "このテンプレートを使用している評価があるため削除できません",
          evaluationCount: existingTemplate._count.employeeEvaluations,
        },
        { status: 400 }
      )
    }

    // テンプレートを削除（関連する項目もカスケード削除される）
    await prisma.evaluationTemplate.delete({
      where: { id: templateId },
    })

    return NextResponse.json({
      success: true,
      message: "評価テンプレートを削除しました",
    })
  } catch (error) {
    console.error("評価テンプレート削除エラー:", error)
    return NextResponse.json(
      { error: "評価テンプレートの削除に失敗しました" },
      { status: 500 }
    )
  }
}
