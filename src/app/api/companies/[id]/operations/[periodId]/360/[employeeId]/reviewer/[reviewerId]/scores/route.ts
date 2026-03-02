import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const scoreSchema = z.object({
  itemId: z.string(), // evaluationCustomItemId
  score: z.number(),
})

const updateScoresSchema = z.object({
  scores: z.array(scoreSchema),
  comment: z.string().nullable().optional(),
})

// PUT: スコアを保存（一時保存）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string; reviewerId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId, employeeId, reviewerId } = await params
    const body = await request.json()

    const validationResult = updateScoresSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { scores, comment } = validationResult.data

    // レコードを取得
    const record = await prisma.evaluation360Record.findUnique({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId,
        },
      },
    })

    if (!record) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      )
    }

    if (record.status !== "distributing" && record.status !== "collecting") {
      return NextResponse.json(
        { error: "スコアの保存は配布・回収フェーズでのみ可能です" },
        { status: 400 }
      )
    }

    // 評価者アサインを取得
    const assignment = await prisma.evaluation360ReviewerAssignment.findUnique({
      where: {
        recordId_reviewerId: {
          recordId: record.id,
          reviewerId,
        },
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: "評価者が見つかりません" },
        { status: 404 }
      )
    }

    if (assignment.status === "submitted") {
      return NextResponse.json(
        { error: "提出済みの評価は編集できません" },
        { status: 400 }
      )
    }

    // トランザクションでスコアを更新
    await prisma.$transaction(async (tx) => {
      // スコアをupsert
      for (const scoreData of scores) {
        await tx.evaluation360Score.upsert({
          where: {
            evaluationCustomItemId_reviewerAssignmentId: {
              evaluationCustomItemId: scoreData.itemId,
              reviewerAssignmentId: assignment.id,
            },
          },
          create: {
            reviewerAssignmentId: assignment.id,
            evaluationCustomItemId: scoreData.itemId,
            score: scoreData.score,
          },
          update: {
            score: scoreData.score,
          },
        })
      }

      // 評価者ステータスを in_progress に変更
      await tx.evaluation360ReviewerAssignment.update({
        where: { id: assignment.id },
        data: {
          status: "in_progress",
          comment: comment !== undefined ? comment : assignment.comment,
        },
      })
    })

    return NextResponse.json({ success: true, message: "スコアを保存しました" })
  } catch (error) {
    console.error("スコア保存エラー:", error)
    return NextResponse.json(
      { error: "スコアの保存に失敗しました" },
      { status: 500 }
    )
  }
}

// GET: 評価者のスコアを取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string; reviewerId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, employeeId, reviewerId } = await params

    // レコードを取得
    const record = await prisma.evaluation360Record.findUnique({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            grade: { select: { id: true, name: true } },
            jobType: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!record) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      )
    }

    // EvaluationCustomItemから評価項目を取得
    const customItems = await prisma.evaluationCustomItem.findMany({
      where: {
        employeeId,
        companyId,
        periodId,
        evaluationType: "360",
        isDeleted: false,
      },
      orderBy: [
        { categorySortOrder: "asc" },
        { sortOrder: "asc" },
      ],
    })

    // 評価者アサインを取得
    const assignment = await prisma.evaluation360ReviewerAssignment.findUnique({
      where: {
        recordId_reviewerId: {
          recordId: record.id,
          reviewerId,
        },
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        scores: true,
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: "評価者が見つかりません" },
        { status: 404 }
      )
    }

    // スコアをマップに変換
    const scoreMap = new Map(
      assignment.scores.map((s) => [s.evaluationCustomItemId, s.score])
    )

    // カテゴリごとにグループ化
    const categoriesMap = new Map<string, {
      id: string
      name: string
      sortOrder: number
      items: {
        id: string
        content: string
        maxScore: number
        sortOrder: number
        score: number | null
      }[]
    }>()

    customItems.forEach((item) => {
      const categoryName = item.categoryName || "その他"
      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          id: `cat-${categoriesMap.size}`,
          name: categoryName,
          sortOrder: item.categorySortOrder || 0,
          items: [],
        })
      }
      categoriesMap.get(categoryName)!.items.push({
        id: item.id,
        content: item.itemName,
        maxScore: item.maxScore,
        sortOrder: item.sortOrder,
        score: scoreMap.get(item.id) ?? null,
      })
    })

    const categories = Array.from(categoriesMap.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    )

    return NextResponse.json({
      record: {
        id: record.id,
        employee: record.employee,
        status: record.status,
      },
      assignment: {
        id: assignment.id,
        reviewer: assignment.reviewer,
        status: assignment.status,
        comment: assignment.comment,
        submittedAt: assignment.submittedAt,
      },
      categories,
    })
  } catch (error) {
    console.error("スコア取得エラー:", error)
    return NextResponse.json(
      { error: "スコアの取得に失敗しました" },
      { status: 500 }
    )
  }
}
