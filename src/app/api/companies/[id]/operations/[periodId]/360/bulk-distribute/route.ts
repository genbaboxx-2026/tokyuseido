import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST: 全員一括配布
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

    // ready ステータスのレコードを取得
    const readyRecords = await prisma.evaluation360Record.findMany({
      where: {
        companyId,
        evaluationPeriodId: periodId,
        status: "ready",
      },
      include: {
        reviewerAssignments: true,
      },
    })

    if (readyRecords.length === 0) {
      return NextResponse.json({
        success: true,
        distributed: 0,
        message: "配布可能なレコードがありません",
      })
    }

    // 評価者が設定されているレコードのみ配布
    const recordsToDistribute = readyRecords.filter(
      (r) => r.reviewerAssignments.length > 0
    )

    if (recordsToDistribute.length === 0) {
      return NextResponse.json({
        success: true,
        distributed: 0,
        skipped: readyRecords.length,
        message: "評価者が設定されているレコードがありません",
      })
    }

    // トランザクションで一括更新
    await prisma.$transaction(async (tx) => {
      const recordIds = recordsToDistribute.map((r) => r.id)

      // 評価者ステータスをリセット
      await tx.evaluation360ReviewerAssignment.updateMany({
        where: { recordId: { in: recordIds } },
        data: {
          status: "not_started",
          submittedAt: null,
        },
      })

      // レコードのステータスを distributing に変更
      await tx.evaluation360Record.updateMany({
        where: { id: { in: recordIds } },
        data: { status: "distributing" },
      })
    })

    return NextResponse.json({
      success: true,
      distributed: recordsToDistribute.length,
      skipped: readyRecords.length - recordsToDistribute.length,
      message: `${recordsToDistribute.length}件の配布を開始しました`,
    })
  } catch (error) {
    console.error("一括配布エラー:", error)
    return NextResponse.json(
      { error: "一括配布に失敗しました" },
      { status: 500 }
    )
  }
}
