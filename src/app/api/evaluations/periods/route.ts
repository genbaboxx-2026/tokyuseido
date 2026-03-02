import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { evaluationPeriodSchema } from "@/lib/evaluation/schemas"

// GET: 評価期間一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const status = searchParams.get("status")

    if (!companyId) {
      return NextResponse.json({ error: "会社IDは必須です" }, { status: 400 })
    }

    const where: {
      companyId: string
      status?: "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
    } = { companyId }

    if (status) {
      where.status = status as "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
    }

    const periods = await prisma.evaluationPeriod.findMany({
      where,
      orderBy: [{ startDate: "desc" }],
      include: {
        _count: {
          select: {
            individualEvaluations: true,
            evaluation360s: true,
          },
        },
      },
    })

    return NextResponse.json(periods)
  } catch (error) {
    console.error("評価期間一覧取得エラー:", error)
    return NextResponse.json({ error: "評価期間一覧の取得に失敗しました" }, { status: 500 })
  }
}

// POST: 評価期間作成
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = evaluationPeriodSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { companyId, name, periodType, startDate, endDate, status } = validationResult.data

    // 日付の妥当性チェック
    if (new Date(startDate) >= new Date(endDate)) {
      return NextResponse.json(
        { error: "終了日は開始日より後の日付を指定してください" },
        { status: 400 }
      )
    }

    // 同一会社内で同じ期間名が存在しないか確認
    const existingPeriod = await prisma.evaluationPeriod.findFirst({
      where: {
        companyId,
        name,
      },
    })

    if (existingPeriod) {
      return NextResponse.json(
        { error: "同じ評価期間名が既に存在します" },
        { status: 400 }
      )
    }

    const period = await prisma.evaluationPeriod.create({
      data: {
        companyId,
        name,
        periodType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status ?? "STARTED",
      },
    })

    return NextResponse.json(period, { status: 201 })
  } catch (error) {
    console.error("評価期間作成エラー:", error)
    return NextResponse.json({ error: "評価期間の作成に失敗しました" }, { status: 500 })
  }
}
