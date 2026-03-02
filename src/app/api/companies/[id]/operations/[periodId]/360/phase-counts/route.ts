import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET: 360度評価のフェーズ別人数を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await params

    // Evaluation360Record を使用してカウントを取得
    const records = await prisma.evaluation360Record.findMany({
      where: {
        companyId,
        evaluationPeriodId: periodId,
      },
      select: {
        status: true,
      },
    })

    // フェーズ別にカウント
    // preparing: draft, preparing_items, preparing_reviewers, ready
    // distributing: distributing, collecting
    // aggregated: aggregated
    // completed: completed
    const counts = {
      preparing: 0,
      distributing: 0,
      aggregated: 0,
      completed: 0,
    }

    for (const record of records) {
      switch (record.status) {
        case "draft":
        case "preparing_items":
        case "preparing_reviewers":
        case "ready":
          counts.preparing++
          break
        case "distributing":
        case "collecting":
          counts.distributing++
          break
        case "aggregated":
          counts.aggregated++
          break
        case "completed":
          counts.completed++
          break
      }
    }

    return NextResponse.json(counts)
  } catch (error) {
    console.error("360度評価フェーズカウント取得エラー:", error)
    return NextResponse.json(
      { error: "フェーズカウントの取得に失敗しました" },
      { status: 500 }
    )
  }
}
