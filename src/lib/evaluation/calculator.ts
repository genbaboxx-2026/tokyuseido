// 評価計算ロジック

import type { EvaluationRating } from "./constants"

/**
 * 評価スコアの有効値
 */
export const VALID_SCORES = [0, 1, 3, 4, 5] as const
export type ValidScore = (typeof VALID_SCORES)[number]

/**
 * スコアが有効な値かチェック
 */
export function isValidScore(score: number): score is ValidScore {
  return VALID_SCORES.includes(score as ValidScore)
}

/**
 * スコアを検証して有効な値に変換
 * @param score 入力スコア
 * @returns 有効なスコア、または null
 */
export function validateScore(score: number | null | undefined): ValidScore | null {
  if (score === null || score === undefined) return null
  if (!isValidScore(score)) return null
  return score
}

/**
 * 単一評価のスコア情報
 */
export interface EvaluationScoreData {
  selfScore?: number | null
  evaluatorScore?: number | null
  weight?: number | null
}

/**
 * 複数の評価スコアから平均点を算出
 * @param scores スコア配列
 * @param useWeights 重みを使用するか
 * @returns 平均点（小数点第2位まで）
 */
export function calculateAverageScore(scores: EvaluationScoreData[], useWeights = false): number | null {
  if (scores.length === 0) return null

  // 評価者スコアのみ使用（自己評価は参考値）
  const validScores = scores.filter(
    (s) => s.evaluatorScore !== null && s.evaluatorScore !== undefined
  )

  if (validScores.length === 0) return null

  if (useWeights) {
    // 重み付き平均
    let totalWeight = 0
    let weightedSum = 0

    for (const score of validScores) {
      const weight = score.weight ?? 1
      weightedSum += (score.evaluatorScore as number) * weight
      totalWeight += weight
    }

    if (totalWeight === 0) return null
    return Math.round((weightedSum / totalWeight) * 100) / 100
  } else {
    // 単純平均
    const sum = validScores.reduce((acc, s) => acc + (s.evaluatorScore as number), 0)
    return Math.round((sum / validScores.length) * 100) / 100
  }
}

/**
 * 自己評価の平均点を算出
 * @param scores スコア配列
 * @returns 平均点（小数点第2位まで）
 */
export function calculateSelfAverageScore(scores: EvaluationScoreData[]): number | null {
  const validScores = scores.filter(
    (s) => s.selfScore !== null && s.selfScore !== undefined
  )

  if (validScores.length === 0) return null

  const sum = validScores.reduce((acc, s) => acc + (s.selfScore as number), 0)
  return Math.round((sum / validScores.length) * 100) / 100
}

/**
 * 360度評価の平均点を算出（複数評価者）
 * @param evaluatorScores 評価者ごとのスコア配列
 * @returns 平均点
 */
export function calculate360AverageScore(
  evaluatorScores: Array<{ evaluatorId: string; scores: number[] }>
): number | null {
  if (evaluatorScores.length === 0) return null

  const allScores: number[] = []

  for (const evaluator of evaluatorScores) {
    allScores.push(...evaluator.scores)
  }

  if (allScores.length === 0) return null

  const sum = allScores.reduce((acc, s) => acc + s, 0)
  return Math.round((sum / allScores.length) * 100) / 100
}

/**
 * 平均点から評価レートを算出
 * @param averageScore 平均点
 * @param thresholds カスタム閾値（省略時はデフォルト使用）
 * @returns 評価レート
 */
export function scoreToRating(
  averageScore: number,
  thresholds?: { S: number; A: number; B: number; C: number }
): EvaluationRating {
  const t = thresholds ?? {
    S: 4.5,
    A: 3.5,
    B: 2.5,
    C: 1.5,
  }

  if (averageScore >= t.S) return "S"
  if (averageScore >= t.A) return "A"
  if (averageScore >= t.B) return "B"
  if (averageScore >= t.C) return "C"
  return "D"
}

/**
 * 評価レートから号俸変動値を取得
 * @param rating 評価レート
 * @param currentRank 現在のランク（例: "A", "B", "C"）
 * @param rules 号俸改定ルール
 * @returns 号俸変動値
 */
export function getStepAdjustment(
  rating: EvaluationRating,
  currentRank: string,
  rules: Array<{
    rating: EvaluationRating
    currentRank: string
    stepAdjustment: number
  }>
): number {
  const rule = rules.find((r) => r.rating === rating && r.currentRank === currentRank)
  return rule?.stepAdjustment ?? 0
}

/**
 * 評価完了率を算出
 * @param totalItems 総評価項目数
 * @param completedItems 入力済み項目数
 * @returns 完了率（パーセント）
 */
export function calculateCompletionRate(totalItems: number, completedItems: number): number {
  if (totalItems === 0) return 0
  return Math.round((completedItems / totalItems) * 100)
}

/**
 * 評価結果サマリーを生成
 */
export interface EvaluationSummary {
  totalScore: number | null
  averageScore: number | null
  selfAverageScore: number | null
  completionRate: number
  finalRating: EvaluationRating | null
  scoreBreakdown: {
    category: string
    averageScore: number | null
    itemCount: number
  }[]
}

/**
 * 評価結果のサマリーを算出
 * @param scores カテゴリ別スコア
 * @returns 評価サマリー
 */
export function generateEvaluationSummary(
  scores: Array<{
    category: string
    evaluatorScore?: number | null
    selfScore?: number | null
  }>
): EvaluationSummary {
  // カテゴリ別に集計
  const categoryMap = new Map<string, { scores: number[]; selfScores: number[] }>()

  for (const score of scores) {
    const existing = categoryMap.get(score.category) ?? { scores: [], selfScores: [] }
    if (score.evaluatorScore !== null && score.evaluatorScore !== undefined) {
      existing.scores.push(score.evaluatorScore)
    }
    if (score.selfScore !== null && score.selfScore !== undefined) {
      existing.selfScores.push(score.selfScore)
    }
    categoryMap.set(score.category, existing)
  }

  // カテゴリ別の平均を算出
  const scoreBreakdown: EvaluationSummary["scoreBreakdown"] = []
  let allScores: number[] = []

  categoryMap.forEach((data, category) => {
    allScores = allScores.concat(data.scores)
    const avg = data.scores.length > 0
      ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100) / 100
      : null
    scoreBreakdown.push({
      category,
      averageScore: avg,
      itemCount: data.scores.length,
    })
  })

  // 全体の平均を算出
  const averageScore = allScores.length > 0
    ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) / 100
    : null

  // 自己評価の平均
  const allSelfScores: number[] = []
  categoryMap.forEach((data) => {
    allSelfScores.push(...data.selfScores)
  })
  const selfAverageScore = allSelfScores.length > 0
    ? Math.round((allSelfScores.reduce((a, b) => a + b, 0) / allSelfScores.length) * 100) / 100
    : null

  // 入力済み項目数
  const totalItems = scores.length
  const completedItems = scores.filter(
    (s) => s.evaluatorScore !== null && s.evaluatorScore !== undefined
  ).length

  return {
    totalScore: averageScore !== null ? Math.round(averageScore * totalItems * 100) / 100 : null,
    averageScore,
    selfAverageScore,
    completionRate: calculateCompletionRate(totalItems, completedItems),
    finalRating: averageScore !== null ? scoreToRating(averageScore) : null,
    scoreBreakdown,
  }
}
