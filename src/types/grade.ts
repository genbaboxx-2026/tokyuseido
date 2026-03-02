/**
 * 等級・職種関連の型定義
 * Grade, JobCategory, JobType, GradeJobTypeConfig, GradeRole
 */

import type {
  Grade as GradeModel,
  JobCategory as JobCategoryModel,
  JobType as JobTypeModel,
  GradeJobTypeConfig as GradeJobTypeConfigModel,
  GradeRole as GradeRoleModel
} from '../generated/prisma';
import type { EmploymentType } from './employee';

// ============================================
// Base Types (Prisma generated types)
// ============================================

export type Grade = GradeModel;
export type JobCategory = JobCategoryModel;
export type JobType = JobTypeModel;
export type GradeJobTypeConfig = GradeJobTypeConfigModel;
export type GradeRole = GradeRoleModel;

// ============================================
// DTO Types - JobCategory
// ============================================

/**
 * 職種大分類作成用DTO
 */
export interface CreateJobCategoryDto {
  companyId: string;
  name: string;
}

/**
 * 職種大分類更新用DTO
 */
export interface UpdateJobCategoryDto {
  name?: string;
}

// ============================================
// DTO Types - JobType
// ============================================

/**
 * 職種小分類作成用DTO
 */
export interface CreateJobTypeDto {
  jobCategoryId: string;
  name: string;
}

/**
 * 職種小分類更新用DTO
 */
export interface UpdateJobTypeDto {
  name?: string;
  jobCategoryId?: string;
}

// ============================================
// DTO Types - Grade
// ============================================

/**
 * 等級作成用DTO
 */
export interface CreateGradeDto {
  companyId: string;
  name: string;
  level: number;
  employmentType: EmploymentType;
  isManagement?: boolean;
}

/**
 * 等級更新用DTO
 */
export interface UpdateGradeDto {
  name?: string;
  level?: number;
  employmentType?: EmploymentType;
  isManagement?: boolean;
}

// ============================================
// DTO Types - GradeJobTypeConfig
// ============================================

/**
 * 等級×職種設定作成用DTO
 */
export interface CreateGradeJobTypeConfigDto {
  gradeId: string;
  jobTypeId: string;
  isEnabled?: boolean;
}

/**
 * 等級×職種設定更新用DTO
 */
export interface UpdateGradeJobTypeConfigDto {
  isEnabled: boolean;
}

/**
 * 等級×職種設定の一括更新用DTO
 */
export interface BulkUpdateGradeJobTypeConfigDto {
  configs: {
    gradeId: string;
    jobTypeId: string;
    isEnabled: boolean;
  }[];
}

// ============================================
// DTO Types - GradeRole
// ============================================

/**
 * 役割責任の項目
 */
export interface ResponsibilityItem {
  id: string;
  order: number;
  content: string;
}

/**
 * 役割責任作成用DTO
 */
export interface CreateGradeRoleDto {
  gradeJobTypeConfigId: string;
  responsibilities: ResponsibilityItem[];
  positionNames: string[];
}

/**
 * 役割責任更新用DTO
 */
export interface UpdateGradeRoleDto {
  responsibilities?: ResponsibilityItem[];
  positionNames?: string[];
}

// ============================================
// Response Types
// ============================================

/**
 * 職種カテゴリと職種小分類を含むレスポンス
 */
export interface JobCategoryWithTypesResponse extends JobCategory {
  jobTypes: JobType[];
}

/**
 * 等級一覧レスポンス
 */
export interface GradeListResponse {
  grades: Grade[];
}

/**
 * 等級×職種マトリクスのセル
 */
export interface GradeJobTypeMatrixCell {
  gradeId: string;
  jobTypeId: string;
  isEnabled: boolean;
  gradeRole?: GradeRoleResponse | null;
  employeeCount?: number;
}

/**
 * 等級×職種マトリクスレスポンス
 */
export interface GradeJobTypeMatrixResponse {
  grades: Grade[];
  jobTypes: JobTypeWithCategoryResponse[];
  matrix: GradeJobTypeMatrixCell[][];
}

/**
 * 職種小分類（カテゴリ名を含む）レスポンス
 */
export interface JobTypeWithCategoryResponse extends JobType {
  categoryName: string;
}

/**
 * 役割責任レスポンス（PrismaのGradeRoleをUIで使いやすい形に変換）
 */
export interface GradeRoleResponse {
  id: string;
  gradeJobTypeConfigId: string;
  responsibilities: ResponsibilityItem[];
  positionNames: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 役割責任マトリクスのセル
 */
export interface RoleMatrixCell {
  gradeId: string;
  gradeName: string;
  gradeLevel: number;
  jobTypeId: string;
  jobTypeName: string;
  isEnabled: boolean;
  positionNames: string[];
  responsibilities: ResponsibilityItem[];
  employees: {
    id: string;
    name: string;
  }[];
}

/**
 * 役割責任マトリクスレスポンス
 */
export interface RoleMatrixResponse {
  grades: {
    id: string;
    name: string;
    level: number;
    isManagement: boolean;
  }[];
  jobTypes: {
    id: string;
    name: string;
    categoryName: string;
  }[];
  cells: RoleMatrixCell[][];
}

// ============================================
// Query Types
// ============================================

/**
 * 等級検索クエリ
 */
export interface GradeSearchQuery {
  companyId: string;
  employmentType?: EmploymentType;
  isManagement?: boolean;
}

/**
 * 職種検索クエリ
 */
export interface JobTypeSearchQuery {
  companyId: string;
  jobCategoryId?: string;
}

// ============================================
// UI Types
// ============================================

/**
 * 等級選択オプション
 */
export interface GradeOption {
  value: string;
  label: string;
  level: number;
  employmentType: EmploymentType;
  isManagement: boolean;
}

/**
 * 職種選択オプション
 */
export interface JobTypeOption {
  value: string;
  label: string;
  categoryId: string;
  categoryName: string;
}

/**
 * 有効な等級×職種の組み合わせオプション
 */
export interface ValidGradeJobTypeOption {
  gradeId: string;
  gradeName: string;
  jobTypeId: string;
  jobTypeName: string;
}
