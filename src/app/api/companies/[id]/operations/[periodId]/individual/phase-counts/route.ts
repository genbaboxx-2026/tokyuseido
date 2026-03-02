import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET: フェーズ別人数を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId } = await params

    // EmployeeEvaluation を使用して個別評価のカウントを取得
    const evaluations = await prisma.employeeEvaluation.findMany({
      where: {
        evaluationPeriodId: periodId,
        evaluationType: "individual",
      },
      select: {
        status: true,
      },
    })

    // フェーズ別にカウント
    // preparing: STARTED, PREPARING (準備中)
    // distributing: DISTRIBUTED (配布中 = 自己評価中 or 上長評価中)
    // collected: COLLECTED (回収済み)
    // aggregated: AGGREGATING (集計中)
    // completed: COMPLETED (完了)
    const counts = {
      preparing: 0,
      distributing: 0,
      collected: 0,
      aggregated: 0,
      completed: 0,
    }

    for (const evaluation of evaluations) {
      switch (evaluation.status) {
        case "STARTED":
        case "PREPARING":
          counts.preparing++
          break
        case "DISTRIBUTED":
          counts.distributing++
          break
        case "COLLECTED":
          counts.collected++
          break
        case "AGGREGATING":
          counts.aggregated++
          break
        case "COMPLETED":
          counts.completed++
          break
      }
    }

    return NextResponse.json(counts)
  } catch (error) {
    console.error("フェーズカウント取得エラー:", error)
    return NextResponse.json(
      { error: "フェーズカウントの取得に失敗しました" },
      { status: 500 }
    )
  }
}
