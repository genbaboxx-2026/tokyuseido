import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const statusSchema = z.object({
  status: z.enum(["STARTED", "PREPARING", "DISTRIBUTED", "COLLECTED", "AGGREGATING", "COMPLETED"]),
})

// PATCH: 評価ステータスを更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: evaluationId } = await params
    const body = await request.json()

    const validationResult = statusSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { status } = validationResult.data

    // 評価を更新
    const updatedEvaluation = await prisma.employeeEvaluation.update({
      where: { id: evaluationId },
      data: { status },
    })

    return NextResponse.json(updatedEvaluation)
  } catch (error) {
    console.error("ステータス更新エラー:", error)
    return NextResponse.json(
      { error: "ステータスの更新に失敗しました" },
      { status: 500 }
    )
  }
}
