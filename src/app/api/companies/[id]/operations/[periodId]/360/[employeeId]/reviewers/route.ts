import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

// GET: 評価者一覧（評価者ステータス・全体担当数含む）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId, employeeId } = await params

    // レコードを取得
    const record = await prisma.evaluation360Record.findUnique({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId,
        },
      },
      include: {
        reviewerAssignments: {
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: { select: { id: true, name: true } },
                grade: { select: { id: true, name: true } },
              },
            },
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

    // 各評価者の全体担当数を計算
    const reviewerIds = record.reviewerAssignments.map((ra) => ra.reviewerId)
    const reviewerLoadMap = new Map<string, number>()

    if (reviewerIds.length > 0) {
      const reviewerCounts = await prisma.evaluation360ReviewerAssignment.groupBy({
        by: ["reviewerId"],
        where: {
          reviewerId: { in: reviewerIds },
          record: {
            evaluationPeriodId: periodId,
          },
        },
        _count: { id: true },
      })

      for (const count of reviewerCounts) {
        reviewerLoadMap.set(count.reviewerId, count._count.id)
      }
    }

    // レスポンスを整形
    const reviewers = record.reviewerAssignments.map((ra) => ({
      id: ra.id,
      reviewerId: ra.reviewerId,
      reviewer: ra.reviewer,
      status: ra.status,
      submittedAt: ra.submittedAt,
      totalLoad: reviewerLoadMap.get(ra.reviewerId) || 0,
      loadLevel:
        (reviewerLoadMap.get(ra.reviewerId) || 0) <= 10
          ? "green"
          : (reviewerLoadMap.get(ra.reviewerId) || 0) <= 15
          ? "yellow"
          : "red",
    }))

    return NextResponse.json({
      isAnonymous: record.isAnonymous,
      evaluationMethod: record.evaluationMethod,
      reviewers,
    })
  } catch (error) {
    console.error("評価者一覧取得エラー:", error)
    return NextResponse.json(
      { error: "評価者一覧の取得に失敗しました" },
      { status: 500 }
    )
  }
}

const updateReviewersSchema = z.object({
  reviewerIds: z.array(z.string()),
  isAnonymous: z.boolean().optional(),
  evaluationMethod: z.enum(["web", "paper"]).optional(),
})

// PUT: 評価者の一括設定
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId, employeeId } = await params
    const body = await request.json()

    const validationResult = updateReviewersSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { reviewerIds, isAnonymous, evaluationMethod } = validationResult.data

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

    if (
      record.status !== "draft" &&
      record.status !== "preparing_items" &&
      record.status !== "preparing_reviewers" &&
      record.status !== "ready" &&
      record.status !== "distributing"
    ) {
      return NextResponse.json(
        { error: "評価者の設定は準備・配布フェーズでのみ可能です" },
        { status: 400 }
      )
    }

    // 被評価者自身は評価者に設定できない
    if (reviewerIds.includes(employeeId)) {
      return NextResponse.json(
        { error: "被評価者自身を評価者に設定することはできません" },
        { status: 400 }
      )
    }

    // トランザクションで更新
    await prisma.$transaction(async (tx) => {
      // 既存の評価者を削除
      await tx.evaluation360ReviewerAssignment.deleteMany({
        where: { recordId: record.id },
      })

      // 新しい評価者を追加
      if (reviewerIds.length > 0) {
        await tx.evaluation360ReviewerAssignment.createMany({
          data: reviewerIds.map((reviewerId) => ({
            recordId: record.id,
            reviewerId,
            status: "not_started",
          })),
        })
      }

      // レコードの設定を更新
      const updateData: {
        status?: string
        isAnonymous?: boolean
        evaluationMethod?: string
      } = {}

      if (record.status === "draft" || record.status === "preparing_items") {
        updateData.status = "preparing_reviewers"
      }
      if (isAnonymous !== undefined) {
        updateData.isAnonymous = isAnonymous
      }
      if (evaluationMethod !== undefined) {
        updateData.evaluationMethod = evaluationMethod
      }

      if (Object.keys(updateData).length > 0) {
        await tx.evaluation360Record.update({
          where: { id: record.id },
          data: updateData,
        })
      }
    })

    // 更新後のデータを取得
    const updatedRecord = await prisma.evaluation360Record.findUnique({
      where: { id: record.id },
      include: {
        reviewerAssignments: {
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: { select: { id: true, name: true } },
                grade: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updatedRecord)
  } catch (error) {
    console.error("評価者更新エラー:", error)
    return NextResponse.json(
      { error: "評価者の更新に失敗しました" },
      { status: 500 }
    )
  }
}
