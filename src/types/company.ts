/**
 * 会社・組織関連の型定義
 * Company, Department, Position
 */

import type { Company as CompanyModel, Department as DepartmentModel, Position as PositionModel } from '../generated/prisma';

// ============================================
// Enums
// ============================================

/**
 * 評価周期
 */
export type EvaluationCycle = 'HALF_YEARLY' | 'YEARLY';

export const EvaluationCycleLabels: Record<EvaluationCycle, string> = {
  HALF_YEARLY: '半期',
  YEARLY: '年次',
};

// ============================================
// Base Types (Prisma generated types)
// ============================================

export type Company = CompanyModel;
export type Department = DepartmentModel;
export type Position = PositionModel;

// ============================================
// DTO Types - Company
// ============================================

/**
 * 会社作成用DTO
 */
export interface CreateCompanyDto {
  name: string;
  address?: string;
  representative?: string;
  establishedDate?: Date | string;
  businessDescription?: string;
  evaluationCycle?: EvaluationCycle;
}

/**
 * 会社更新用DTO
 */
export interface UpdateCompanyDto {
  name?: string;
  address?: string;
  representative?: string;
  establishedDate?: Date | string;
  businessDescription?: string;
  evaluationCycle?: EvaluationCycle;
}

// ============================================
// DTO Types - Department
// ============================================

/**
 * 部署作成用DTO
 */
export interface CreateDepartmentDto {
  companyId: string;
  name: string;
  parentId?: string;
}

/**
 * 部署更新用DTO
 */
export interface UpdateDepartmentDto {
  name?: string;
  parentId?: string | null;
}

// ============================================
// DTO Types - Position
// ============================================

/**
 * 役職作成用DTO
 */
export interface CreatePositionDto {
  companyId: string;
  name: string;
  level: number;
}

/**
 * 役職更新用DTO
 */
export interface UpdatePositionDto {
  name?: string;
  level?: number;
}

// ============================================
// Response Types
// ============================================

/**
 * 会社一覧レスポンス
 */
export interface CompanyListResponse {
  companies: Company[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 会社詳細レスポンス（関連データ含む）
 */
export interface CompanyDetailResponse extends Company {
  departments: DepartmentTreeNode[];
  positions: Position[];
  employeeCount: number;
}

/**
 * 部署ツリーノード（階層構造表示用）
 */
export interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
  employeeCount?: number;
}

/**
 * 部署一覧レスポンス（フラット構造）
 */
export interface DepartmentListResponse {
  departments: Department[];
}

/**
 * 役職一覧レスポンス
 */
export interface PositionListResponse {
  positions: Position[];
}

// ============================================
// Query Types
// ============================================

/**
 * 会社検索クエリ
 */
export interface CompanySearchQuery {
  name?: string;
  page?: number;
  limit?: number;
}

/**
 * 部署検索クエリ
 */
export interface DepartmentSearchQuery {
  companyId: string;
  name?: string;
  parentId?: string;
}

// ============================================
// UI Types
// ============================================

/**
 * 会社選択オプション（セレクトボックス用）
 */
export interface CompanyOption {
  value: string;
  label: string;
}

/**
 * 部署選択オプション（セレクトボックス用）
 */
export interface DepartmentOption {
  value: string;
  label: string;
  parentId: string | null;
  depth: number;
}

/**
 * 役職選択オプション（セレクトボックス用）
 */
export interface PositionOption {
  value: string;
  label: string;
  level: number;
}

// ============================================
// 賞与設定関連の型
// ============================================

/**
 * 賞与設定
 */
export interface BonusSetting {
  id: string;
  companyId: string;
  name: string;
  assessmentStartDate: Date | string;
  assessmentEndDate: Date | string;
  evaluationStartDate: Date | string;
  evaluationEndDate: Date | string;
  paymentDate: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * 賞与設定作成用DTO
 */
export interface CreateBonusSettingDto {
  companyId: string;
  name: string;
  assessmentStartDate: Date | string;
  assessmentEndDate: Date | string;
  evaluationStartDate: Date | string;
  evaluationEndDate: Date | string;
  paymentDate: Date | string;
}

/**
 * 賞与設定更新用DTO
 */
export interface UpdateBonusSettingDto {
  name?: string;
  assessmentStartDate?: Date | string;
  assessmentEndDate?: Date | string;
  evaluationStartDate?: Date | string;
  evaluationEndDate?: Date | string;
  paymentDate?: Date | string;
}

/**
 * 会社給与設定
 */
export interface CompanySalarySettings {
  salaryReflectionMonth: number | null;
  salaryReflectionDay: number | null;
  evaluationPeriodStart: Date | string | null;
  evaluationPeriodEnd: Date | string | null;
}

/**
 * 会社給与設定更新用DTO
 */
export interface UpdateCompanySalarySettingsDto {
  salaryReflectionMonth?: number | null;
  salaryReflectionDay?: number | null;
  evaluationPeriodStart?: Date | string | null;
  evaluationPeriodEnd?: Date | string | null;
}
