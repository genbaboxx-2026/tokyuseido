import { describe, it, expect } from 'vitest'
import {
  isValidScore,
  validateScore,
  calculateAverageScore,
  calculateSelfAverageScore,
  calculate360AverageScore,
  scoreToRating,
  getStepAdjustment,
  calculateCompletionRate,
  generateEvaluationSummary,
  VALID_SCORES,
  type EvaluationScoreData,
} from '@/lib/evaluation/calculator'

// ============================================
// isValidScore
// ============================================

describe('isValidScore', () => {
  it('有効スコア（0, 1, 3, 4, 5）でtrueを返す', () => {
    for (const score of VALID_SCORES) {
      expect(isValidScore(score)).toBe(true)
    }
  })

  it('無効スコア（2）でfalseを返す', () => {
    expect(isValidScore(2)).toBe(false)
  })

  it('負の数でfalseを返す', () => {
    expect(isValidScore(-1)).toBe(false)
  })

  it('6以上でfalseを返す', () => {
    expect(isValidScore(6)).toBe(false)
  })
})

// ============================================
// validateScore
// ============================================

describe('validateScore', () => {
  it('有効スコアでそのまま返す', () => {
    expect(validateScore(5)).toBe(5)
    expect(validateScore(0)).toBe(0)
  })

  it('無効スコアでnullを返す', () => {
    expect(validateScore(2)).toBeNull()
  })

  it('nullでnullを返す', () => {
    expect(validateScore(null)).toBeNull()
  })

  it('undefinedでnullを返す', () => {
    expect(validateScore(undefined)).toBeNull()
  })
})

// ============================================
// calculateAverageScore
// ============================================

describe('calculateAverageScore', () => {
  it('空配列でnullを返す', () => {
    expect(calculateAverageScore([])).toBeNull()
  })

  it('全て未入力（evaluatorScore=null）でnullを返す', () => {
    const scores: EvaluationScoreData[] = [
      { evaluatorScore: null },
      { evaluatorScore: null },
    ]
    expect(calculateAverageScore(scores)).toBeNull()
  })

  it('単純平均を小数点第2位まで計算する', () => {
    const scores: EvaluationScoreData[] = [
      { evaluatorScore: 5 },
      { evaluatorScore: 3 },
      { evaluatorScore: 4 },
    ]
    // (5 + 3 + 4) / 3 = 4
    expect(calculateAverageScore(scores)).toBe(4)
  })

  it('小数点第2位まで丸める', () => {
    const scores: EvaluationScoreData[] = [
      { evaluatorScore: 5 },
      { evaluatorScore: 4 },
      { evaluatorScore: 3 },
    ]
    // (5 + 4 + 3) / 3 = 4
    expect(calculateAverageScore(scores)).toBe(4)
  })

  it('evaluatorScoreがnullの項目をスキップする', () => {
    const scores: EvaluationScoreData[] = [
      { evaluatorScore: 5 },
      { evaluatorScore: null },
      { evaluatorScore: 3 },
    ]
    // (5 + 3) / 2 = 4
    expect(calculateAverageScore(scores)).toBe(4)
  })

  describe('重み付き平均', () => {
    it('重みを使用して平均を計算する', () => {
      const scores: EvaluationScoreData[] = [
        { evaluatorScore: 5, weight: 2 },
        { evaluatorScore: 3, weight: 1 },
      ]
      // (5*2 + 3*1) / (2+1) = 13/3 ≒ 4.33
      expect(calculateAverageScore(scores, true)).toBe(4.33)
    })

    it('weightがnullの場合デフォルト1で計算する', () => {
      const scores: EvaluationScoreData[] = [
        { evaluatorScore: 5, weight: null },
        { evaluatorScore: 3, weight: null },
      ]
      // (5*1 + 3*1) / 2 = 4
      expect(calculateAverageScore(scores, true)).toBe(4)
    })

    it('全ての重みが0でnullを返す', () => {
      const scores: EvaluationScoreData[] = [
        { evaluatorScore: 5, weight: 0 },
        { evaluatorScore: 3, weight: 0 },
      ]
      expect(calculateAverageScore(scores, true)).toBeNull()
    })
  })
})

// ============================================
// calculateSelfAverageScore
// ============================================

