/**
 * 従業員評価項目API（カスタム）
 * GET /api/employees/[id]/evaluation-items - 評価項目取得
 * POST /api/employees/[id]/evaluation-items - 評価項目保存
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * 従業員の評価項目を取得
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

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        grade: true,
        jobType: true,
      },
    })

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      )
    }

    // カスタム評価項目（evaluatorCommentにJSON保存）を確認
    const evaluation = await prisma.employeeEvaluation.findFirst({
      where: {
        employeeId: id,
        evaluationType: "custom_items",
      },
      orderBy: { createdAt: "desc" },
    })

    if (evaluation?.evaluatorComment) {
      try {
        const customItems = JSON.parse(evaluation.evaluatorComment)
        return NextResponse.json({
          id: evaluation.id,
          employeeId: id,
          items: customItems,
          isCustom: true,
          status: evaluation.status,
        })
      } catch {
        // JSONパースエラーの場合はテンプレートから取得
      }
    }

    // カスタムがなければテンプレートから取得
    // ステータスは既存evaluationから取得（あれば）
    const baseStatus = evaluation?.status || "STARTED"

    if (!employee.gradeId || !employee.jobTypeId) {
      return NextResponse.json({
        employeeId: id,
        items: [],
        isCustom: false,
        status: baseStatus,
      })
    }

    // GradeJobTypeConfigを検索
    const config = await prisma.gradeJobTypeConfig.findFirst({
      where: {
        gradeId: employee.gradeId,
        jobTypeId: employee.jobTypeId,
        isEnabled: true,
      },
    })

    if (!config) {
      return NextResponse.json({
        employeeId: id,
        items: [],
        isCustom: false,
        status: baseStatus,
      })
    }

    // テンプレートを検索
    const template = await prisma.evaluationTemplate.findUnique({
      where: { gradeJobTypeConfigId: config.id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    if (template) {
      return NextResponse.json({
        employeeId: id,
        items: template.items.map((item) => item.name),
        isCustom: false,
        templateId: template.id,
        status: baseStatus,
      })
    }

    // テンプレートもなければ役割責任から変換
    const role = await prisma.gradeRole.findUnique({
      where: { gradeJobTypeConfigId: config.id },
    })

    if (role?.responsibilities) {
      const responsibilities = role.responsibilities as string[]
      const items = responsibilities.map((r) => {
        let converted = r
          .replace(/すること[。．]?$/, "できたか")
          .replace(/する[。．]?$/, "できたか")
          .replace(/を行う[。．]?$/, "を行えたか")
          .replace(/できる[。．]?$/, "できたか")
          .replace(/している[。．]?$/, "していたか")
          .replace(/を図る[。．]?$/, "を図れたか")
        if (!converted.endsWith("？") && !converted.endsWith("?")) {
          converted += "？"
        }
        return converted
      })

      return NextResponse.json({
        employeeId: id,
        items,
        isCustom: false,
        status: baseStatus,
      })
    }

    return NextResponse.json({
      employeeId: id,
      items: [],
      isCustom: false,
      status: baseStatus,
    })
  } catch (error) {
    console.error("評価項目取得エラー:", error)
    return NextResponse.json(
      { error: "評価項目の取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 従業員の評価項目を保存（カスタム）
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

    const { items, status } = body as {
      items?: string[]
      status?: "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
    }

    if (!items && !status) {
      return NextResponse.json(
        { error: "評価項目またはステータスが必要です" },
        { status: 400 }
      )
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        grade: true,
        jobType: true,
      },
    })

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      )
    }

    // ダミーのテンプレートIDを取得または作成（必須フィールドのため）
    let templateId: string | null = null

    if (employee.gradeId && employee.jobTypeId) {
      const config = await prisma.gradeJobTypeConfig.findFirst({
        where: {
          gradeId: employee.gradeId,
          jobTypeId: employee.jobTypeId,
        },
      })

      if (config) {
        const template = await prisma.evaluationTemplate.findUnique({
          where: { gradeJobTypeConfigId: config.id },
        })
        templateId = template?.id || null
      }
    }

    // テンプレートがない場合は作成できない
    if (!templateId) {
      // GradeJobTypeConfigを探すか作成
      let config = await prisma.gradeJobTypeConfig.findFirst({
        where: {
          gradeId: employee.gradeId!,
          jobTypeId: employee.jobTypeId!,
        },
      })

      if (!config && employee.gradeId && employee.jobTypeId) {
        config = await prisma.gradeJobTypeConfig.create({
          data: {
            gradeId: employee.gradeId,
            jobTypeId: employee.jobTypeId,
            isEnabled: true,
          },
        })
      }

      if (config) {
        const template = await prisma.evaluationTemplate.create({
          data: {
            gradeJobTypeConfigId: config.id,
            name: `${employee.grade?.name || "等級"} × ${employee.jobType?.name || "職種"} テンプレート`,
            items: items && items.length > 0 ? {
              create: items.map((name, index) => ({
                name,
                category: "一般",
                sortOrder: index,
              })),
            } : undefined,
          },
        })
        templateId = template.id
      }
    }

    if (!templateId) {
      return NextResponse.json(
        { error: "テンプレートの作成に失敗しました" },
        { status: 500 }
      )
    }

    // 既存のカスタム評価を探す
    const existingEvaluation = await prisma.employeeEvaluation.findFirst({
      where: {
        employeeId: id,
        evaluationType: "custom_items",
      },
    })

    // 更新データを構築
    const updateData: {
      evaluatorComment?: string
      status?: "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
    } = {}

    if (items && Array.isArray(items)) {
      updateData.evaluatorComment = JSON.stringify(items)
    }
    if (status) {
      updateData.status = status
    }

    let evaluation
    if (existingEvaluation) {
      evaluation = await prisma.employeeEvaluation.update({
        where: { id: existingEvaluation.id },
        data: updateData,
      })
    } else {
      evaluation = await prisma.employeeEvaluation.create({
        data: {
          employeeId: id,
          evaluationTemplateId: templateId,
          evaluationType: "custom_items",
          evaluatorComment: items ? JSON.stringify(items) : undefined,
          status: status || "STARTED",
        },
      })
    }

    // レスポンス用に項目を取得
    let responseItems = items
    if (!responseItems && evaluation.evaluatorComment) {
      try {
        responseItems = JSON.parse(evaluation.evaluatorComment)
      } catch {
        responseItems = []
      }
    }

    return NextResponse.json({
      id: evaluation.id,
      employeeId: id,
      items: responseItems || [],
      isCustom: true,
      status: evaluation.status,
    })
  } catch (error) {
    console.error("評価項目保存エラー:", error)
    return NextResponse.json(
      { error: "評価項目の保存に失敗しました" },
      { status: 500 }
    )
  }
}
