import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { gradeFormSchema } from "@/lib/grade/schemas"

// GET: 等級詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params

    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        gradeJobTypeConfigs: {
          include: {
            jobType: {
              include: {
                jobCategory: true,
              },
            },
            gradeRole: true,
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
    })

    if (!grade) {
      return NextResponse.json({ error: "等級が見つかりません" }, { status: 404 })
    }

    return NextResponse.json(grade)
  } catch (error) {
    console.error("等級詳細取得エラー:", error)
    return NextResponse.json({ error: "等級の取得に失敗しました" }, { status: 500 })
  }
}

// PUT: 等級更新
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
    const validationResult = gradeFormSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { name, level, employmentType, isManagement, companyId } = validationResult.data

    // 等級の存在確認
    const existingGrade = await prisma.grade.findUnique({
      where: { id },
    })

    if (!existingGrade) {
      return NextResponse.json({ error: "等級が見つかりません" }, { status: 404 })
    }

    // 同一会社内で同じ等級名が存在しないか確認（自分自身を除く）
    const duplicateGrade = await prisma.grade.findFirst({
      where: {
        companyId,
        name,
        NOT: { id },
      },
    })

    if (duplicateGrade) {
      return NextResponse.json({ error: "同じ等級名が既に存在します" }, { status: 400 })
    }

    const grade = await prisma.grade.update({
      where: { id },
      data: {
        name,
        level,
        employmentType,
        isManagement,
      },
    })

    return NextResponse.json(grade)
  } catch (error) {
    console.error("等級更新エラー:", error)
    return NextResponse.json({ error: "等級の更新に失敗しました" }, { status: 500 })
  }
}

// DELETE: 等級削除
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

    // 等級の存在確認
    const existingGrade = await prisma.grade.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    })

    if (!existingGrade) {
      return NextResponse.json({ error: "等級が見つかりません" }, { status: 404 })
    }

    // 従業員が紐付いている場合は削除不可
    if (existingGrade._count.employees > 0) {
      return NextResponse.json(
        { error: "この等級には従業員が紐付いているため削除できません" },
        { status: 400 }
      )
    }

    await prisma.grade.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("等級削除エラー:", error)
    return NextResponse.json({ error: "等級の削除に失敗しました" }, { status: 500 })
  }
}
