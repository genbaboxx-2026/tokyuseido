import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 全draft/preparing_items者にテンプレートから項目を一括生成
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

    // リクエストbodyからoverwriteフラグを取得
    const body = await request.json().catch(() => ({}))
    const { overwrite = false } = body as { overwrite?: boolean }

    // draft または preparing_items ステータスのレコードを取得
    const targetRecords = await prisma.evaluation360Record.findMany({
      where: {
        companyId,
        evaluationPeriodId: periodId,
        status: { in: ["draft", "preparing_items"] },
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
        employeeId: { in: targetRecords.map((r) => r.employeeId) },
      },
      _count: { id: true },
    })

    const itemCountMap = new Map(
      recordItemCounts.map((r) => [r.employeeId, r._count.id])
    )

    // overwrite=false の場合は項目未設定のレコードのみ対象
    // overwrite=true の場合は全対象レコード
    const recordsToGenerate = overwrite
      ? targetRecords
      : targetRecords.filter((r) => (itemCountMap.get(r.employeeId) || 0) === 0)

    if (recordsToGenerate.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        message: overwrite
          ? "生成対象のレコードがありません"
          : "生成対象のレコードがありません（全員項目設定済みまたは対象外ステータス）",
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
        // overwrite=true の場合は既存項目を削除
        if (overwrite) {
          await tx.evaluationCustomItem.deleteMany({
            where: {
              employeeId,
              periodId,
              evaluationType: "360",
            },
          })
        }

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

        // ステータスを preparing_items に更新（既に preparing_items の場合も再設定）
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
