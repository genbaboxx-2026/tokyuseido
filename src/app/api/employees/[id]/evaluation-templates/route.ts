import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET: 従業員の評価テンプレート項目を取得
 * 等級・職種に基づいて適用されるテンプレートを返す
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: employeeId } = await params

    // 従業員情報を取得
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyId: true,
        gradeId: true,
        jobTypeId: true,
        has360Evaluation: true,
        hasIndividualEvaluation: true,
        grade: { select: { id: true, name: true } },
        jobType: { select: { id: true, name: true } },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: "従業員が見つかりません" }, { status: 404 })
    }

    // 360度評価テンプレートを検索（優先順位: 等級×職種 > 等級のみ > デフォルト）
    let evaluation360Template = null
    if (employee.gradeId && employee.jobTypeId) {
      // 等級×職種で検索
      evaluation360Template = await prisma.evaluation360Template.findFirst({
        where: {
          companyId: employee.companyId,
          isActive: true,
          grades: { some: { gradeId: employee.gradeId } },
          jobTypes: { some: { jobTypeId: employee.jobTypeId } },
        },
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      })
    }

    if (!evaluation360Template && employee.gradeId) {
      // 等級のみで検索
      evaluation360Template = await prisma.evaluation360Template.findFirst({
        where: {
          companyId: employee.companyId,
          isActive: true,
          grades: { some: { gradeId: employee.gradeId } },
        },
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      })
    }

    if (!evaluation360Template) {
      // デフォルトテンプレート（最初の有効なテンプレート）
      evaluation360Template = await prisma.evaluation360Template.findFirst({
        where: {
          companyId: employee.companyId,
          isActive: true,
        },
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      })
    }

    // 個別評価テンプレートを検索（GradeJobTypeConfig経由）
    let individualTemplate = null
    if (employee.gradeId && employee.jobTypeId) {
      // 等級×職種で検索
      individualTemplate = await prisma.evaluationTemplate.findFirst({
        where: {
          isActive: true,
          gradeJobTypeConfig: {
            gradeId: employee.gradeId,
            jobTypeId: employee.jobTypeId,
          },
        },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    }

    if (!individualTemplate && employee.gradeId) {
      // 等級のみで検索
      individualTemplate = await prisma.evaluationTemplate.findFirst({
        where: {
          isActive: true,
          gradeJobTypeConfig: {
            gradeId: employee.gradeId,
          },
        },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: `${employee.lastName} ${employee.firstName}`,
        grade: employee.grade,
        jobType: employee.jobType,
        has360Evaluation: employee.has360Evaluation,
        hasIndividualEvaluation: employee.hasIndividualEvaluation,
      },
      evaluation360: evaluation360Template
        ? {
            id: evaluation360Template.id,
            name: evaluation360Template.name,
            categories: evaluation360Template.categories.map((cat) => ({
              id: cat.id,
              name: cat.name,
              items: cat.items.map((item) => ({
                id: item.id,
                content: item.content,
                maxScore: item.maxScore,
              })),
            })),
          }
        : null,
      individual: individualTemplate
        ? {
            id: individualTemplate.id,
            name: individualTemplate.name,
            items: individualTemplate.items.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              maxScore: item.maxScore,
              category: item.category,
            })),
          }
        : null,
    })
  } catch (error) {
    console.error("評価テンプレート取得エラー:", error)
    return NextResponse.json(
      { error: "評価テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}
