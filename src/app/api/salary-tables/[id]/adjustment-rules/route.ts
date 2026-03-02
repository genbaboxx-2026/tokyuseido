/**
 * 号俸改定ルールAPI
 * GET /api/salary-tables/[id]/adjustment-rules - 改定ルール一覧取得
 * POST /api/salary-tables/[id]/adjustment-rules - 改定ルール一括更新
 * DELETE /api/salary-tables/[id]/adjustment-rules - 改定ルール全削除（デフォルトリセット用）
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * 改定ルール一覧取得
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id: salaryTableId } = await context.params

    // 号俸テーブルの存在確認
    const salaryTable = await prisma.salaryTable.findUnique({
      where: { id: salaryTableId },
    })

    if (!salaryTable) {
      return NextResponse.json(
        { error: "号俸テーブルが見つかりません" },
        { status: 404 }
      )
    }

    const rules = await prisma.salaryAdjustmentRule.findMany({
      where: { salaryTableId },
      orderBy: [
        { currentBand: "asc" },
        { isTransition: "asc" },
        { targetBand: "asc" },
      ],
    })

    return NextResponse.json(rules)
  } catch (error) {
    console.error("改定ルール取得エラー:", error)
    return NextResponse.json(
      { error: "改定ルールの取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 改定ルール一括更新
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id: salaryTableId } = await context.params
    const body = await request.json()

    // 号俸テーブルの存在確認
    const salaryTable = await prisma.salaryTable.findUnique({
      where: { id: salaryTableId },
    })

    if (!salaryTable) {
      return NextResponse.json(
        { error: "号俸テーブルが見つかりません" },
        { status: 404 }
      )
    }

    const { rules } = body as {
      rules: Array<{
        currentBand: number
        isTransition: boolean
        targetBand: number
        adjustmentValue: number
      }>
    }

    if (!rules || !Array.isArray(rules)) {
      return NextResponse.json(
        { error: "ルールの配列が必要です" },
        { status: 400 }
      )
    }

    // 既存のルールを削除して新しいルールを作成（upsertMany的な操作）
    await prisma.$transaction(async (tx) => {
      // 既存のルールを削除
      await tx.salaryAdjustmentRule.deleteMany({
        where: { salaryTableId },
      })

      // 新しいルールを作成
      if (rules.length > 0) {
        await tx.salaryAdjustmentRule.createMany({
          data: rules.map((rule) => ({
            salaryTableId,
            currentBand: rule.currentBand,
            isTransition: rule.isTransition,
            targetBand: rule.targetBand,
            adjustmentValue: rule.adjustmentValue,
          })),
        })
      }
    })

    // 更新後のルールを取得して返す
    const updatedRules = await prisma.salaryAdjustmentRule.findMany({
      where: { salaryTableId },
      orderBy: [
        { currentBand: "asc" },
        { isTransition: "asc" },
        { targetBand: "asc" },
      ],
    })

    return NextResponse.json(updatedRules)
  } catch (error) {
    console.error("改定ルール更新エラー:", error)
    return NextResponse.json(
      { error: "改定ルールの更新に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 改定ルール全削除（デフォルトにリセット）
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id: salaryTableId } = await context.params

    // 号俸テーブルの存在確認
    const salaryTable = await prisma.salaryTable.findUnique({
      where: { id: salaryTableId },
    })

    if (!salaryTable) {
      return NextResponse.json(
        { error: "号俸テーブルが見つかりません" },
        { status: 404 }
      )
    }

    await prisma.salaryAdjustmentRule.deleteMany({
      where: { salaryTableId },
    })

    return NextResponse.json({ message: "改定ルールを削除しました" })
  } catch (error) {
    console.error("改定ルール削除エラー:", error)
    return NextResponse.json(
      { error: "改定ルールの削除に失敗しました" },
      { status: 500 }
    )
  }
}
