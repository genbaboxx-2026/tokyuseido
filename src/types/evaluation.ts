/**
 * 評価関連の型定義
 * EvaluationPeriod, IndividualEvaluation, EvaluationItem, EvaluationScore,
 * Evaluation360, EvaluatorAssignment, Evaluation360Score,
 * EvaluationCriteria, GradeAdjustmentRule
 */

import type {
  EvaluationPeriod as EvaluationPeriodModel,
  IndividualEvaluation as IndividualEvaluationModel,
  EvaluationItem as EvaluationItemModel,
  EvaluationScore as EvaluationScoreModel,
  Evaluation360 as Evaluation360Model,
  EvaluatorAssignment as EvaluatorAssignmentModel,
  Evaluation360Score as Evaluation360ScoreModel,
  EvaluationCriteria as EvaluationCriteriaModel,
  GradeAdjustmentRule as GradeAdjustmentRuleModel
} from '../generated/prisma';

// ============================================
// Enums
// ============================================

/**
 * 評価期間タイプ
 */
export type PeriodType = 'FIRST_HALF' | 'SECOND_HALF';

export const PeriodTypeLabels: Record<PeriodType, string> = {
  FIRST_HALF: '上期',
  SECOND_HALF: '下期',
};

/**
 * 評価ステータス
 */
export type EvaluationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FEEDBACK_DONE';

export const EvaluationStatusLabels: Record<EvaluationStatus, string> = {
  NOT_STARTED: '未開始',
  IN_PROGRESS: '評価中',
  COMPLETED: '集計完了',
  FEEDBACK_DONE: 'FB完了',
};

/**
 * 評価レート
 */
export type EvaluationRating = 'S' | 'A' | 'B' | 'C' | 'D';

export const EvaluationRatingLabels: Record<EvaluationRating, string> = {
  S: '非常に優秀',
  A: '優秀',
  B: '標準',
  C: '要改善',
  D: '不十分',
};

/**
 * 評価スコア（0-5）
 */
export type EvaluationScoreValue = 0 | 1 | 3 | 4 | 5;

export const EvaluationScoreLabels: Record<EvaluationScoreValue, string> = {
  5: '非常に良い（常に達成）',
  4: '良い（概ね達成）',
  3: '普通（一部達成）',
  1: 'やや不十分（十分ではない）',
  0: '不十分（達成できていない）',
};

// ============================================
// Base Types (Prisma generated types)
// ============================================

export type EvaluationPeriod = EvaluationPeriodModel;
export type IndividualEvaluation = IndividualEvaluationModel;
export type EvaluationItem = EvaluationItemModel;
export type EvaluationScore = EvaluationScoreModel;
export type Evaluation360 = Evaluation360Model;
export type EvaluatorAssignment = EvaluatorAssignmentModel;
export type Evaluation360Score = Evaluation360ScoreModel;
export type EvaluationCriteria = EvaluationCriteriaModel;
export type GradeAdjustmentRule = GradeAdjustmentRuleModel;

// ============================================
// DTO Types - EvaluationPeriod
// ============================================

/**
 * 評価期間作成用DTO
 */
export interface CreateEvaluationPeriodDto {
  companyId: string;
  name: string;
  periodType: PeriodType;
  startDate: Date | string;
  endDate: Date | string;
}

/**
 * 評価期間更新用DTO
 */
export interface UpdateEvaluationPeriodDto {
  name?: string;
  periodType?: PeriodType;
  startDate?: Date | string;
  endDate?: Date | string;
  status?: EvaluationStatus;
}

// ============================================
// DTO Types - IndividualEvaluation
// ============================================

/**
 * 個別評価作成用DTO
 */
export interface CreateIndividualEvaluationDto {
  evaluationPeriodId: string;
  employeeId: string;
  evaluatorId: string;
}

/**
 * 個別評価更新用DTO
 */
export interface UpdateIndividualEvaluationDto {
  status?: EvaluationStatus;
  totalScore?: number;
  finalRating?: EvaluationRating;
}

// ============================================
// DTO Types - EvaluationItem
// ============================================

/**
 * 評価項目作成用DTO
 */