describe('calculateSelfAverageScore', () => {
  it('空配列でnullを返す', () => {
    expect(calculateSelfAverageScore([])).toBeNull()
  })

  it('全て未入力でnullを返す', () => {
    const scores: EvaluationScoreData[] = [
      { selfScore: null },
      { selfScore: undefined },
    ]
    expect(calculateSelfAverageScore(scores)).toBeNull()
  })

  it('自己評価の平均を計算する', () => {
    const scores: EvaluationScoreData[] = [
      { selfScore: 5 },
      { selfScore: 4 },
      { selfScore: 3 },
    ]
    expect(calculateSelfAverageScore(scores)).toBe(4)
  })

  it('selfScoreがnullの項目をスキップする', () => {
    const scores: EvaluationScoreData[] = [
      { selfScore: 5 },
      { selfScore: null },
      { selfScore: 3 },
    ]
    expect(calculateSelfAverageScore(scores)).toBe(4)
  })
})

// ============================================
// calculate360AverageScore
// ============================================

describe('calculate360AverageScore', () => {
  it('空配列でnullを返す', () => {
    expect(calculate360AverageScore([])).toBeNull()
  })

  it('全評価者のスコアを平均する', () => {
    const evaluatorScores = [
      { evaluatorId: 'e1', scores: [5, 4] },
      { evaluatorId: 'e2', scores: [3, 4] },
    ]
    // (5 + 4 + 3 + 4) / 4 = 4
    expect(calculate360AverageScore(evaluatorScores)).toBe(4)
  })

  it('空のスコア配列を持つ評価者がいてもスキップする', () => {
    const evaluatorScores = [
      { evaluatorId: 'e1', scores: [5, 3] },
      { evaluatorId: 'e2', scores: [] },
    ]
    // (5 + 3) / 2 = 4
    expect(calculate360AverageScore(evaluatorScores)).toBe(4)
  })

  it('全評価者がスコアなしでnullを返す', () => {
    const evaluatorScores = [
      { evaluatorId: 'e1', scores: [] },
      { evaluatorId: 'e2', scores: [] },
    ]
    expect(calculate360AverageScore(evaluatorScores)).toBeNull()
  })
})

// ============================================
// scoreToRating
// ============================================

describe('scoreToRating', () => {
  describe('デフォルト閾値', () => {
    it('4.5以上でSを返す', () => {
      expect(scoreToRating(4.5)).toBe('S')
      expect(scoreToRating(5.0)).toBe('S')
    })

    it('3.5以上4.5未満でAを返す', () => {
      expect(scoreToRating(3.5)).toBe('A')
      expect(scoreToRating(4.49)).toBe('A')
    })

    it('2.5以上3.5未満でBを返す', () => {
      expect(scoreToRating(2.5)).toBe('B')
      expect(scoreToRating(3.49)).toBe('B')
    })

    it('1.5以上2.5未満でCを返す', () => {
      expect(scoreToRating(1.5)).toBe('C')
      expect(scoreToRating(2.49)).toBe('C')
    })

    it('1.5未満でDを返す', () => {
      expect(scoreToRating(1.49)).toBe('D')
      expect(scoreToRating(0)).toBe('D')
    })
  })

  describe('カスタム閾値', () => {
    it('カスタム閾値で判定する', () => {
      const thresholds = { S: 4.0, A: 3.0, B: 2.0, C: 1.0 }
      expect(scoreToRating(4.0, thresholds)).toBe('S')
      expect(scoreToRating(3.0, thresholds)).toBe('A')
      expect(scoreToRating(2.0, thresholds)).toBe('B')
      expect(scoreToRating(1.0, thresholds)).toBe('C')
      expect(scoreToRating(0.5, thresholds)).toBe('D')
    })
  })
})

// ============================================
// getStepAdjustment
// ============================================

describe('getStepAdjustment', () => {
  const rules = [
    { rating: 'S' as const, currentRank: 'A', stepAdjustment: 3 },
    { rating: 'A' as const, currentRank: 'A', stepAdjustment: 2 },
    { rating: 'B' as const, currentRank: 'A', stepAdjustment: 1 },
    { rating: 'C' as const, currentRank: 'A', stepAdjustment: 0 },
    { rating: 'D' as const, currentRank: 'A', stepAdjustment: -1 },
  ]

  it('マッチするルールの号俸変動値を返す', () => {
    expect(getStepAdjustment('S', 'A', rules)).toBe(3)
    expect(getStepAdjustment('D', 'A', rules)).toBe(-1)
  })

  it('マッチするルールがない場合0を返す', () => {
    expect(getStepAdjustment('S', 'B', rules)).toBe(0)
  })
})

