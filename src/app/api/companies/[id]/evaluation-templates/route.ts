/**
 * 評価テンプレートAPI
 * GET /api/companies/[id]/evaluation-templates - テンプレート一覧取得
 * POST /api/companies/[id]/evaluation-templates - テンプレート作成
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * 評価テンプレート一覧取得
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

    const { id } = await context.params

    const company = await prisma.company.findUnique({
      where: { id },
    })

    if (!company) {
      return NextResponse.json(
        { error: "会社が見つかりません" },
        { status: 404 }
      )
    }

    const templates = await prisma.evaluationTemplate.findMany({
      where: {
        gradeJobTypeConfig: {
          grade: {
            companyId: id,
          },
        },
      },
      include: {
        gradeJobTypeConfig: {
          include: {
            grade: {
              select: { id: true, name: true },
            },
            jobType: {
              select: { id: true, name: true },
            },
          },
        },
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error("評価テンプレート取得エラー:", error)
    return NextResponse.json(
      { error: "評価テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 評価テンプレート作成
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

    const { id } = await context.params
    const body = await request.json()

    const { gradeJobTypeConfigId, name, description, items, status } = body as {
      gradeJobTypeConfigId: string
      name: string
      description?: string
      status?: "draft" | "confirmed"
      items?: Array<{
        name: string
        description?: string
        category: string
        maxScore?: number
        weight?: number
        sortOrder?: number
      }>
    }

    if (!gradeJobTypeConfigId || !name) {
      return NextResponse.json(
        { error: "等級×職種設定IDとテンプレート名は必須です" },
        { status: 400 }
      )
    }

    const gradeJobTypeConfig = await prisma.gradeJobTypeConfig.findUnique({
      where: { id: gradeJobTypeConfigId },
      include: {
        grade: {
          select: { companyId: true },
        },
      },
    })

    if (!gradeJobTypeConfig) {
      return NextResponse.json(
        { error: "等級×職種設定が見つかりません" },
        { status: 404 }
      )
    }

    if (gradeJobTypeConfig.grade.companyId !== id) {
      return NextResponse.json(
        { error: "権限がありません" },
        { status: 403 }
      )
    }

    const existingTemplate = await prisma.evaluationTemplate.findUnique({
      where: { gradeJobTypeConfigId },
    })

    // 既存テンプレートがあれば更新、なければ作成
    let template
    if (existingTemplate) {
      // 既存のアイテムを削除して新しく作成
      await prisma.evaluationTemplateItem.deleteMany({
        where: { evaluationTemplateId: existingTemplate.id },
      })

      template = await prisma.evaluationTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          name,
          description,
          status: status ?? "draft",
          items: items
            ? {
                create: items.map((item, index) => ({
                  name: item.name,
                  description: item.description,
                  category: item.category || "一般",
                  maxScore: item.maxScore ?? 5,
                  weight: item.weight ?? 1.0,
                  sortOrder: item.sortOrder ?? index,
                })),
              }
            : undefined,
        },
        include: {
          gradeJobTypeConfig: {
            include: {
              grade: {
                select: { id: true, name: true },
              },
              jobType: {
                select: { id: true, name: true },
              },
            },
          },
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    } else {
      template = await prisma.evaluationTemplate.create({
        data: {
          gradeJobTypeConfigId,
          name,
          description,
          status: status ?? "draft",
          items: items
            ? {
                create: items.map((item, index) => ({
                  name: item.name,
                  description: item.description,
                  category: item.category || "一般",
                  maxScore: item.maxScore ?? 5,
                  weight: item.weight ?? 1.0,
                  sortOrder: item.sortOrder ?? index,
                })),
              }
            : undefined,
        },
        include: {
          gradeJobTypeConfig: {
            include: {
              grade: {
                select: { id: true, name: true },
              },
              jobType: {
                select: { id: true, name: true },
              },
            },
          },
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    }

    return NextResponse.json(template, { status: existingTemplate ? 200 : 201 })
  } catch (error) {
    console.error("評価テンプレート作成エラー:", error)
    return NextResponse.json(
      { error: "評価テンプレートの作成に失敗しました" },
      { status: 500 }
    )
  }
}