export interface CreateEvaluationItemDto {
  name: string;
  description?: string;
  category: string;
  weight?: number;
  gradeJobTypeConfigId?: string;
}

/**
 * 評価項目更新用DTO
 */
export interface UpdateEvaluationItemDto {
  name?: string;
  description?: string;
  category?: string;
  weight?: number;
  gradeJobTypeConfigId?: string | null;
}

// ============================================
// DTO Types - EvaluationScore
// ============================================

/**
 * 評価スコア入力用DTO
 */
export interface InputEvaluationScoreDto {
  individualEvaluationId: string;
  evaluationItemId: string;
  selfScore?: number;
  evaluatorScore?: number;
  comment?: string;
}

/**
 * 評価スコア一括入力用DTO
 */
export interface BulkInputEvaluationScoreDto {
  individualEvaluationId: string;
  scores: {
    evaluationItemId: string;
    selfScore?: number;
    evaluatorScore?: number;
    comment?: string;
  }[];
}

// ============================================
// DTO Types - Evaluation360
// ============================================

/**
 * 360度評価作成用DTO
 */
export interface CreateEvaluation360Dto {
  evaluationPeriodId: string;
  employeeId: string;
}

/**
 * 360度評価更新用DTO
 */
export interface UpdateEvaluation360Dto {
  status?: EvaluationStatus;
  averageScore?: number;
  feedback?: string;
}

// ============================================
// DTO Types - EvaluatorAssignment
// ============================================

/**
 * 評価者割当用DTO
 */
export interface CreateEvaluatorAssignmentDto {
  evaluation360Id: string;
  evaluatorId: string;
  order: number;
}

/**
 * 評価者割当一括設定用DTO
 */
export interface BulkCreateEvaluatorAssignmentDto {
  evaluation360Id: string;
  evaluators: {
    evaluatorId: string;
    order: number;
  }[];
}

// ============================================
// DTO Types - Evaluation360Score
// ============================================

/**
 * 360度評価スコア入力用DTO
 */
export interface InputEvaluation360ScoreDto {
  evaluation360Id: string;
  evaluatorAssignmentId: string;
  evaluationItemId: string;
  score: number;
  comment?: string;
}

// ============================================
// DTO Types - EvaluationCriteria
// ============================================

/**
 * 評価基準マトリクス設定用DTO
 */
export interface CreateEvaluationCriteriaDto {
  companyId: string;
  firstHalfRating: EvaluationRating;
  secondHalfRating: EvaluationRating;
  finalRating: EvaluationRating;
}

/**
 * 評価基準マトリクス一括設定用DTO
 */
export interface BulkCreateEvaluationCriteriaDto {
  companyId: string;
  criteria: {
    firstHalfRating: EvaluationRating;
    secondHalfRating: EvaluationRating;
    finalRating: EvaluationRating;
  }[];
}

// ============================================
// DTO Types - GradeAdjustmentRule
// ============================================

/**
 * 号俸改定基準設定用DTO
 */
export interface CreateGradeAdjustmentRuleDto {
  gradeId: string;
  currentRank: string;
  rating: EvaluationRating;
  stepAdjustment: number;
}

/**
 * 号俸改定基準一括設定用DTO
 */
export interface BulkCreateGradeAdjustmentRuleDto {
  gradeId: string;
  rules: {
    currentRank: string;
    rating: EvaluationRating;
    stepAdjustment: number;
  }[];
}

// ============================================
// Response Types
// ============================================

/**
 * 評価期間一覧レスポンス
 */
export interface EvaluationPeriodListResponse {
  periods: EvaluationPeriodWithStats[];
}

/**
 * 評価期間（統計情報を含む）
 */
export interface EvaluationPeriodWithStats extends EvaluationPeriod {
  individualEvaluationCount: number;
  evaluation360Count: number;
  completedCount: number;
}

/**
 * 個別評価詳細レスポンス
 */
export interface IndividualEvaluationDetailResponse extends IndividualEvaluation {
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    gradeName: string;
    jobTypeName: string;
  };
  evaluator: {
    id: string;
    name: string;
  };
  items: EvaluationItemWithScore[];
}

