import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

// GET: 評価詳細を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: evaluationId } = await params

    const evaluation = await prisma.employeeEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            grade: { select: { id: true, name: true } },
            jobType: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        evaluationTemplate: {
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        items: {
          include: {
            evaluationTemplateItem: true,
          },
        },
      },
    })

    if (!evaluation) {
      return NextResponse.json(
        { error: "評価が見つかりません" },
        { status: 404 }
      )
    }

    // テンプレート項目と実際のスコアをマージ
    const itemsWithScores = evaluation.evaluationTemplate.items.map((templateItem) => {
      const evaluationItem = evaluation.items.find(
        (item) => item.evaluationTemplateItemId === templateItem.id
      )
      return {
        id: templateItem.id,
        name: templateItem.name,
        description: templateItem.description,
        category: templateItem.category,
        maxScore: templateItem.maxScore,
        weight: templateItem.weight,
        sortOrder: templateItem.sortOrder,
        selfScore: evaluationItem?.selfScore ?? null,
        evaluatorScore: evaluationItem?.evaluatorScore ?? null,
        comment: evaluationItem?.comment ?? null,
        evaluationItemId: evaluationItem?.id ?? null,
      }
    })

    return NextResponse.json({
      id: evaluation.id,
      employeeId: evaluation.employeeId,
      evaluationTemplateId: evaluation.evaluationTemplateId,
      evaluationType: evaluation.evaluationType,
      status: evaluation.status,
      totalScore: evaluation.totalScore,
      finalRating: evaluation.finalRating,
      evaluatorComment: evaluation.evaluatorComment,
      selfComment: evaluation.selfComment,
      employee: evaluation.employee,
      templateName: evaluation.evaluationTemplate.name,
      items: itemsWithScores,
    })
  } catch (error) {
    console.error("評価詳細取得エラー:", error)
    return NextResponse.json(
      { error: "評価の取得に失敗しました" },
      { status: 500 }
    )
  }
}

// スコア保存用スキーマ
const scoreItemSchema = z.object({
  templateItemId: z.string(),
  selfScore: z.number().min(0).max(5).nullable().optional(),
  evaluatorScore: z.number().min(0).max(5).nullable().optional(),
  comment: z.string().nullable().optional(),
})

const updateEvaluationSchema = z.object({
  items: z.array(scoreItemSchema).optional(),
  evaluatorComment: z.string().nullable().optional(),
  selfComment: z.string().nullable().optional(),
  status: z.enum(["STARTED", "PREPARING", "DISTRIBUTED", "COLLECTED", "AGGREGATING", "COMPLETED"]).optional(),
  finalRating: z.enum(["S", "A", "B", "C", "D"]).nullable().optional(),
})

// PATCH: 評価スコアを保存
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: evaluationId } = await params
    const body = await request.json()

    const validationResult = updateEvaluationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { items, evaluatorComment, selfComment, status, finalRating } = validationResult.data

    // 評価の存在確認
    const evaluation = await prisma.employeeEvaluation.findUnique({
      where: { id: evaluationId },
    })

    if (!evaluation) {
      return NextResponse.json(
        { error: "評価が見つかりません" },
        { status: 404 }
      )
    }

    // トランザクションで更新
    const result = await prisma.$transaction(async (tx) => {
      // 各項目のスコアをupsert
      if (items && items.length > 0) {
        for (const item of items) {
          await tx.employeeEvaluationItem.upsert({
            where: {
              employeeEvaluationId_evaluationTemplateItemId: {
                employeeEvaluationId: evaluationId,
                evaluationTemplateItemId: item.templateItemId,
              },
            },
            create: {
              employeeEvaluationId: evaluationId,
              evaluationTemplateItemId: item.templateItemId,
              selfScore: item.selfScore ?? null,
              evaluatorScore: item.evaluatorScore ?? null,
              comment: item.comment ?? null,
            },
            update: {
              selfScore: item.selfScore ?? null,
              evaluatorScore: item.evaluatorScore ?? null,
              comment: item.comment ?? null,
            },
          })
        }
      }

      // 合計スコアを計算
      const allItems = await tx.employeeEvaluationItem.findMany({
        where: { employeeEvaluationId: evaluationId },
        include: { evaluationTemplateItem: true },
      })

      let totalScore: number | null = null
      if (allItems.length > 0) {
        const scores = allItems
          .filter((item) => item.evaluatorScore !== null)
          .map((item) => ({
            score: item.evaluatorScore!,
            weight: item.evaluationTemplateItem.weight,
          }))

        if (scores.length > 0) {
          const weightedSum = scores.reduce((sum, item) => sum + item.score * item.weight, 0)
          const totalWeight = scores.reduce((sum, item) => sum + item.weight, 0)
          totalScore = totalWeight > 0 ? weightedSum / totalWeight : null
        }
      }

      // 評価本体を更新
      const updateData: {
        evaluatorComment?: string | null
        selfComment?: string | null
        status?: "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
        finalRating?: "S" | "A" | "B" | "C" | "D" | null
        totalScore?: number | null
      } = {}

      if (evaluatorComment !== undefined) updateData.evaluatorComment = evaluatorComment
      if (selfComment !== undefined) updateData.selfComment = selfComment
      if (status !== undefined) updateData.status = status
      if (finalRating !== undefined) updateData.finalRating = finalRating
      if (totalScore !== null) updateData.totalScore = totalScore

      const updatedEvaluation = await tx.employeeEvaluation.update({
        where: { id: evaluationId },
        data: updateData,
      })

      return updatedEvaluation
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("評価保存エラー:", error)
    return NextResponse.json(
      { error: "評価の保存に失敗しました" },
      { status: 500 }
    )
  }
}
