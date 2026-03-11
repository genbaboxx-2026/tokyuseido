import { describe, it, expect } from 'vitest'
import {
  evaluationPeriodSchema,
  individualEvaluationCreateSchema,
  individualEvaluationUpdateSchema,
  evaluationScoreSchema,
  evaluationItemCreateSchema,
  evaluatorAssignmentSchema,
  evaluation360ScoreSchema,
  evaluationCriteriaSchema,
  gradeAdjustmentRuleSchema,
  bulkEvaluationScoresSchema,
} from '@/lib/evaluation/schemas'
import {
  buildEvaluationPeriodData,
  buildIndividualEvaluationData,
  buildEvaluationScoreData,
  buildEvaluationItemData,
  buildEvaluatorAssignmentData,
  buildEvaluation360ScoreData,
  buildEvaluationCriteriaData,
  buildGradeAdjustmentRuleData,
  buildBulkEvaluationScoresData,
} from '@tests/helpers'

// ============================================
// evaluationPeriodSchema
// ============================================

describe('evaluationPeriodSchema', () => {
  const validData = buildEvaluationPeriodData()

  it('有効なデータでバリデーションが通る', () => {
    const result = evaluationPeriodSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('nameが空文字でエラー', () => {
    const result = evaluationPeriodSchema.safeParse({ ...validData, name: '' })
    expect(result.success).toBe(false)
  })

  it('nameが100文字超でエラー', () => {
    const result = evaluationPeriodSchema.safeParse({ ...validData, name: 'あ'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('無効なperiodTypeでエラー', () => {
    const result = evaluationPeriodSchema.safeParse({ ...validData, periodType: 'QUARTERLY' })
    expect(result.success).toBe(false)
  })

  it('FIRST_HALFとSECOND_HALFのみ許可', () => {
    expect(evaluationPeriodSchema.safeParse({ ...validData, periodType: 'FIRST_HALF' }).success).toBe(true)
    expect(evaluationPeriodSchema.safeParse({ ...validData, periodType: 'SECOND_HALF' }).success).toBe(true)
  })

  it('statusが省略可能', () => {
    const result = evaluationPeriodSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })
})

// ============================================
// individualEvaluationCreateSchema
// ============================================

describe('individualEvaluationCreateSchema', () => {
  it('全てのcuid形式IDで通る', () => {
    const result = individualEvaluationCreateSchema.safeParse(buildIndividualEvaluationData())
    expect(result.success).toBe(true)
  })

  it('空文字のIDでエラー', () => {
    const result = individualEvaluationCreateSchema.safeParse(
      buildIndividualEvaluationData({ evaluationPeriodId: '' }),
    )
    expect(result.success).toBe(false)
  })
})

// ============================================
// individualEvaluationUpdateSchema
// ============================================

describe('individualEvaluationUpdateSchema', () => {
  it('空オブジェクトで通る', () => {
    const result = individualEvaluationUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('有効な評価レートで通る', () => {
    for (const rating of ['S', 'A', 'B', 'C', 'D']) {
      const result = individualEvaluationUpdateSchema.safeParse({ finalRating: rating })
      expect(result.success).toBe(true)
    }
  })

  it('無効な評価レートでエラー', () => {
    const result = individualEvaluationUpdateSchema.safeParse({ finalRating: 'E' })
    expect(result.success).toBe(false)
  })

  it('totalScoreが0〜5の範囲で通る', () => {
    expect(individualEvaluationUpdateSchema.safeParse({ totalScore: 0 }).success).toBe(true)
    expect(individualEvaluationUpdateSchema.safeParse({ totalScore: 5 }).success).toBe(true)
  })

  it('totalScoreが範囲外でエラー', () => {
    expect(individualEvaluationUpdateSchema.safeParse({ totalScore: -1 }).success).toBe(false)
    expect(individualEvaluationUpdateSchema.safeParse({ totalScore: 6 }).success).toBe(false)
  })
})

// ============================================
// evaluationScoreSchema
// ============================================

describe('evaluationScoreSchema', () => {
  it('有効なデータで通る', () => {
    const result = evaluationScoreSchema.safeParse(
      buildEvaluationScoreData({ comment: 'よくできました' }),
    )
    expect(result.success).toBe(true)
  })

  it('スコアがnullable', () => {
    const result = evaluationScoreSchema.safeParse(
      buildEvaluationScoreData({ selfScore: null, evaluatorScore: null }),
    )
    expect(result.success).toBe(true)
  })

  it('スコアが0〜5の整数範囲で通る', () => {
    const result = evaluationScoreSchema.safeParse(
      buildEvaluationScoreData({ selfScore: 0, evaluatorScore: 5 }),
    )
    expect(result.success).toBe(true)
  })

  it('コメントが1000文字超でエラー', () => {
    const result = evaluationScoreSchema.safeParse(
      buildEvaluationScoreData({ comment: 'あ'.repeat(1001) }),
    )
    expect(result.success).toBe(false)
  })
})

// ============================================
// evaluationItemCreateSchema
// ============================================

describe('evaluationItemCreateSchema', () => {
  it('有効なデータで通る', () => {
    const result = evaluationItemCreateSchema.safeParse(buildEvaluationItemData())
    expect(result.success).toBe(true)
  })

  it('nameが空文字でエラー', () => {
    const result = evaluationItemCreateSchema.safeParse(buildEvaluationItemData({ name: '' }))
    expect(result.success).toBe(false)
  })

  it('nameが200文字超でエラー', () => {
    const result = evaluationItemCreateSchema.safeParse(buildEvaluationItemData({ name: 'あ'.repeat(201) }))
    expect(result.success).toBe(false)
  })

  it('categoryが空文字でエラー', () => {
    const result = evaluationItemCreateSchema.safeParse(buildEvaluationItemData({ category: '' }))
    expect(result.success).toBe(false)
  })

  it('weightが0〜10の範囲で通る', () => {
    expect(evaluationItemCreateSchema.safeParse(buildEvaluationItemData({ weight: 0 })).success).toBe(true)
    expect(evaluationItemCreateSchema.safeParse(buildEvaluationItemData({ weight: 10 })).success).toBe(true)
  })

  it('weightが範囲外でエラー', () => {
    expect(evaluationItemCreateSchema.safeParse(buildEvaluationItemData({ weight: -1 })).success).toBe(false)
    expect(evaluationItemCreateSchema.safeParse(buildEvaluationItemData({ weight: 11 })).success).toBe(false)
  })
})

// ============================================
// evaluatorAssignmentSchema
// ============================================

describe('evaluatorAssignmentSchema', () => {
  it('order 1〜4で通る', () => {
    for (const order of [1, 2, 3, 4]) {
      const result = evaluatorAssignmentSchema.safeParse(buildEvaluatorAssignmentData({ order }))
      expect(result.success).toBe(true)
    }
  })

  it('order 0でエラー', () => {
    const result = evaluatorAssignmentSchema.safeParse(buildEvaluatorAssignmentData({ order: 0 }))
    expect(result.success).toBe(false)
  })

  it('order 5でエラー', () => {
    const result = evaluatorAssignmentSchema.safeParse(buildEvaluatorAssignmentData({ order: 5 }))
    expect(result.success).toBe(false)
  })
})

// ============================================
// evaluation360ScoreSchema
// ============================================

describe('evaluation360ScoreSchema', () => {
  it('有効なデータで通る', () => {
    const result = evaluation360ScoreSchema.safeParse(buildEvaluation360ScoreData())
    expect(result.success).toBe(true)
  })

  it('scoreが整数0〜5の範囲で通る', () => {
    for (const score of [0, 1, 2, 3, 4, 5]) {
      const result = evaluation360ScoreSchema.safeParse(buildEvaluation360ScoreData({ score }))
      expect(result.success).toBe(true)
    }
  })

  it('scoreが範囲外でエラー', () => {
    const result = evaluation360ScoreSchema.safeParse(buildEvaluation360ScoreData({ score: 6 }))
    expect(result.success).toBe(false)
  })
})

// ============================================
// evaluationCriteriaSchema
// ============================================

describe('evaluationCriteriaSchema', () => {
  it('有効な評価レート組み合わせで通る', () => {
    const result = evaluationCriteriaSchema.safeParse(buildEvaluationCriteriaData())
    expect(result.success).toBe(true)
  })

  it('無効な評価レートでエラー', () => {
    const result = evaluationCriteriaSchema.safeParse(
      buildEvaluationCriteriaData({ firstHalfRating: 'E' }),
    )
    expect(result.success).toBe(false)
  })
})

// ============================================
// gradeAdjustmentRuleSchema
// ============================================

describe('gradeAdjustmentRuleSchema', () => {
  it('有効なデータで通る', () => {
    const result = gradeAdjustmentRuleSchema.safeParse(buildGradeAdjustmentRuleData())
    expect(result.success).toBe(true)
  })

  it('stepAdjustmentが-10〜10の範囲で通る', () => {
    expect(gradeAdjustmentRuleSchema.safeParse(
      buildGradeAdjustmentRuleData({ stepAdjustment: -10 }),
    ).success).toBe(true)
    expect(gradeAdjustmentRuleSchema.safeParse(
      buildGradeAdjustmentRuleData({ stepAdjustment: 10 }),
    ).success).toBe(true)
  })

  it('stepAdjustmentが範囲外でエラー', () => {
    expect(gradeAdjustmentRuleSchema.safeParse(
      buildGradeAdjustmentRuleData({ stepAdjustment: 11 }),
    ).success).toBe(false)
    expect(gradeAdjustmentRuleSchema.safeParse(
      buildGradeAdjustmentRuleData({ stepAdjustment: -11 }),
    ).success).toBe(false)
  })
})

// ============================================
// bulkEvaluationScoresSchema
// ============================================

describe('bulkEvaluationScoresSchema', () => {
  it('有効なバルクスコアで通る', () => {
    const result = bulkEvaluationScoresSchema.safeParse(buildBulkEvaluationScoresData())
    expect(result.success).toBe(true)
  })

  it('空のscores配列で通る', () => {
    const result = bulkEvaluationScoresSchema.safeParse(
      buildBulkEvaluationScoresData({ scores: [] }),
    )
    expect(result.success).toBe(true)
  })
})
