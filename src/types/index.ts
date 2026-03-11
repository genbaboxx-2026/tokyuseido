/**
 * NiNKU BOXX - 型定義のエントリーポイント
 * 全ての型定義をこのファイルからre-exportする
 */

// ============================================
// User関連
// ============================================
export * from './user';

// ============================================
// Company関連
// ============================================
export * from './company';

// ============================================
// Company Settings関連（UI統一）
// ============================================
export * from './company-settings';

// ============================================
// Grade関連
// ============================================
export * from './grade';

// ============================================
// Salary関連
// ============================================
export * from './salary';

// ============================================
// Employee関連
// ============================================
export * from './employee';

// ============================================
// Evaluation関連
// ============================================
export * from './evaluation';

// ============================================
// Evaluation Template関連（期間固有テンプレート）
// ============================================
export * from './evaluation-template';

// ============================================
// Evaluation Result関連（評価確定・号俸反映）
// ============================================
export * from './evaluation-result';

// ============================================
// 共通の型定義
// ============================================

/**
 * ページネーション情報
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * ページネーション付きレスポンス
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

/**
 * API エラーレスポンス
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/**
 * API 成功レスポンス
 */
export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

/**
 * ソート方向
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 基本的な検索クエリ
 */
export interface BaseSearchQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

/**
 * 日付範囲
 */
export interface DateRange {
  startDate: Date | string;
  endDate: Date | string;
}

/**
 * ID付きエンティティ
 */
export interface EntityWithId {
  id: string;
}

/**
 * タイムスタンプ付きエンティティ
 */
export interface EntityWithTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 選択オプション（汎用）
 */
export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * ツリーノード（汎用）
 */
export interface TreeNode<T> {
  data: T;
  children: TreeNode<T>[];
}

/**
 * バルク操作結果
 */
export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: {
    index: number;
    message: string;
  }[];
}

/**
 * ファイルアップロード情報
 */
export interface FileUploadInfo {
  filename: string;
  mimetype: string;
  size: number;
  url: string;
}

/**
 * 監査ログ情報
 */
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  createdAt: Date;
}
