/**
 * テスト用ファクトリ関数
 *
 * テストデータの重複を排除し、一貫性のあるテストデータ生成を提供する。
 * 各ファクトリは必須フィールドを持つ有効なデータを生成し、
 * overrides で個別フィールドを上書き可能。
 */

import type { SalaryTableCalculationParams, GradeInfo } from '@/lib/salary-table/generator'
import type { EvaluationRating } from '@/lib/evaluation/constants'

// ============================================
// テスト用ID
// ============================================

/** cuid形式のテスト用ID（Zodのcuid()バリデーションを通過する） */
export const TEST_CUID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx' as const
/** cuid形式のテスト用ID（2つ目が必要な場合） */
export const TEST_CUID_2 = 'clyyyyyyyyyyyyyyyyyyyyyyyyy' as const

// ============================================
// 号俸テーブル
// ============================================

/** CLAUDE.md記載の標準パラメータ */
export const STANDARD_PARAMS: SalaryTableCalculationParams = {
  baseSalaryMin: 180_000,
  initialStepDiff: 1_900,
  bandIncreaseRate: 1.05,
  stepsPerBand: 8,
  salaryBandCount: 15,
}

/** 標準的な等級一覧（正⑥〜正①） */
export const SAMPLE_GRADES: GradeInfo[] = [
  { id: 'g1', name: '正⑥', level: 1 },
  { id: 'g2', name: '正⑤', level: 2 },
  { id: 'g3', name: '正④', level: 3 },
  { id: 'g4', name: '正③', level: 4 },
  { id: 'g5', name: '正②', level: 5 },
  { id: 'g6', name: '正①', level: 6 },
]

/**
 * 号俸テーブルフォームの有効データを生成
 */
export function buildSalaryTableFormData(overrides?: Record<string, unknown>) {
  return {
    companyId: 'company-123',
    baseSalaryMin: 180_000,
    initialStepDiff: 1_900,
    bandIncreaseRate: 1.05,
    stepsPerBand: 8,
    salaryBandCount: 15,
    ...overrides,
  }
}

// ============================================
// 評価
// ============================================

/** 全評価レート */
export const ALL_RATINGS: EvaluationRating[] = ['S', 'A', 'B', 'C', 'D']

/**
 * 評価期間の有効データを生成
 */
export function buildEvaluationPeriodData(overrides?: Record<string, unknown>) {
  return {
    companyId: TEST_CUID,
    name: '2026年上期',
    periodType: 'FIRST_HALF',
    startDate: '2026-04-01',
    endDate: '2026-09-30',
    ...overrides,
  }
}

/**
 * 個別評価作成の有効データを生成
 */
export function buildIndividualEvaluationData(overrides?: Record<string, unknown>) {
  return {
    evaluationPeriodId: TEST_CUID,
    employeeId: TEST_CUID,
    evaluatorId: TEST_CUID,
    ...overrides,
  }
}

/**
 * 評価スコアの有効データを生成
 */
export function buildEvaluationScoreData(overrides?: Record<string, unknown>) {
  return {
    individualEvaluationId: TEST_CUID,
    evaluationItemId: TEST_CUID,
    selfScore: 4,
    evaluatorScore: 5,
    ...overrides,
  }
}

/**
 * 評価項目作成の有効データを生成
 */
export function buildEvaluationItemData(overrides?: Record<string, unknown>) {
  return {
    name: '安全意識',
    category: '安全への取り組み',
    ...overrides,
  }
}

/**
 * 評価者割当の有効データを生成
 */
export function buildEvaluatorAssignmentData(overrides?: Record<string, unknown>) {
  return {
    evaluation360Id: TEST_CUID,
    evaluatorId: TEST_CUID,
    order: 1,
    ...overrides,
  }
}

/**
 * 360度評価スコアの有効データを生成
 */
export function buildEvaluation360ScoreData(overrides?: Record<string, unknown>) {
  return {
    evaluation360Id: TEST_CUID,
    evaluatorAssignmentId: TEST_CUID,
    evaluationItemId: TEST_CUID,
    score: 4,
    ...overrides,
  }
}

/**
 * 評価基準の有効データを生成
 */
export function buildEvaluationCriteriaData(overrides?: Record<string, unknown>) {
  return {
    companyId: TEST_CUID,
    firstHalfRating: 'S' as const,
    secondHalfRating: 'A' as const,
    finalRating: 'S' as const,
    ...overrides,
  }
}

/**
 * 号俸改定ルールの有効データを生成
 */
export function buildGradeAdjustmentRuleData(overrides?: Record<string, unknown>) {
  return {
    gradeId: TEST_CUID,
    currentRank: 'A',
    rating: 'S',
    stepAdjustment: 3,
    ...overrides,
  }
}

/**
 * バルク評価スコアの有効データを生成
 */
export function buildBulkEvaluationScoresData(overrides?: Record<string, unknown>) {
  return {
    individualEvaluationId: TEST_CUID,
    scores: [
      { evaluationItemId: TEST_CUID, selfScore: 4, evaluatorScore: 5 },
      { evaluationItemId: TEST_CUID_2, selfScore: 3, evaluatorScore: null },
    ],
    ...overrides,
  }
}

// ============================================
// 等級
// ============================================

/**
 * 等級フォームの有効データを生成
 */
export function buildGradeFormData(overrides?: Record<string, unknown>) {
  return {
    name: '正①',
    level: 1,
    employmentType: 'FULL_TIME',
    companyId: 'company-123',
    ...overrides,
  }
}

/**
 * 等級×職種設定の有効データを生成
 */
export function buildGradeJobTypeConfigData(overrides?: Record<string, unknown>) {
  return {
    gradeId: 'grade-123',
    jobTypeId: 'jobtype-456',
    isEnabled: true,
    ...overrides,
  }
}

/**
 * マトリクス一括更新の有効データを生成
 */
export function buildMatrixUpdateData(overrides?: Record<string, unknown>) {
  return {
    companyId: 'company-123',
    updates: [
      { gradeId: 'g1', jobTypeId: 'j1', isEnabled: true },
      { gradeId: 'g2', jobTypeId: 'j1', isEnabled: false },
    ],
    ...overrides,
  }
}

/**
 * 役割責任の有効データを生成
 */
export function buildGradeRoleData(overrides?: Record<string, unknown>) {
  return {
    gradeJobTypeConfigId: 'config-123',
    responsibilities: ['安全管理', '品質管理'],
    positionNames: ['現場主任', '班長'],
    ...overrides,
  }
}

// ============================================
// 会社
// ============================================

/**
 * 会社フォームの有効データを生成
 */
export function buildCompanyData(overrides?: Record<string, unknown>) {
  return {
    name: 'テスト解体株式会社',
    evaluationCycle: 'HALF_YEARLY',
    ...overrides,
  }
}
