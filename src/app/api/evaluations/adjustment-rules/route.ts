import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { gradeAdjustmentRulesSchema } from "@/lib/evaluation/schemas"

// GET: 号俸改定基準取得
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const gradeId = searchParams.get("gradeId")

    if (!companyId && !gradeId) {
      return NextResponse.json(
        { error: "会社IDまたは等級IDが必要です" },
        { status: 400 }
      )
    }

    const where: { gradeId?: string; grade?: { companyId: string } } = {}

    if (gradeId) {
      where.gradeId = gradeId
    } else if (companyId) {
      where.grade = { companyId }
    }

    const rules = await prisma.gradeAdjustmentRule.findMany({
      where,
      orderBy: [
        { grade: { level: "desc" } },
        { currentRank: "asc" },
        { rating: "asc" },
      ],
      include: {
        grade: {
          select: {
            id: true,
            name: true,
            level: true,
            employmentType: true,
          },
        },
      },
    })

    // 等級ごとにグループ化
    const groupedRules = rules.reduce(
      (acc, rule) => {
        const gradeId = rule.gradeId
        if (!acc[gradeId]) {
          acc[gradeId] = {
            grade: rule.grade,
            rules: [],
          }
        }
        acc[gradeId].rules.push({
          id: rule.id,
          currentRank: rule.currentRank,
          rating: rule.rating,
          stepAdjustment: rule.stepAdjustment,
        })
        return acc
      },
      {} as Record<
        string,
        {
          grade: typeof rules[0]["grade"]
          rules: Array<{
            id: string
            currentRank: string
            rating: string
            stepAdjustment: number
          }>
        }
      >
    )

    return NextResponse.json({
      rules,
      grouped: Object.values(groupedRules),
    })
  } catch (error) {
    console.error("号俸改定基準取得エラー:", error)
    return NextResponse.json({ error: "号俸改定基準の取得に失敗しました" }, { status: 500 })
  }
}

// POST: 号俸改定基準設定（一括更新）
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()

    // gradeIdをボディから取得
    const gradeId = body.gradeId
    if (!gradeId) {
      return NextResponse.json({ error: "等級IDは必須です" }, { status: 400 })
    }

    // 等級の存在確認
    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
    })

    if (!grade) {
      return NextResponse.json({ error: "等級が見つかりません" }, { status: 404 })
    }

    // rulesデータを取得
    const rulesData = body.rules

    if (!rulesData || !Array.isArray(rulesData)) {
      return NextResponse.json(
        { error: "号俸改定基準データが必要です" },
        { status: 400 }
      )
    }

    // gradeIdを追加
    const dataWithGradeId = rulesData.map(
      (r: {
        currentRank: string
        rating: string
        stepAdjustment: number
      }) => ({
        ...r,
        gradeId,
      })
    )

    const validationResult = gradeAdjustmentRulesSchema.safeParse(dataWithGradeId)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const rules = validationResult.data

    // トランザクションで既存データを削除して新規作成
    await prisma.$transaction(async (tx) => {
      // 既存の号俸改定基準を削除
      await tx.gradeAdjustmentRule.deleteMany({
        where: { gradeId },
      })

      // 新規号俸改定基準を作成
      await tx.gradeAdjustmentRule.createMany({
        data: rules.map((r) => ({
          gradeId: r.gradeId,
          currentRank: r.currentRank,
          rating: r.rating,
          stepAdjustment: r.stepAdjustment,
        })),
      })
    })

    // 作成したデータを取得
    const createdRules = await prisma.gradeAdjustmentRule.findMany({
      where: { gradeId },
      orderBy: [{ currentRank: "asc" }, { rating: "asc" }],
      include: {
        grade: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
    })

    return NextResponse.json({
      gradeId,
      grade,
      rules: createdRules,
    }, { status: 201 })
  } catch (error) {
    console.error("号俸改定基準設定エラー:", error)
    return NextResponse.json({ error: "号俸改定基準の設定に失敗しました" }, { status: 500 })
  }
}

// PUT: 号俸改定基準更新（POST と同じ動作）
export async function PUT(request: NextRequest) {
  return POST(request)
}
