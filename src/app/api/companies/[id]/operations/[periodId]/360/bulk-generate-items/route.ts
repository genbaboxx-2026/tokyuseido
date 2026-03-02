import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 全draft者にテンプレートから項目を一括生成
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

    // draft ステータスのレコードを取得
    const draftRecords = await prisma.evaluation360Record.findMany({
      where: {
        companyId,
        evaluationPeriodId: periodId,
        status: "draft",
      },
      include: {
        employee: {
          select: {
            id: true,
            gradeId: true,
            jobTypeId: true,
          },
        },
      },
    })

    // 各レコードの既存項目数を取得
    const recordItemCounts = await prisma.evaluationCustomItem.groupBy({
      by: ["employeeId"],
      where: {
        companyId,
        periodId,
        evaluationType: "360",
        isDeleted: false,
        employeeId: { in: draftRecords.map((r) => r.employeeId) },
      },
      _count: { id: true },
    })

    const itemCountMap = new Map(
      recordItemCounts.map((r) => [r.employeeId, r._count.id])
    )

    // 既に項目があるレコードはスキップ
    const recordsToGenerate = draftRecords.filter(
      (r) => (itemCountMap.get(r.employeeId) || 0) === 0
    )

    if (recordsToGenerate.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        message: "生成対象のレコードがありません（全員項目設定済みまたはdraft以外）",
      })
    }

    let generatedCount = 0

    for (const record of recordsToGenerate) {
      const { gradeId, jobTypeId, id: employeeId } = record.employee

      if (!gradeId || !jobTypeId) {
        continue
      }

      // テンプレートを検索
      const template = await prisma.evaluation360Template.findFirst({
        where: {
          companyId,
          isActive: true,
          status: "confirmed",
          grades: { some: { gradeId } },
          jobTypes: { some: { jobTypeId } },
        },
        include: {
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
        continue
      }

      // トランザクションでカスタム項目を作成
      await prisma.$transaction(async (tx) => {
        // カスタム項目を作成
        const itemsToCreate = template.categories.flatMap((category) =>
          category.items.map((item) => ({
            companyId,
            employeeId,
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

        // ステータスを preparing_items に更新
        await tx.evaluation360Record.update({
          where: { id: record.id },
          data: { status: "preparing_items" },
        })
      })

      generatedCount++
    }

    return NextResponse.json({
      success: true,
      generated: generatedCount,
      skipped: recordsToGenerate.length - generatedCount,
      message: `${generatedCount}件にテンプレートから項目を生成しました`,
    })
  } catch (error) {
    console.error("一括項目生成エラー:", error)
    return NextResponse.json(
      { error: "一括項目生成に失敗しました" },
      { status: 500 }
    )
  }
}
