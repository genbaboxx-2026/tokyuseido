import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type RouteParams = {
  params: Promise<{ id: string; periodId: string }>
}

type Phase = "preparing" | "distributing" | "aggregated"

// フェーズからステータスへのマッピング
const phaseToStatus: Record<Phase, string> = {
  preparing: "ready",          // 準備フェーズ → ready（配布可能状態）
  distributing: "distributing", // 配布・回収フェーズ → distributing
  aggregated: "aggregated",    // 集計フェーズ → aggregated
}

/**
 * PATCH /api/companies/[id]/operations/[periodId]/360/revert-phase
 * 360度評価のフェーズを戻す（completed → 指定フェーズ）
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await context.params
    const body = await request.json()
    const { targetPhase, recordIds } = body as {
      targetPhase: Phase
      recordIds?: string[] // 指定がなければ全completedを対象
    }

    if (!targetPhase || !phaseToStatus[targetPhase]) {
      return NextResponse.json(
        { error: "有効なフェーズを指定してください（preparing, distributing, aggregated）" },
        { status: 400 }
      )
    }

    // 対象のレコードを取得
    const whereClause: {
      evaluationPeriodId: string
      companyId: string
      status: string
      id?: { in: string[] }
    } = {
      evaluationPeriodId: periodId,
      companyId,
      status: "completed",
    }

    if (recordIds && recordIds.length > 0) {
      whereClause.id = { in: recordIds }
    }

    const completedRecords = await prisma.evaluation360Record.findMany({
      where: whereClause,
      select: { id: true },
    })

    if (completedRecords.length === 0) {
      return NextResponse.json({
        success: true,
        reverted: 0,
        message: "戻す対象のレコードがありません",
      })
    }

    const targetStatus = phaseToStatus[targetPhase]

    // ステータスを更新
    const updateResult = await prisma.evaluation360Record.updateMany({
      where: {
        id: { in: completedRecords.map((r) => r.id) },
      },
      data: {
        status: targetStatus,
        completedAt: null,
        completedBy: null,
      },
    })

    // フェーズに応じて追加のクリア処理
    if (targetPhase === "preparing") {
      // 準備フェーズに戻す場合、配布日時もクリア
      await prisma.evaluation360Record.updateMany({
        where: {
          id: { in: completedRecords.map((r) => r.id) },
        },
        data: {
          distributedAt: null,
        },
      })

      // 評価者のスコアもリセット
      await prisma.evaluation360Score.deleteMany({
        where: {
          reviewerAssignment: {
            record: {
              id: { in: completedRecords.map((r) => r.id) },
            },
          },
        },
      })

      // 評価者の状態をリセット
      await prisma.evaluation360ReviewerAssignment.updateMany({
        where: {
          recordId: { in: completedRecords.map((r) => r.id) },
        },
        data: {
          status: "not_started",
          submittedAt: null,
        },
      })
    } else if (targetPhase === "distributing") {
      // 配布・回収フェーズに戻す場合、評価者の状態を維持
      // （スコアは保持、submitted状態は維持）
    }

    const phaseLabels: Record<Phase, string> = {
      preparing: "準備",
      distributing: "配布・回収",
      aggregated: "集計",
    }

    return NextResponse.json({
      success: true,
      reverted: updateResult.count,
      targetPhase,
      message: `${updateResult.count}件のレコードを${phaseLabels[targetPhase]}フェーズに戻しました`,
    })
  } catch (error) {
    console.error("フェーズ戻しエラー:", error)
    return NextResponse.json(
      { error: "フェーズの変更に失敗しました" },
      { status: 500 }
    )
  }
}
