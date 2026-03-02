import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 評価を提出
export async function POST(
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
    })

    if (!record) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      )
    }

    if (record.status !== "distributing" && record.status !== "collecting") {
      return NextResponse.json(
        { error: "提出は配布・回収フェーズでのみ可能です" },
        { status: 400 }
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
        scores: true,
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
        { error: "既に提出済みです" },
        { status: 400 }
      )
    }

    // 全項目にスコアが入力されているかチェック
    const allItemIds = customItems.map((item) => item.id)
    const scoredItemIds = new Set(
      assignment.scores.map((s) => s.evaluationCustomItemId)
    )
    const missingItems = allItemIds.filter((id) => !scoredItemIds.has(id))

    if (missingItems.length > 0) {
      return NextResponse.json(
        {
          error: "すべての項目にスコアを入力してください",
          missingCount: missingItems.length,
        },
        { status: 400 }
      )
    }

    // トランザクションで更新
    await prisma.$transaction(async (tx) => {
      // 評価者ステータスを submitted に変更
      await tx.evaluation360ReviewerAssignment.update({
        where: { id: assignment.id },
        data: {
          status: "submitted",
          submittedAt: new Date(),
        },
      })

      // 全評価者の提出状況を確認
      const allAssignments = await tx.evaluation360ReviewerAssignment.findMany({
        where: { recordId: record.id },
      })

      const allSubmitted = allAssignments.every((a) =>
        a.id === assignment.id ? true : a.status === "submitted"
      )

      // 最初の提出時または全員提出時にステータスを更新
      if (record.status === "distributing") {
        // distributing → collecting に遷移
        await tx.evaluation360Record.update({
          where: { id: record.id },
          data: { status: "collecting" },
        })
      }
    })

    return NextResponse.json({ success: true, message: "評価を提出しました" })
  } catch (error) {
    console.error("提出エラー:", error)
    return NextResponse.json(
      { error: "提出に失敗しました" },
      { status: 500 }
    )
  }
}
