/**
 * 評価テンプレート関連の型定義
 * PeriodEvaluationTemplate, PeriodEvaluationTemplateItem
 */

// ============================================
// 期間固有評価テンプレート
// ============================================

/**
 * 期間固有テンプレート項目
 */
export interface PeriodEvaluationTemplateItemData {
  id?: string;
  sourceItemId?: string | null;
  name: string;
  description?: string | null;
  category: string;
  maxScore: number;
  weight: number;
  sortOrder: number;
  isAdded?: boolean;
  isDeleted?: boolean;
  isModified?: boolean;
}

/**
 * 期間固有テンプレートのカテゴリグループ
 */
export interface PeriodEvaluationTemplateCategory {
  name: string;
  items: PeriodEvaluationTemplateItemData[];
}

/**
 * 期間固有テンプレート
 */
export interface PeriodEvaluationTemplateData {
  id: string;
  periodId: string;
  sourceTemplateId: string;
  gradeId: string;
  jobTypeId: string;
  name: string;
  description?: string | null;
  status: "draft" | "confirmed";
  createdAt: Date | string;
  updatedAt: Date | string;
  grade?: {
    id: string;
    name: string;
  };
  jobType?: {
    id: string;
    name: string;
  };
  sourceTemplate?: {
    id: string;
    name: string;
  };
  items?: PeriodEvaluationTemplateItemData[];
  // 統計情報
  itemCount?: number;
  totalMaxScore?: number;
  hasChanges?: boolean;
}

// ============================================
// DTOs
// ============================================

/**
 * 期間固有テンプレート作成用DTO
 */
export interface CreatePeriodEvaluationTemplateDto {
  sourceTemplateId: string;
}

/**
 * 期間固有テンプレート更新用DTO
 */
export interface UpdatePeriodEvaluationTemplateDto {
  name?: string;
  description?: string;
  status?: "draft" | "confirmed";
  items?: PeriodEvaluationTemplateItemData[];
}

/**
 * 期間固有テンプレート項目一括更新用DTO
 */
export interface BulkUpdatePeriodTemplateItemsDto {
  items: PeriodEvaluationTemplateItemData[];
}

/**
 * 期間固有テンプレートを従業員評価に反映するDTO
 */
export interface ApplyPeriodTemplateDto {
  employeeIds?: string[];
  overwrite?: boolean;
}

// ============================================
// Response Types
// ============================================

/**
 * 期間固有テンプレート一覧レスポンス
 */
export interface PeriodEvaluationTemplateListResponse {
  templates: PeriodEvaluationTemplateData[];
  total: number;
}

/**
 * 期間固有テンプレート詳細レスポンス
 */
export interface PeriodEvaluationTemplateDetailResponse extends PeriodEvaluationTemplateData {
  items: PeriodEvaluationTemplateItemData[];
  categories: PeriodEvaluationTemplateCategory[];
}

/**
 * テンプレート反映結果レスポンス
 */
export interface ApplyPeriodTemplateResponse {
  success: boolean;
  appliedCount: number;
  skippedCount: number;
  message: string;
  details?: {
    employeeId: string;
    employeeName: string;
    status: "applied" | "skipped" | "error";
    reason?: string;
  }[];
}

// ============================================
// UI Types
// ============================================

/**
 * テンプレートパネル表示用データ
 */
export interface TemplateDisplayData {
  id: string;
  name: string;
  gradeName: string;
  jobTypeName: string;
  itemCount: number;
  totalMaxScore: number;
  status: "draft" | "confirmed";
  hasChanges: boolean;
  isPeriodSpecific: boolean;
  sourceTemplateId?: string;
}

/**
 * テンプレート編集フォームデータ
 */
export interface TemplateEditFormData {
  name: string;
  description: string;
  categories: {
    name: string;
    sortOrder: number;
    items: {
      id?: string;
      sourceItemId?: string | null;
      name: string;
      description?: string;
      maxScore: number;
      weight: number;
      sortOrder: number;
      isAdded?: boolean;
      isDeleted?: boolean;
    }[];
  }[];
}
