import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { evaluationPeriodUpdateSchema } from "@/lib/evaluation/schemas"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET: 評価期間詳細取得
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params

    const period = await prisma.evaluationPeriod.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            individualEvaluations: true,
            evaluation360s: true,
          },
        },
      },
    })

    if (!period) {
      return NextResponse.json({ error: "評価期間が見つかりません" }, { status: 404 })
    }

    return NextResponse.json(period)
  } catch (error) {
    console.error("評価期間詳細取得エラー:", error)
    return NextResponse.json({ error: "評価期間の取得に失敗しました" }, { status: 500 })
  }
}

// PUT: 評価期間更新
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validationResult = evaluationPeriodUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    // 既存の評価期間を確認
    const existingPeriod = await prisma.evaluationPeriod.findUnique({
      where: { id },
    })

    if (!existingPeriod) {
      return NextResponse.json({ error: "評価期間が見つかりません" }, { status: 404 })
    }

    const { name, periodType, startDate, endDate, status } = validationResult.data

    // 日付の妥当性チェック
    const newStartDate = startDate ? new Date(startDate) : existingPeriod.startDate
    const newEndDate = endDate ? new Date(endDate) : existingPeriod.endDate

    if (newStartDate >= newEndDate) {
      return NextResponse.json(
        { error: "終了日は開始日より後の日付を指定してください" },
        { status: 400 }
      )
    }

    // 同一会社内で同じ期間名が存在しないか確認（自分以外）
    if (name) {
      const duplicatePeriod = await prisma.evaluationPeriod.findFirst({
        where: {
          companyId: existingPeriod.companyId,
          name,
          NOT: { id },
        },
      })

      if (duplicatePeriod) {
        return NextResponse.json(
          { error: "同じ評価期間名が既に存在します" },
          { status: 400 }
        )
      }
    }

    const updateData: {
      name?: string
      periodType?: "FIRST_HALF" | "SECOND_HALF"
      startDate?: Date
      endDate?: Date
      status?: "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
    } = {}

    if (name !== undefined) updateData.name = name
    if (periodType !== undefined) updateData.periodType = periodType
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = new Date(endDate)
    if (status !== undefined) updateData.status = status

    const period = await prisma.evaluationPeriod.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(period)
  } catch (error) {
    console.error("評価期間更新エラー:", error)
    return NextResponse.json({ error: "評価期間の更新に失敗しました" }, { status: 500 })
  }
}

// DELETE: 評価期間削除
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params

    // 既存の評価期間を確認
    const existingPeriod = await prisma.evaluationPeriod.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            individualEvaluations: true,
            evaluation360s: true,
          },
        },
      },
    })

    if (!existingPeriod) {
      return NextResponse.json({ error: "評価期間が見つかりません" }, { status: 404 })
    }

    // 関連する評価がある場合は削除不可
    if (existingPeriod._count.individualEvaluations > 0 || existingPeriod._count.evaluation360s > 0) {
      return NextResponse.json(
        { error: "関連する評価データがあるため削除できません" },
        { status: 400 }
      )
    }

    await prisma.evaluationPeriod.delete({
      where: { id },
    })

    return NextResponse.json({ message: "評価期間を削除しました" })
  } catch (error) {
    console.error("評価期間削除エラー:", error)
    return NextResponse.json({ error: "評価期間の削除に失敗しました" }, { status: 500 })
  }
}
