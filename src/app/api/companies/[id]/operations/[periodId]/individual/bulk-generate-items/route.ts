import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 全STARTED者にテンプレートから項目を一括生成
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

    // STARTED ステータスの評価を取得（項目数も含む）
    const startedEvaluations = await prisma.employeeEvaluation.findMany({
      where: {
        evaluationPeriodId: periodId,
        evaluationType: "individual",
        status: "STARTED",
      },
      include: {
        employee: {
          select: {
            id: true,
            gradeId: true,
            jobTypeId: true,
          },
        },
        items: {
          select: { id: true },
        },
      },
    })

    // 既に項目があるレコードはスキップ
    const evaluationsToGenerate = startedEvaluations.filter(
      (e) => e.items.length === 0
    )

    if (evaluationsToGenerate.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        message: "生成対象の評価がありません（全員項目設定済みまたはSTARTED以外）",
      })
    }

    // 等級×職種ごとのテンプレートを取得
    const templates = await prisma.evaluationTemplate.findMany({
      where: {
        gradeJobTypeConfig: {
          grade: { companyId },
          isEnabled: true,
        },
        isActive: true,
      },
      include: {
        gradeJobTypeConfig: {
          select: { gradeId: true, jobTypeId: true },
        },
        items: {
          orderBy: { sortOrder: "asc" },
          select: { id: true },
        },
      },
    })

    // テンプレートマップを作成
    const templateMap = new Map<string, typeof templates[0]>()
    for (const template of templates) {
      const key = `${template.gradeJobTypeConfig.gradeId}-${template.gradeJobTypeConfig.jobTypeId}`
      templateMap.set(key, template)
    }

    let generatedCount = 0
    let skippedNoTemplate = 0

    for (const evaluation of evaluationsToGenerate) {
      const { gradeId, jobTypeId } = evaluation.employee

      if (!gradeId || !jobTypeId) {
        skippedNoTemplate++
        continue
      }

      const key = `${gradeId}-${jobTypeId}`
      const template = templateMap.get(key)

      if (!template || template.items.length === 0) {
        skippedNoTemplate++
        continue
      }

      // トランザクションで項目を作成してステータスを更新
      await prisma.$transaction(async (tx) => {
        // 評価項目を作成
        await tx.employeeEvaluationItem.createMany({
          data: template.items.map((item) => ({
            employeeEvaluationId: evaluation.id,
            evaluationTemplateItemId: item.id,
          })),
        })

        // ステータスを PREPARING に更新
        await tx.employeeEvaluation.update({
          where: { id: evaluation.id },
          data: { status: "PREPARING" },
        })
      })

      generatedCount++
    }

    return NextResponse.json({
      success: true,
      generated: generatedCount,
      skippedNoTemplate,
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