// ============================================
// calculateCompletionRate
// ============================================

describe('calculateCompletionRate', () => {
  it('全項目完了で100を返す', () => {
    expect(calculateCompletionRate(10, 10)).toBe(100)
  })

  it('半分完了で50を返す', () => {
    expect(calculateCompletionRate(10, 5)).toBe(50)
  })

  it('未完了で0を返す', () => {
    expect(calculateCompletionRate(10, 0)).toBe(0)
  })

  it('総項目数0で0を返す', () => {
    expect(calculateCompletionRate(0, 0)).toBe(0)
  })

  it('端数は四捨五入する', () => {
    // 3/7 ≒ 42.857... → 43
    expect(calculateCompletionRate(7, 3)).toBe(43)
  })
})

// ============================================
// generateEvaluationSummary
// ============================================

describe('generateEvaluationSummary', () => {
  it('空のスコア配列で適切なサマリーを返す', () => {
    const summary = generateEvaluationSummary([])

    expect(summary.totalScore).toBeNull()
    expect(summary.averageScore).toBeNull()
    expect(summary.selfAverageScore).toBeNull()
    expect(summary.completionRate).toBe(0)
    expect(summary.finalRating).toBeNull()
    expect(summary.scoreBreakdown).toEqual([])
  })

  it('カテゴリ別にスコアを集計する', () => {
    const scores = [
      { category: '安全', evaluatorScore: 5, selfScore: 4 },
      { category: '安全', evaluatorScore: 3, selfScore: 3 },
      { category: '技術', evaluatorScore: 4, selfScore: 5 },
    ]

    const summary = generateEvaluationSummary(scores)

    expect(summary.scoreBreakdown).toHaveLength(2)

    const safetyBreakdown = summary.scoreBreakdown.find(b => b.category === '安全')
    expect(safetyBreakdown?.averageScore).toBe(4) // (5+3)/2
    expect(safetyBreakdown?.itemCount).toBe(2)

    const techBreakdown = summary.scoreBreakdown.find(b => b.category === '技術')
    expect(techBreakdown?.averageScore).toBe(4)
    expect(techBreakdown?.itemCount).toBe(1)
  })

  it('全体の平均スコアと自己評価平均を計算する', () => {
    const scores = [
      { category: 'A', evaluatorScore: 5, selfScore: 4 },
      { category: 'A', evaluatorScore: 3, selfScore: 3 },
    ]

    const summary = generateEvaluationSummary(scores)

    expect(summary.averageScore).toBe(4) // (5+3)/2
    expect(summary.selfAverageScore).toBe(3.5) // (4+3)/2
  })

  it('完了率を正しく算出する', () => {
    const scores = [
      { category: 'A', evaluatorScore: 5 },
      { category: 'A', evaluatorScore: null },
      { category: 'A', evaluatorScore: 3 },
    ]

    const summary = generateEvaluationSummary(scores)
    // 2/3 ≒ 67
    expect(summary.completionRate).toBe(67)
  })

  it('finalRatingが平均スコアに基づいて決定される', () => {
    const scores = [
      { category: 'A', evaluatorScore: 5 },
      { category: 'A', evaluatorScore: 5 },
      { category: 'A', evaluatorScore: 4 },
    ]

    const summary = generateEvaluationSummary(scores)
    // (5+5+4)/3 ≒ 4.67 → S
    expect(summary.finalRating).toBe('S')
  })

  it('evaluatorScoreが全てnullの場合、finalRatingがnull', () => {
    const scores = [
      { category: 'A', evaluatorScore: null, selfScore: 5 },
      { category: 'A', evaluatorScore: null, selfScore: 4 },
    ]

    const summary = generateEvaluationSummary(scores)
    expect(summary.finalRating).toBeNull()
    expect(summary.averageScore).toBeNull()
  })

  it('totalScoreはaverageScore × 項目数', () => {
    const scores = [
      { category: 'A', evaluatorScore: 5 },
      { category: 'B', evaluatorScore: 3 },
    ]

    const summary = generateEvaluationSummary(scores)
    // average = (5+3)/2 = 4, totalScore = 4 * 2 = 8
    expect(summary.totalScore).toBe(8)
  })
})
