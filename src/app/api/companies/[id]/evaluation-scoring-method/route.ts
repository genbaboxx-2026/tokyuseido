import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// デフォルトのランク設定（5段階）
const DEFAULT_RANKS = [
  { rankName: "S", sortOrder: 0, minScore: 95, maxScore: null },
  { rankName: "A", sortOrder: 1, minScore: 85, maxScore: 95 },
  { rankName: "B", sortOrder: 2, minScore: 70, maxScore: 85 },
  { rankName: "C", sortOrder: 3, minScore: 50, maxScore: 70 },
  { rankName: "D", sortOrder: 4, minScore: 0, maxScore: 50 },
]

// 有効なランク名
const VALID_RANK_NAMES = ["S", "A", "B", "C", "D", "E", "F"]

// GET: 算定方法を取得（なければデフォルト値を返す）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId } = await params

    // DBから取得を試みる
    const scoringMethod = await prisma.evaluationScoringMethod.findUnique({
      where: { companyId },
      include: {
        ranks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    })

    // DBにレコードがなければデフォルト値を返す
    if (!scoringMethod) {
      return NextResponse.json({
        id: null,
        companyId,
        normalizeToHundred: true,
        ranks: DEFAULT_RANKS,
        isDefault: true, // デフォルト値であることを示す
      })
    }

    return NextResponse.json({
      ...scoringMethod,
      isDefault: false,
    })
  } catch (error) {
    console.error("算定方法取得エラー:", error)
    return NextResponse.json(
      { error: "算定方法の取得に失敗しました" },
      { status: 500 }
    )
  }
}

// POST: 算定方法を作成または更新（upsert）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId } = await params
    const body = await request.json()
    const { normalizeToHundred, ranks } = body

    // バリデーション
    if (typeof normalizeToHundred !== "boolean") {
      return NextResponse.json(
        { error: "normalizeToHundred は boolean である必要があります" },
        { status: 400 }
      )
    }

    if (!Array.isArray(ranks) || ranks.length < 2 || ranks.length > 7) {
      return NextResponse.json(
        { error: "ランクは2〜7段階で設定してください" },
        { status: 400 }
      )
    }

    // ランク名のバリデーション
    for (const rank of ranks) {
      if (!VALID_RANK_NAMES.includes(rank.rankName)) {
        return NextResponse.json(
          { error: `無効なランク名です: ${rank.rankName}` },
          { status: 400 }
        )
      }
    }

    // sortOrderでソート
    const sortedRanks = [...ranks].sort((a, b) => a.sortOrder - b.sortOrder)

    // 最高ランクのmaxScoreがnullであること
    if (sortedRanks[0].maxScore !== null) {
      return NextResponse.json(
        { error: "最高ランクの上限（maxScore）はnullである必要があります" },
        { status: 400 }
      )
    }

    // 最低ランクのminScoreが0であること
    if (sortedRanks[sortedRanks.length - 1].minScore !== 0) {
      return NextResponse.json(
        { error: "最低ランクの下限（minScore）は0である必要があります" },
        { status: 400 }
      )
    }

    // 隣接するランクの閾値が隙間なく連続すること
    for (let i = 0; i < sortedRanks.length - 1; i++) {
      const currentRank = sortedRanks[i]
      const nextRank = sortedRanks[i + 1]

      // 上のランクのminScoreが、下のランクのmaxScoreと一致すること
      if (nextRank.maxScore !== currentRank.minScore) {
        return NextResponse.json(
          { error: `ランク ${currentRank.rankName} と ${nextRank.rankName} の閾値が連続していません` },
          { status: 400 }
        )
      }
    }

    // トランザクションでupsert
    const result = await prisma.$transaction(async (tx) => {
      // 既存の算定方法を取得
      const existing = await tx.evaluationScoringMethod.findUnique({
        where: { companyId },
      })

      let scoringMethod

      if (existing) {
        // 既存のランクを全削除
        await tx.evaluationRank.deleteMany({
          where: { scoringMethodId: existing.id },
        })

        // 算定方法を更新
        scoringMethod = await tx.evaluationScoringMethod.update({
          where: { id: existing.id },
          data: { normalizeToHundred },
        })
      } else {
        // 新規作成
        scoringMethod = await tx.evaluationScoringMethod.create({
          data: {
            companyId,
            normalizeToHundred,
          },
        })
      }

      // ランクを作成
      await tx.evaluationRank.createMany({
        data: sortedRanks.map((rank) => ({
          scoringMethodId: scoringMethod.id,
          rankName: rank.rankName,
          sortOrder: rank.sortOrder,
          minScore: rank.minScore,
          maxScore: rank.maxScore,
        })),
      })

      // 結果を取得して返す
      return await tx.evaluationScoringMethod.findUnique({
        where: { id: scoringMethod.id },
        include: {
          ranks: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    })

    return NextResponse.json({
      ...result,
      isDefault: false,
    })
  } catch (error) {
    console.error("算定方法保存エラー:", error)
    return NextResponse.json(
      { error: "算定方法の保存に失敗しました" },
      { status: 500 }
    )
  }
}