/**
 * 評価項目（スコアを含む）
 */
export interface EvaluationItemWithScore extends EvaluationItem {
  score?: {
    selfScore: number | null;
    evaluatorScore: number | null;
    comment: string | null;
  };
  previousScore?: {
    evaluatorScore: number | null;
  };
}

/**
 * 360度評価詳細レスポンス
 */
export interface Evaluation360DetailResponse extends Evaluation360 {
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    gradeName: string;
    jobTypeName: string;
  };
  evaluators: EvaluatorWithScores[];
  items: EvaluationItem[];
  averagesByItem: {
    evaluationItemId: string;
    averageScore: number;
  }[];
}

/**
 * 評価者（スコアを含む）
 */
export interface EvaluatorWithScores {
  assignment: EvaluatorAssignment;
  evaluator: {
    id: string;
    name: string;
  };
  scores: Evaluation360Score[];
  isCompleted: boolean;
}

/**
 * 評価基準マトリクスレスポンス
 */
export interface EvaluationCriteriaMatrixResponse {
  companyId: string;
  matrix: {
    firstHalfRating: EvaluationRating;
    secondHalfRating: EvaluationRating;
    finalRating: EvaluationRating;
  }[][];
}

/**
 * 号俸改定基準テーブルレスポンス
 */
export interface GradeAdjustmentRuleTableResponse {
  gradeId: string;
  gradeName: string;
  ranks: string[];
  rules: {
    rank: string;
    adjustments: {
      rating: EvaluationRating;
      stepAdjustment: number;
    }[];
  }[];
}

// ============================================
// Evaluation Sheet Types
// ============================================

/**
 * 評価シート（PDF出力用）
 */
export interface EvaluationSheet {
  period: {
    name: string;
    startDate: string;
    endDate: string;
  };
  employee: {
    name: string;
    employeeCode: string;
    department: string;
    grade: string;
    jobType: string;
  };
  evaluator: {
    name: string;
  };
  categories: EvaluationSheetCategory[];
  totalScore: number | null;
  finalRating: EvaluationRating | null;
}

/**
 * 評価シートのカテゴリ
 */
export interface EvaluationSheetCategory {
  name: string;
  items: {
    name: string;
    description: string | null;
    weight: number | null;
    selfScore: number | null;
    evaluatorScore: number | null;
    previousScore: number | null;
    comment: string | null;
  }[];
}

// ============================================
// Dashboard Types
// ============================================

/**
 * 評価ダッシュボードデータ
 */
export interface EvaluationDashboardData {
  currentPeriod: EvaluationPeriod | null;
  periodStats: {
    totalIndividual: number;
    completedIndividual: number;
    total360: number;
    completed360: number;
  };
  ratingDistribution: {
    rating: EvaluationRating;
    count: number;
    percentage: number;
  }[];
  departmentStats: {
    departmentId: string;
    departmentName: string;
    averageScore: number;
    completionRate: number;
  }[];
}

// ============================================
// Query Types
// ============================================

/**
 * 評価期間検索クエリ
 */
export interface EvaluationPeriodSearchQuery {
  companyId: string;
  year?: number;
  periodType?: PeriodType;
  status?: EvaluationStatus;
}

/**
 * 個別評価検索クエリ
 */
export interface IndividualEvaluationSearchQuery {
  evaluationPeriodId: string;
  employeeId?: string;
  evaluatorId?: string;
  status?: EvaluationStatus;
  departmentId?: string;
}

/**
 * 360度評価検索クエリ
 */
export interface Evaluation360SearchQuery {
  evaluationPeriodId: string;
  employeeId?: string;
  status?: EvaluationStatus;
  departmentId?: string;
}

// ============================================
// UI Types
// ============================================

/**
 * 評価期間選択オプション
 */
export interface EvaluationPeriodOption {
  value: string;
  label: string;
  periodType: PeriodType;
  status: EvaluationStatus;
}

/**
 * 評価進捗表示用データ
 */
export interface EvaluationProgressData {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  feedbackDone: number;
  completionRate: number;
}

/**
 * 360度評価者割当テーブルの行
 */
