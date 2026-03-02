import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const roleUpdateSchema = z.object({
  responsibilities: z.array(z.string()).optional(),
  positionNames: z.array(z.string()).optional(),
})

// PUT: 役割責任更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validationResult = roleUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { responsibilities, positionNames } = validationResult.data

    // 役割責任の存在確認
    const existingRole = await prisma.gradeRole.findUnique({
      where: { id },
    })

    if (!existingRole) {
      return NextResponse.json({ error: "役割責任が見つかりません" }, { status: 404 })
    }

    const updateData: { responsibilities?: string[]; positionNames?: string[] } = {}
    if (responsibilities !== undefined) {
      updateData.responsibilities = responsibilities
    }
    if (positionNames !== undefined) {
      updateData.positionNames = positionNames
    }

    const gradeRole = await prisma.gradeRole.update({
      where: { id },
      data: updateData,
      include: {
        gradeJobTypeConfig: {
          include: {
            grade: true,
            jobType: true,
          },
        },
      },
    })

    return NextResponse.json(gradeRole)
  } catch (error) {
    console.error("役割責任更新エラー:", error)
    return NextResponse.json({ error: "役割責任の更新に失敗しました" }, { status: 500 })
  }
}

// DELETE: 役割責任削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params

    // 役割責任の存在確認
    const existingRole = await prisma.gradeRole.findUnique({
      where: { id },
    })

    if (!existingRole) {
      return NextResponse.json({ error: "役割責任が見つかりません" }, { status: 404 })
    }

    await prisma.gradeRole.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("役割責任削除エラー:", error)
    return NextResponse.json({ error: "役割責任の削除に失敗しました" }, { status: 500 })
  }
}
