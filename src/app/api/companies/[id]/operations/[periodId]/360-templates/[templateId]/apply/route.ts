import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const applyTemplateSchema = z.object({
  overwrite: z.boolean().optional().default(false),
  employeeIds: z.array(z.string()).optional(),
})

interface ApplyDetail {
  employeeId: string
  employeeName: string
  status: "applied" | "skipped" | "error"
  reason?: string
}

// POST: テンプレートを従業員に一括適用
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; templateId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, templateId } = await params
    const body = await request.json()

    const validationResult = applyTemplateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { overwrite, employeeIds } = validationResult.data

    // テンプレートを取得（カテゴリ・アイテム・対象等級・職種含む）
    const template = await prisma.evaluation360Template.findUnique({
      where: { id: templateId },
      include: {
        categories: {
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        grades: {
          select: { gradeId: true },
        },
        jobTypes: {
          select: { jobTypeId: true },
        },
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    // テンプレートが期間固有かつ対象期間であることを確認
    if (template.periodId && template.periodId !== periodId) {
      return NextResponse.json(
        { error: "この期間のテンプレートではありません" },
        { status: 400 }
      )
    }

    const targetGradeIds = template.grades.map((g) => g.gradeId)
    const targetJobTypeIds = template.jobTypes.map((jt) => jt.jobTypeId)

    // 対象となる360評価レコードを取得（準備中ステータスのみ）
    const targetRecords = await prisma.evaluation360Record.findMany({
      where: {
        companyId,
        evaluationPeriodId: periodId,
        status: { in: ["draft", "preparing_items", "preparing_reviewers", "ready"] },
        employee: {
          gradeId: { in: targetGradeIds },
          jobTypeId: { in: targetJobTypeIds },
        },
        ...(employeeIds && employeeIds.length > 0 && { employeeId: { in: employeeIds } }),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gradeId: true,
            jobTypeId: true,
          },
        },
      },
    })

    if (targetRecords.length === 0) {
      return NextResponse.json({
        success: true,
        appliedCount: 0,
        skippedCount: 0,
        message: "対象となる従業員がいません",
        details: [],
      })
    }

    const details: ApplyDetail[] = []
    let appliedCount = 0
    let skippedCount = 0

    for (const record of targetRecords) {
      const employee = record.employee
      const employeeName = `${employee.lastName}${employee.firstName}`

      // 既存の評価項目を取得
      const existingItems = await prisma.evaluationCustomItem.findMany({
        where: {
          employeeId: employee.id,
          periodId,
          evaluationType: "360",
          isDeleted: false,
        },
        include: {
          evaluation360Scores: true,
        },
      })

      // 既にスコアがある項目があるかチェック
      const hasScores = existingItems.some(
        (item) =>
          item.evaluation360Scores.length > 0 &&
          item.evaluation360Scores.some((score) => score.score !== null)
      )

      if (hasScores && !overwrite) {
        // スコアがあり、上書きモードでない場合はスキップ
        details.push({
          employeeId: employee.id,
          employeeName,
          status: "skipped",
          reason: "既に評価スコアが入力されています（上書きオプションが無効）",
        })
        skippedCount++
        continue
      }

      if (existingItems.length > 0 && !overwrite) {
        // 項目があり、上書きモードでない場合はスキップ
        details.push({
          employeeId: employee.id,
          employeeName,
          status: "skipped",
          reason: "既に評価項目が設定されています（上書きオプションが無効）",
        })
        skippedCount++
        continue
      }

      try {
        await prisma.$transaction(async (tx) => {
          // 既存項目を削除（上書きモードの場合）
          if (existingItems.length > 0 && overwrite) {
            await tx.evaluationCustomItem.deleteMany({
              where: {
                employeeId: employee.id,
                periodId,
                evaluationType: "360",
              },
            })
          }

          // テンプレートから新しい項目を作成
          const itemsToCreate = template.categories.flatMap((category) =>
            category.items.map((item) => ({
              companyId,
              employeeId: employee.id,
              periodId,
              evaluationType: "360",
              sourceTemplateItemId: item.id,
              itemName: item.content,
              description: null,
              maxScore: item.maxScore,
              sortOrder: item.sortOrder,
              categoryName: category.name,
              categorySortOrder: category.sortOrder,
              isCustomized: false,
              isAdded: false,
              isDeleted: false,
            }))
          )

          if (itemsToCreate.length > 0) {
            await tx.evaluationCustomItem.createMany({
              data: itemsToCreate,
            })
          }

          // ステータスを preparing_items に更新（draft の場合のみ）
          if (record.status === "draft") {
            await tx.evaluation360Record.update({
              where: { id: record.id },
              data: { status: "preparing_items" },
            })
          }
        })

        details.push({
          employeeId: employee.id,
          employeeName,
          status: "applied",
        })
        appliedCount++
      } catch (error) {
        console.error(`従業員 ${employeeName} への適用エラー:`, error)
        details.push({
          employeeId: employee.id,
          employeeName,
          status: "error",
          reason: "適用中にエラーが発生しました",
        })
        skippedCount++
      }
    }

    return NextResponse.json({
      success: true,
      appliedCount,
      skippedCount,
      message: `${appliedCount}件に適用、${skippedCount}件スキップ`,
      details,
    })
  } catch (error) {
    console.error("テンプレート一括適用エラー:", error)
    return NextResponse.json(
      { error: "テンプレートの一括適用に失敗しました" },
      { status: 500 }
    )
  }
}
