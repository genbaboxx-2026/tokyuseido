import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  individualEvaluationUpdateSchema,
  bulkEvaluationScoresSchema,
} from "@/lib/evaluation/schemas"
import { calculateAverageScore, scoreToRating } from "@/lib/evaluation/calculator"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET: 個別評価詳細取得（スコア含む）
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params

    const evaluation = await prisma.individualEvaluation.findUnique({
      where: { id },
      include: {
        evaluationPeriod: {
          select: {
            id: true,
            name: true,
            periodType: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { id: true, name: true } },
            grade: { select: { id: true, name: true, level: true } },
            jobType: { select: { id: true, name: true } },
          },
        },
        evaluator: {
          select: { id: true, name: true, email: true },
        },
        scores: {
          include: {
            evaluationItem: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true,
                weight: true,
              },
            },
          },
          orderBy: [
            { evaluationItem: { category: "asc" } },
            { evaluationItem: { name: "asc" } },
          ],
        },
      },
    })

    if (!evaluation) {
      return NextResponse.json({ error: "個別評価が見つかりません" }, { status: 404 })
    }

    return NextResponse.json(evaluation)
  } catch (error) {
    console.error("個別評価詳細取得エラー:", error)
    return NextResponse.json({ error: "個別評価の取得に失敗しました" }, { status: 500 })
  }
}

// PUT: 個別評価更新（ステータス更新 or スコア一括入力）
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // 既存の評価を確認
    const existingEvaluation = await prisma.individualEvaluation.findUnique({
      where: { id },
      include: {
        scores: true,
      },
    })

    if (!existingEvaluation) {
      return NextResponse.json({ error: "個別評価が見つかりません" }, { status: 404 })
    }

    // スコア一括入力の場合
    if (body.scores) {
      const validationResult = bulkEvaluationScoresSchema.safeParse({
        individualEvaluationId: id,
        scores: body.scores,
      })

      if (!validationResult.success) {
        return NextResponse.json(
          { error: "入力データが不正です", details: validationResult.error.issues },
          { status: 400 }
        )
      }

      const { scores } = validationResult.data

      // トランザクションでスコアを更新
      await prisma.$transaction(async (tx) => {
        for (const score of scores) {
          const existingScore = existingEvaluation.scores.find(
            (s) => s.evaluationItemId === score.evaluationItemId
          )

          if (existingScore) {
            // 既存スコアを更新
            await tx.evaluationScore.update({
              where: { id: existingScore.id },
              data: {
                selfScore: score.selfScore,
                evaluatorScore: score.evaluatorScore,
                comment: score.comment,
              },
            })
          } else {
            // 新規スコアを作成
            await tx.evaluationScore.create({
              data: {
                individualEvaluationId: id,
                evaluationItemId: score.evaluationItemId,
                selfScore: score.selfScore,
                evaluatorScore: score.evaluatorScore,
                comment: score.comment,
              },
            })
          }
        }

        // 評価者スコアがすべて入力されたかチェック
        const updatedScores = await tx.evaluationScore.findMany({
          where: { individualEvaluationId: id },
        })

        const allEvaluatorScoresFilled = updatedScores.every(
          (s) => s.evaluatorScore !== null
        )

        // 平均点と最終評価を計算
        const averageScore = calculateAverageScore(
          updatedScores.map((s) => ({
            evaluatorScore: s.evaluatorScore,
          }))
        )

        const finalRating = averageScore !== null ? scoreToRating(averageScore) : null

        // 評価のステータスと得点を更新
        await tx.individualEvaluation.update({
          where: { id },
          data: {
            status: allEvaluatorScoresFilled ? "COMPLETED" : "DISTRIBUTED",
            totalScore: averageScore,
            finalRating,
          },
        })
      })

      // 更新後のデータを取得
      const updatedEvaluation = await prisma.individualEvaluation.findUnique({
        where: { id },
        include: {
          scores: {
            include: {
              evaluationItem: true,
            },
          },
        },
      })

      return NextResponse.json(updatedEvaluation)
    }

    // ステータスのみ更新の場合
    const validationResult = individualEvaluationUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { status, totalScore, finalRating } = validationResult.data

    const updateData: {
      status?: "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
      totalScore?: number | null
      finalRating?: "S" | "A" | "B" | "C" | "D" | null
    } = {}

    if (status !== undefined) updateData.status = status
    if (totalScore !== undefined) updateData.totalScore = totalScore
    if (finalRating !== undefined) updateData.finalRating = finalRating

    const evaluation = await prisma.individualEvaluation.update({
      where: { id },
      data: updateData,
      include: {
        evaluationPeriod: {
          select: { id: true, name: true },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        evaluator: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(evaluation)
  } catch (error) {
    console.error("個別評価更新エラー:", error)
    return NextResponse.json({ error: "個別評価の更新に失敗しました" }, { status: 500 })
  }
}

// DELETE: 個別評価削除
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params

    // 既存の評価を確認
    const existingEvaluation = await prisma.individualEvaluation.findUnique({
      where: { id },
    })

    if (!existingEvaluation) {
      return NextResponse.json({ error: "個別評価が見つかりません" }, { status: 404 })
    }

    // 関連するスコアも含めて削除
    await prisma.$transaction([
      prisma.evaluationScore.deleteMany({
        where: { individualEvaluationId: id },
      }),
      prisma.individualEvaluation.delete({
        where: { id },
      }),
    ])

    return NextResponse.json({ message: "個別評価を削除しました" })
  } catch (error) {
    console.error("個別評価削除エラー:", error)
    return NextResponse.json({ error: "個別評価の削除に失敗しました" }, { status: 500 })
  }
}
