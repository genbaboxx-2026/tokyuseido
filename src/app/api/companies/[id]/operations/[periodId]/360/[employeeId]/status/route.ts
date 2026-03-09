import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

// ステータス遷移の定義
type Evaluation360Status =
  | "draft"
  | "preparing_items"
  | "preparing_reviewers"
  | "ready"
  | "distributing"
  | "collecting"
  | "aggregated"
  | "completed"

const allowedTransitions: Record<Evaluation360Status, Evaluation360Status[]> = {
  draft: ["preparing_items", "preparing_reviewers", "ready"],
  preparing_items: ["preparing_reviewers", "ready"],
  preparing_reviewers: ["ready", "preparing_items"],
  ready: ["preparing_items", "preparing_reviewers", "distributing"],
  distributing: ["ready", "preparing_items", "collecting"],
  collecting: ["distributing", "aggregated"],
  aggregated: ["collecting", "completed"],
  completed: [],
}

const statusSchema = z.object({
  status: z.enum([
    "draft",
    "preparing_items",
    "preparing_reviewers",
    "ready",
    "distributing",
    "collecting",
    "aggregated",
    "completed",
  ]),
})

// PATCH: ステータス遷移
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, employeeId } = await params
    const body = await request.json()

    const validationResult = statusSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { status: newStatus } = validationResult.data

    // レコードを取得
    const record = await prisma.evaluation360Record.findUnique({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId,
        },
      },
      include: {
        reviewerAssignments: true,
      },
    })

    if (!record) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      )
    }

    const currentStatus = record.status as Evaluation360Status
    console.log(`[Status API] employeeId=${employeeId}, currentStatus=${currentStatus}, newStatus=${newStatus}, reviewerCount=${record.reviewerAssignments.length}`)

    // completedは変更不可
    if (currentStatus === "completed") {
      return NextResponse.json(
        { error: "確定済みのレコードは変更できません" },
        { status: 403 }
      )
    }

    // 遷移可能かチェック
    const allowed = allowedTransitions[currentStatus]
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `${currentStatus} から ${newStatus} への遷移は許可されていません`,
          allowedTransitions: allowed,
        },
        { status: 400 }
      )
    }

    // 遷移前提条件のバリデーション
    if (newStatus === "preparing_reviewers") {
      // EvaluationCustomItemから項目数を取得
      const itemCount = await prisma.evaluationCustomItem.count({
        where: {
          employeeId,
          companyId,
          periodId,
          evaluationType: "360",
          isDeleted: false,
        },
      })

      if (itemCount === 0) {
        return NextResponse.json(
          { error: "評価項目が1つ以上必要です" },
          { status: 400 }
        )
      }
    }

    // 評価者チェックは不要（評価者未設定でもreadyにできる）
    // if (newStatus === "ready") {
    //   if (record.reviewerAssignments.length === 0) {
    //     return NextResponse.json(
    //       { error: "評価者が1人以上必要です" },
    //       { status: 400 }
    //     )
    //   }
    // }

    // 更新データを準備
    const updateData: {
      status: string
      completedAt?: Date
      completedBy?: string
    } = {
      status: newStatus,
    }

    // completed への遷移時は確定情報を記録
    if (newStatus === "completed") {
      updateData.completedAt = new Date()
      updateData.completedBy = session.user.id
    }

    // distributing への遷移時は評価者ステータスをリセット
    if (newStatus === "distributing" && currentStatus === "ready") {
      await prisma.evaluation360ReviewerAssignment.updateMany({
        where: { recordId: record.id },
        data: {
          status: "not_started",
          submittedAt: null,
        },
      })
    }

    const updatedRecord = await prisma.evaluation360Record.update({
      where: { id: record.id },
      data: updateData,
    })

    return NextResponse.json(updatedRecord)
  } catch (error) {
    console.error("ステータス更新エラー:", error)
    return NextResponse.json(
      { error: "ステータスの更新に失敗しました" },
      { status: 500 }
    )
  }
}
