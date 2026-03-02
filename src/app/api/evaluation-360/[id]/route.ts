import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

// GET: 360度評価詳細を取得
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

    // EmployeeEvaluationから360度評価データを取得
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
      },
    })

    if (!evaluation) {
      return NextResponse.json(
        { error: "評価が見つかりません" },
        { status: 404 }
      )
    }

    // 360度評価用のスコアデータを取得（JSONで保存している場合）
    // evaluatorCommentにJSON形式で保存: { evaluators: [{name, scores: {itemId: score}}] }
    let evaluatorsData: {
      id: string
      name: string
      scores: Record<string, number | null>
    }[] = []

    if (evaluation.evaluatorComment) {
      try {
        const parsed = JSON.parse(evaluation.evaluatorComment)
        if (parsed.evaluators && Array.isArray(parsed.evaluators)) {
          evaluatorsData = parsed.evaluators
        }
      } catch {
        // JSONパースエラーの場合は空配列
      }
    }

    // デフォルトで4人の評価者枠を用意
    if (evaluatorsData.length === 0) {
      evaluatorsData = [
        { id: "eval1", name: "評価者1", scores: {} },
        { id: "eval2", name: "評価者2", scores: {} },
        { id: "eval3", name: "評価者3", scores: {} },
        { id: "eval4", name: "評価者4", scores: {} },
      ]
    }

    // テンプレート項目を整形
    const items = evaluation.evaluationTemplate.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      maxScore: item.maxScore,
      weight: item.weight,
      sortOrder: item.sortOrder,
    }))

    return NextResponse.json({
      id: evaluation.id,
      employeeId: evaluation.employeeId,
      evaluationType: evaluation.evaluationType,
      status: evaluation.status,
      totalScore: evaluation.totalScore,
      finalRating: evaluation.finalRating,
      selfComment: evaluation.selfComment,
      employee: evaluation.employee,
      templateName: evaluation.evaluationTemplate.name,
      items,
      evaluators: evaluatorsData,
    })
  } catch (error) {
    console.error("360度評価詳細取得エラー:", error)
    return NextResponse.json(
      { error: "評価の取得に失敗しました" },
      { status: 500 }
    )
  }
}

// 保存用スキーマ
const evaluatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  scores: z.record(z.string(), z.number().min(0).max(5).nullable()),
})

const update360Schema = z.object({
  evaluators: z.array(evaluatorSchema).optional(),
  selfComment: z.string().nullable().optional(),
  status: z.enum(["STARTED", "PREPARING", "DISTRIBUTED", "COLLECTED", "AGGREGATING", "COMPLETED"]).optional(),
  finalRating: z.enum(["S", "A", "B", "C", "D"]).nullable().optional(),
})

// PATCH: 360度評価スコアを保存
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

    const validationResult = update360Schema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { evaluators, selfComment, status, finalRating } = validationResult.data

    // 評価の存在確認
    const evaluation = await prisma.employeeEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        evaluationTemplate: {
          include: { items: true },
        },
      },
    })

    if (!evaluation) {
      return NextResponse.json(
        { error: "評価が見つかりません" },
        { status: 404 }
      )
    }

    // 平均スコアを計算
    let totalScore: number | null = null
    if (evaluators && evaluators.length > 0) {
      const itemIds = evaluation.evaluationTemplate.items.map((i) => i.id)
      const itemWeights = new Map(
        evaluation.evaluationTemplate.items.map((i) => [i.id, i.weight])
      )

      // 各項目の平均スコアを計算
      const itemAverages: { itemId: string; avgScore: number; weight: number }[] = []

      for (const itemId of itemIds) {
        const scores = evaluators
          .map((e) => e.scores[itemId])
          .filter((s): s is number => s !== null && s !== undefined)

        if (scores.length > 0) {
          const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length
          itemAverages.push({
            itemId,
            avgScore: avg,
            weight: itemWeights.get(itemId) || 1,
          })
        }
      }

      if (itemAverages.length > 0) {
        const weightedSum = itemAverages.reduce(
          (sum, item) => sum + item.avgScore * item.weight,
          0
        )
        const totalWeight = itemAverages.reduce((sum, item) => sum + item.weight, 0)
        totalScore = totalWeight > 0 ? weightedSum / totalWeight : null
      }
    }

    // 更新データを構築
    const updateData: {
      evaluatorComment?: string
      selfComment?: string | null
      status?: "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
      finalRating?: "S" | "A" | "B" | "C" | "D" | null
      totalScore?: number | null
    } = {}

    if (evaluators) {
      updateData.evaluatorComment = JSON.stringify({ evaluators })
    }
    if (selfComment !== undefined) updateData.selfComment = selfComment
    if (status !== undefined) updateData.status = status
    if (finalRating !== undefined) updateData.finalRating = finalRating
    if (totalScore !== null) updateData.totalScore = totalScore

    const updatedEvaluation = await prisma.employeeEvaluation.update({
      where: { id: evaluationId },
      data: updateData,
    })

    return NextResponse.json(updatedEvaluation)
  } catch (error) {
    console.error("360度評価保存エラー:", error)
    return NextResponse.json(
      { error: "評価の保存に失敗しました" },
      { status: 500 }
    )
  }
}
