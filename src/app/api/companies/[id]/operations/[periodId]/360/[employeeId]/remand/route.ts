import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const remandSchema = z.object({
  targetStatus: z.enum(["distributing", "collecting"]),
})

// POST: 差し戻し
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId, employeeId } = await params
    const body = await request.json()

    const validationResult = remandSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { targetStatus } = validationResult.data

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

    // 差し戻し可能なステータスをチェック
    const allowedFrom: Record<string, string[]> = {
      distributing: ["collecting"],
      collecting: ["aggregated"],
    }

    if (!allowedFrom[targetStatus]?.includes(record.status)) {
      return NextResponse.json(
        { error: `${record.status} から ${targetStatus} への差し戻しは許可されていません` },
        { status: 400 }
      )
    }

    // ステータスを変更
    await prisma.evaluation360Record.update({
      where: { id: record.id },
      data: { status: targetStatus },
    })

    return NextResponse.json({
      success: true,
      message: `${targetStatus === "distributing" ? "配布" : "回収"}フェーズに差し戻しました`,
    })
  } catch (error) {
    console.error("差し戻しエラー:", error)
    return NextResponse.json(
      { error: "差し戻しに失敗しました" },
      { status: 500 }
    )
  }
}
