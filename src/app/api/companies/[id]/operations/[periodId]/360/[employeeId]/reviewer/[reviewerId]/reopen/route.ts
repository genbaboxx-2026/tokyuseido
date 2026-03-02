import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 再入力依頼（提出済み → 未着手に戻す）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string; reviewerId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId, employeeId, reviewerId } = await params

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

    if (record.status !== "collecting") {
      return NextResponse.json(
        { error: "再入力依頼は回収フェーズでのみ可能です" },
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

    if (assignment.status !== "submitted") {
      return NextResponse.json(
        { error: "提出済みの評価者のみ再入力依頼できます" },
        { status: 400 }
      )
    }

    // ステータスを not_started に戻す（スコアは保持）
    await prisma.evaluation360ReviewerAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "not_started",
        submittedAt: null,
      },
    })

    return NextResponse.json({ success: true, message: "再入力依頼を送信しました" })
  } catch (error) {
    console.error("再入力依頼エラー:", error)
    return NextResponse.json(
      { error: "再入力依頼に失敗しました" },
      { status: 500 }
    )
  }
}
