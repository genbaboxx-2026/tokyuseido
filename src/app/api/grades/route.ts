import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { gradeFormSchema } from "@/lib/grade/schemas"

// GET: 等級一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    if (!companyId) {
      return NextResponse.json({ error: "会社IDは必須です" }, { status: 400 })
    }

    const grades = await prisma.grade.findMany({
      where: { companyId },
      orderBy: [{ employmentType: "asc" }, { level: "desc" }],
      include: {
        _count: {
          select: {
            employees: true,
            gradeJobTypeConfigs: true,
          },
        },
      },
    })

    return NextResponse.json(grades)
  } catch (error) {
    console.error("等級一覧取得エラー:", error)
    return NextResponse.json({ error: "等級一覧の取得に失敗しました" }, { status: 500 })
  }
}

// POST: 等級作成
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()

    // levelがない場合は自動計算
    if (!body.level) {
      const maxLevelGrade = await prisma.grade.findFirst({
        where: { companyId: body.companyId },
        orderBy: { level: "desc" },
        select: { level: true },
      })
      body.level = (maxLevelGrade?.level ?? 0) + 1
    }

    // デフォルト値を設定
    if (!body.employmentType) {
      body.employmentType = "FULL_TIME"
    }
    if (body.isManagement === undefined) {
      body.isManagement = false
    }

    const validationResult = gradeFormSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { name, level, employmentType, isManagement, companyId } = validationResult.data

    // 同一会社内で同じ等級名が存在しないか確認
    const existingGrade = await prisma.grade.findUnique({
      where: {
        companyId_name: { companyId, name },
      },
    })

    if (existingGrade) {
      return NextResponse.json({ error: "同じ等級名が既に存在します" }, { status: 400 })
    }

    const grade = await prisma.grade.create({
      data: {
        name,
        level,
        employmentType,
        isManagement,
        companyId,
      },
    })

    // 会社の全職種を取得して、GradeJobTypeConfigを作成
    const jobTypes = await prisma.jobType.findMany({
      where: {
        jobCategory: {
          companyId,
        },
      },
    })

    // 全職種に対してデフォルトでisEnabled=falseのConfigを作成
    if (jobTypes.length > 0) {
      await prisma.gradeJobTypeConfig.createMany({
        data: jobTypes.map((jobType) => ({
          gradeId: grade.id,
          jobTypeId: jobType.id,
          isEnabled: false,
        })),
      })
    }

    return NextResponse.json(grade, { status: 201 })
  } catch (error) {
    console.error("等級作成エラー:", error)
    return NextResponse.json({ error: "等級の作成に失敗しました" }, { status: 500 })
  }
}