export interface Evaluation360AssignmentRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  evaluator1?: {
    id: string;
    name: string;
  };
  evaluator2?: {
    id: string;
    name: string;
  };
  evaluator3?: {
    id: string;
    name: string;
  };
  evaluator4?: {
    id: string;
    name: string;
  };
  averageScore: number | null;
  feedback: string | null;
  status: EvaluationStatus;
}

// ============================================
// 360度評価テンプレート関連の型定義
// ============================================

/**
 * 360度評価テンプレート項目
 */
export interface Evaluation360TemplateItemData {
  id?: string;
  content: string;
  maxScore?: number; // 満点（デフォルト5点）
  sortOrder: number;
}

/**
 * 360度評価テンプレートカテゴリ
 */
export interface Evaluation360TemplateCategoryData {
  id?: string;
  name: string;
  sortOrder: number;
  items: Evaluation360TemplateItemData[];
}

/**
 * 360度評価テンプレート作成用DTO
 */
export interface CreateEvaluation360TemplateDto {
  companyId: string;
  name: string;
  description?: string;
  gradeIds: string[];
  jobCategoryIds: string[];
  categories?: Evaluation360TemplateCategoryData[];
}

/**
 * 360度評価テンプレート更新用DTO
 */
export interface UpdateEvaluation360TemplateDto {
  name?: string;
  description?: string;
  isActive?: boolean;
  gradeIds?: string[];
  jobCategoryIds?: string[];
}

/**
 * 360度評価テンプレートコンテンツ更新用DTO
 */
export interface UpdateEvaluation360TemplateContentDto {
  categories: Evaluation360TemplateCategoryData[];
}

/**
 * 360度評価テンプレートレスポンス
 */
export interface Evaluation360TemplateResponse {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  status: "draft" | "confirmed";
  createdAt: Date | string;
  updatedAt: Date | string;
  grades: {
    id: string;
    name: string;
    level: number;
  }[];
  jobTypes: {
    id: string;
    name: string;
  }[];
  categories: {
    id: string;
    name: string;
    sortOrder: number;
    items: {
      id: string;
      content: string;
      maxScore: number;
      sortOrder: number;
    }[];
  }[];
  _count?: {
    categories: number;
  };
}

/**
 * 360度評価テンプレート一覧レスポンス
 */
export interface Evaluation360TemplateListResponse {
  templates: Evaluation360TemplateResponse[];
  total: number;
}

/**
 * 360度評価テンプレートサマリー（一覧表示用）
 */
export interface Evaluation360TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  status: "draft" | "confirmed";
  createdAt: Date | string;
  updatedAt: Date | string;
  gradesCount: number;
  jobTypesCount: number;
  categoriesCount: number;
  itemsCount: number;
  grades: {
    id: string;
    name: string;
    level?: number;
  }[];
  jobTypes: {
    id: string;
    name: string;
  }[];
}

// ============================================
// EvaluationCustomItem Types
// ============================================

/**
 * 評価項目カスタマイズのタイプ
 */
export type EvaluationCustomItemType = "individual" | "360";

/**
 * カスタム評価項目
 */
export interface EvaluationCustomItemData {
  id?: string;
  sourceTemplateItemId?: string | null;
  itemName: string;
  description?: string | null;
  maxScore: number;
  sortOrder: number;
  isCustomized?: boolean;
  isAdded?: boolean;
  isDeleted?: boolean;
}

/**
 * 360度評価カテゴリ（カスタマイズ用）
 */
export interface EvaluationCustomCategory {
  name: string;
  sortOrder: number;
  items: EvaluationCustomItemData[];
}

/**
 * 個別評価項目取得レスポンス
 */
export interface IndividualEvaluationItemsResponse {
  employeeId: string;
  periodId: string | null;
  type: "individual";
  isInitialized: boolean;
  items: EvaluationCustomItemData[];
  templateId?: string;
  message?: string;
}

/**
 * 360度評価項目取得レスポンス
 */
export interface Evaluation360ItemsResponse {
  employeeId: string;
  periodId: string | null;
  type: "360";
  isInitialized: boolean;
  categories: EvaluationCustomCategory[];
  templateId?: string;
  templateName?: string;
  message?: string;
}
