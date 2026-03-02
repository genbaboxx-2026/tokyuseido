import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const configUpdateSchema = z.object({
  isEnabled: z.boolean(),
})

// PUT: 個別のGradeJobTypeConfigの更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { configId } = await params
    const body = await request.json()
    const validationResult = configUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { isEnabled } = validationResult.data

    // 設定の存在確認
    const existingConfig = await prisma.gradeJobTypeConfig.findUnique({
      where: { id: configId },
    })

    if (!existingConfig) {
      return NextResponse.json({ error: "設定が見つかりません" }, { status: 404 })
    }

    const config = await prisma.gradeJobTypeConfig.update({
      where: { id: configId },
      data: { isEnabled },
      include: {
        grade: true,
        jobType: true,
        gradeRole: true,
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error("Config更新エラー:", error)
    return NextResponse.json({ error: "設定の更新に失敗しました" }, { status: 500 })
  }
}
