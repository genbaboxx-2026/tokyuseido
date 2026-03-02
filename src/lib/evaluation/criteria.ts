// 評価基準マトリクスのロジック

import type { EvaluationRating } from "./constants"

/**
 * デフォルトの評価基準マトリクス（前期 × 後期）
 * 行: 前期評価、列: 後期評価
 */
export const DEFAULT_CRITERIA_MATRIX: Record<EvaluationRating, Record<EvaluationRating, EvaluationRating>> = {
  S: { S: "S", A: "S", B: "B", C: "C", D: "C" },
  A: { S: "S", A: "A", B: "B", C: "C", D: "C" },
  B: { S: "B", A: "B", B: "B", C: "C", D: "C" },
  C: { S: "B", A: "C", B: "C", C: "C", D: "C" },
  D: { S: "C", A: "C", B: "C", C: "C", D: "D" },
}

/**
 * 前期評価と後期評価から最終評価を算出
 * @param firstHalfRating 前期評価
 * @param secondHalfRating 後期評価
 * @param customMatrix カスタムマトリクス（省略時はデフォルト使用）
 * @returns 最終評価
 */
export function calculateFinalRating(
  firstHalfRating: EvaluationRating,
  secondHalfRating: EvaluationRating,
  customMatrix?: Record<EvaluationRating, Record<EvaluationRating, EvaluationRating>>
): EvaluationRating {
  const matrix = customMatrix ?? DEFAULT_CRITERIA_MATRIX
  return matrix[firstHalfRating][secondHalfRating]
}

/**
 * 評価基準データからマトリクスを構築
 * @param criteria データベースから取得した評価基準データ
 * @returns 評価基準マトリクス
 */
export function buildCriteriaMatrix(
  criteria: Array<{
    firstHalfRating: EvaluationRating
    secondHalfRating: EvaluationRating
    finalRating: EvaluationRating
  }>
): Record<EvaluationRating, Record<EvaluationRating, EvaluationRating>> {
  // デフォルトマトリクスをコピー
  const matrix = JSON.parse(JSON.stringify(DEFAULT_CRITERIA_MATRIX)) as Record<
    EvaluationRating,
    Record<EvaluationRating, EvaluationRating>
  >

  // データベースの値で上書き
  for (const c of criteria) {
    matrix[c.firstHalfRating][c.secondHalfRating] = c.finalRating
  }

  return matrix
}

/**
 * マトリクスをデータベース保存用の配列に変換
 * @param matrix 評価基準マトリクス
 * @returns 保存用データ配列
 */
export function matrixToArray(
  matrix: Record<EvaluationRating, Record<EvaluationRating, EvaluationRating>>
): Array<{
  firstHalfRating: EvaluationRating
  secondHalfRating: EvaluationRating
  finalRating: EvaluationRating
}> {
  const result: Array<{
    firstHalfRating: EvaluationRating
    secondHalfRating: EvaluationRating
    finalRating: EvaluationRating
  }> = []

  const ratings: EvaluationRating[] = ["S", "A", "B", "C", "D"]

  for (const firstHalf of ratings) {
    for (const secondHalf of ratings) {
      result.push({
        firstHalfRating: firstHalf,
        secondHalfRating: secondHalf,
        finalRating: matrix[firstHalf][secondHalf],
      })
    }
  }

  return result
}

/**
 * 評価レートの順序（高い順）
 */
export const RATING_ORDER: Record<EvaluationRating, number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
}

/**
 * 評価レートを比較
 * @param a 評価レートA
 * @param b 評価レートB
 * @returns a > b なら正、a < b なら負、等しければ0
 */
export function compareRatings(a: EvaluationRating, b: EvaluationRating): number {
  return RATING_ORDER[a] - RATING_ORDER[b]
}

/**
 * 評価レート配列をソート（高い順）
 * @param ratings 評価レート配列
 * @returns ソート済み配列
 */
export function sortRatingsDesc(ratings: EvaluationRating[]): EvaluationRating[] {
  return [...ratings].sort((a, b) => compareRatings(b, a))
}
