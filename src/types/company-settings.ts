/**
 * 会社設定ページ UI統一 - 型定義
 * 全タブの変更を一括保存するためのPendingChanges型
 */

import type { EvaluationCycle } from './company';

// ============================================
// 基本情報の変更
// ============================================

/**
 * 基本情報の変更データ
 */
export interface BasicInfoChanges {
  name?: string;
  address?: string | null;
  representative?: string | null;
  establishedDate?: string | null;
  businessDescription?: string | null;
  evaluationCycle?: EvaluationCycle;
}

// ============================================
// 役職の変更
// ============================================

/**
 * 追加する役職データ
 */
export interface PositionAddData {
  tempId: string;
  name: string;
  level: number;
}

/**
 * 更新する役職データ
 */
export interface PositionUpdateData {
  id: string;
  name: string;
  level: number;
}

/**
 * 役職の変更データ
 */
export interface PositionChanges {
  added: PositionAddData[];
  updated: PositionUpdateData[];
  deleted: string[];
}

// ============================================
// 職種大分類・職種の変更
// ============================================

/**
 * 追加する職種大分類データ
 */
export interface JobCategoryAddData {
  tempId: string;
  name: string;
}

/**
 * 更新する職種大分類データ
 */
export interface JobCategoryUpdateData {
  id: string;
  name: string;
}

/**
 * 追加する職種データ
 */
export interface JobTypeAddData {
  categoryId: string; // 実IDまたはtempId
  tempId: string;
  name: string;
}

/**
 * 更新する職種データ
 */
export interface JobTypeUpdateData {
  id: string;
  name: string;
}

/**
 * 職種大分類・職種の変更データ
 */
export interface JobCategoryChanges {
  added: JobCategoryAddData[];
  updated: JobCategoryUpdateData[];
  deleted: string[];
  jobTypesAdded: JobTypeAddData[];
  jobTypesUpdated: JobTypeUpdateData[];
  jobTypesDeleted: string[];
}

// ============================================
// 給与設定の変更
// ============================================

/**
 * 給与設定の変更データ
 */
export interface SalarySettingsChanges {
  salaryReflectionMonth?: number | null;
  salaryReflectionDay?: number | null;
  evaluationPeriodStart?: string | null;
  evaluationPeriodEnd?: string | null;
}

// ============================================
// 賞与設定の変更
// ============================================

/**
 * 賞与設定の共通フィールド
 */
export interface BonusSettingData {
  name: string;
  paymentDate: string;
  assessmentStartDate: string;
  assessmentEndDate: string;
  evaluationStartDate: string;
  evaluationEndDate: string;
}

/**
 * 追加する賞与設定データ
 */
export interface BonusSettingAddData extends BonusSettingData {
  tempId: string;
}

/**
 * 更新する賞与設定データ
 */
export interface BonusSettingUpdateData extends BonusSettingData {
  id: string;
}

/**
 * 賞与設定の変更データ
 */
export interface BonusSettingsChanges {
  added: BonusSettingAddData[];
  updated: BonusSettingUpdateData[];
  deleted: string[];
}

// ============================================
// ペンディング変更の統合型
// ============================================

/**
 * 全タブの変更を追跡するペンディング変更
 */
export interface PendingChanges {
  /** 基本情報の変更 */
  basicInfo: BasicInfoChanges | null;

  /** 役職の変更 */
  positions: PositionChanges | null;

  /** 職種大分類・職種の変更 */
  jobCategories: JobCategoryChanges | null;

  /** 給与設定の変更 */
  salarySettings: SalarySettingsChanges | null;

  /** 賞与設定の変更 */
  bonusSettings: BonusSettingsChanges | null;
}

// ============================================
// API レスポンス型
// ============================================

/**
 * 一括保存APIの成功レスポンス
 */
export interface BulkSaveSuccessResponse {
  success: true;
}

/**
 * 一括保存APIのエラーレスポンス
 */
export interface BulkSaveErrorResponse {
  error: string;
}

/**
 * 一括保存APIのレスポンス
 */
export type BulkSaveResponse = BulkSaveSuccessResponse | BulkSaveErrorResponse;

// ============================================
// ユーティリティ型
// ============================================

/**
 * tempIdの判定用プレフィックス
 */
export const TEMP_ID_PREFIX = 'temp_';

/**
 * tempIdを生成する
 */
export const generateTempId = (): string => {
  return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
};

/**
 * tempIdかどうかを判定する
 */
export const isTempId = (id: string): boolean => {
  return id.startsWith(TEMP_ID_PREFIX);
};
