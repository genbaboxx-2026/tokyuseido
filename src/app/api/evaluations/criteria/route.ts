import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { evaluationCriteriaArraySchema } from "@/lib/evaluation/schemas"
import { DEFAULT_CRITERIA_MATRIX, buildCriteriaMatrix } from "@/lib/evaluation/criteria"
import type { EvaluationRating } from "@/lib/evaluation/constants"

// GET: 評価基準マトリクス取得
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

    // 会社の評価基準を取得
    const criteria = await prisma.evaluationCriteria.findMany({
      where: { companyId },
    })

    // データがない場合はデフォルトマトリクスを返す
    if (criteria.length === 0) {
      return NextResponse.json({
        companyId,
        matrix: DEFAULT_CRITERIA_MATRIX,
        isDefault: true,
      })
    }

    // マトリクスを構築
    const matrix = buildCriteriaMatrix(
      criteria.map((c) => ({
        firstHalfRating: c.firstHalfRating as EvaluationRating,
        secondHalfRating: c.secondHalfRating as EvaluationRating,
        finalRating: c.finalRating as EvaluationRating,
      }))
    )

    return NextResponse.json({
      companyId,
      matrix,
      isDefault: false,
      criteria,
    })
  } catch (error) {
    console.error("評価基準取得エラー:", error)
    return NextResponse.json({ error: "評価基準の取得に失敗しました" }, { status: 500 })
  }
}

// POST: 評価基準設定（一括更新）
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()

    // companyIdをボディから取得
    const companyId = body.companyId
    if (!companyId) {
      return NextResponse.json({ error: "会社IDは必須です" }, { status: 400 })
    }

    // 会社の存在確認
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json({ error: "会社が見つかりません" }, { status: 404 })
    }

    // criteriaデータを取得
    const criteriaData = body.criteria

    if (!criteriaData || !Array.isArray(criteriaData)) {
      return NextResponse.json(
        { error: "評価基準データが必要です" },
        { status: 400 }
      )
    }

    // companyIdを追加
    const dataWithCompanyId = criteriaData.map(
      (c: {
        firstHalfRating: string
        secondHalfRating: string
        finalRating: string
      }) => ({
        ...c,
        companyId,
      })
    )

    const validationResult = evaluationCriteriaArraySchema.safeParse(dataWithCompanyId)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const criteria = validationResult.data

    // トランザクションで既存データを削除して新規作成
    await prisma.$transaction(async (tx) => {
      // 既存の評価基準を削除
      await tx.evaluationCriteria.deleteMany({
        where: { companyId },
      })

      // 新規評価基準を作成
      await tx.evaluationCriteria.createMany({
        data: criteria.map((c) => ({
          companyId: c.companyId,
          firstHalfRating: c.firstHalfRating,
          secondHalfRating: c.secondHalfRating,
          finalRating: c.finalRating,
        })),
      })
    })

    // 作成したデータを取得
    const createdCriteria = await prisma.evaluationCriteria.findMany({
      where: { companyId },
    })

    const matrix = buildCriteriaMatrix(
      createdCriteria.map((c) => ({
        firstHalfRating: c.firstHalfRating as EvaluationRating,
        secondHalfRating: c.secondHalfRating as EvaluationRating,
        finalRating: c.finalRating as EvaluationRating,
      }))
    )

    return NextResponse.json({
      companyId,
      matrix,
      isDefault: false,
      criteria: createdCriteria,
    }, { status: 201 })
  } catch (error) {
    console.error("評価基準設定エラー:", error)
    return NextResponse.json({ error: "評価基準の設定に失敗しました" }, { status: 500 })
  }
}

// PUT: 評価基準更新（POST と同じ動作）
export async function PUT(request: NextRequest) {
  return POST(request)
}
