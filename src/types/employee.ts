/**
 * 従業員関連の型定義
 * Employee, EmployeeGradeHistory, InterviewRecord, EmployeeSalary
 */

import type {
  Employee as EmployeeModel,
  EmployeeGradeHistory as EmployeeGradeHistoryModel,
  InterviewRecord as InterviewRecordModel,
  EmployeeSalary as EmployeeSalaryModel
} from '../generated/prisma';

// ============================================
// Enums
// ============================================

/**
 * 雇用形態
 */
export type EmploymentType = 'FULL_TIME' | 'CONTRACT' | 'OUTSOURCE' | 'PART_TIME';

export const EmploymentTypeLabels: Record<EmploymentType, string> = {
  FULL_TIME: '正社員',
  CONTRACT: '契約社員',
  OUTSOURCE: '業務委託',
  PART_TIME: 'パート',
};

/**
 * 従業員ステータス
 */
export type EmployeeStatus = 'ACTIVE' | 'LEAVE' | 'RETIRED';

export const EmployeeStatusLabels: Record<EmployeeStatus, string> = {
  ACTIVE: '在籍中',
  LEAVE: '休職中',
  RETIRED: '退職',
};

/**
 * 性別
 */
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export const GenderLabels: Record<Gender, string> = {
  MALE: '男性',
  FEMALE: '女性',
  OTHER: 'その他',
};

// ============================================
// Base Types (Prisma generated types)
// ============================================

export type Employee = EmployeeModel;
export type EmployeeGradeHistory = EmployeeGradeHistoryModel;
export type InterviewRecord = InterviewRecordModel;
export type EmployeeSalary = EmployeeSalaryModel;

// ============================================
// DTO Types - Employee
// ============================================

/**
 * 従業員作成用DTO
 */
export interface CreateEmployeeDto {
  companyId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  gender?: Gender;
  birthDate?: Date | string;
  hireDate: Date | string;
  departmentId?: string;
  employmentType: EmploymentType;
  jobTypeId?: string;
  gradeId?: string;
  positionId?: string;
  currentStep?: number;
  currentRank?: string;
  baseSalary?: number;
  status?: EmployeeStatus;
  profileImage?: string;
}

/**
 * 従業員更新用DTO
 */
export interface UpdateEmployeeDto {
  firstName?: string;
  lastName?: string;
  gender?: Gender;
  birthDate?: Date | string | null;
  hireDate?: Date | string;
  departmentId?: string | null;
  employmentType?: EmploymentType;
  jobTypeId?: string | null;
  gradeId?: string | null;
  positionId?: string | null;
  currentStep?: number | null;
  currentRank?: string | null;
  baseSalary?: number | null;
  status?: EmployeeStatus;
  profileImage?: string | null;
}

/**
 * 従業員一括インポート用DTO
 */
export interface BulkImportEmployeeDto {
  companyId: string;
  employees: CreateEmployeeDto[];
}

// ============================================
// DTO Types - EmployeeGradeHistory
// ============================================

/**
 * 等級変更用DTO
 */
export interface ChangeEmployeeGradeDto {
  employeeId: string;
  gradeId: string;
  effectiveDate: Date | string;
  reason?: string;
}

// ============================================
// DTO Types - InterviewRecord
// ============================================

/**
 * 面談記録作成用DTO
 */
export interface CreateInterviewRecordDto {
  employeeId: string;
  interviewDate: Date | string;
  notes?: string;
  documentUrl?: string;
}

/**
 * 面談記録更新用DTO
 */
export interface UpdateInterviewRecordDto {
  interviewDate?: Date | string;
  notes?: string;
  documentUrl?: string;
}

// ============================================
// Response Types
// ============================================

/**
 * 従業員一覧レスポンス
 */
export interface EmployeeListResponse {
  employees: EmployeeWithRelations[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 従業員（関連データを含む）
 */
export interface EmployeeWithRelations extends Employee {
  department?: {
    id: string;
    name: string;
  } | null;
  jobType?: {
    id: string;
    name: string;
    categoryName: string;
  } | null;
  grade?: {
    id: string;
    name: string;
    level: number;
    isManagement: boolean;
  } | null;
  position?: {
    id: string;
    name: string;
    level: number;
  } | null;
}

/**
 * 従業員詳細レスポンス（パーソナルシート用）
 */
export interface EmployeeDetailResponse extends EmployeeWithRelations {
  fullName: string;
  age: number | null;
  yearsOfService: number;
  annualSalary: number | null;
  gradeHistory: EmployeeGradeHistoryWithGrade[];
  interviewRecords: InterviewRecord[];
  currentRole?: {
    responsibilities: string[];
    positionNames: string[];
  } | null;
}

/**
 * 等級変遷履歴（等級情報を含む）
 */
export interface EmployeeGradeHistoryWithGrade extends EmployeeGradeHistory {
  gradeName: string;
  gradeLevel: number;
}

/**
 * 面談記録一覧レスポンス
 */
export interface InterviewRecordListResponse {
  records: InterviewRecord[];
  total: number;
}

/**
 * 給与変遷履歴
 */
export interface SalaryHistoryItem {
  id: string;
  effectiveDate: Date | string;
  baseSalary: number;
  stepNumber: number;
  rank: string;
  gradeName: string;
}

/**
 * 給与変遷履歴レスポンス
 */
export interface SalaryHistoryResponse {
  history: SalaryHistoryItem[];
}

// ============================================
// Query Types
// ============================================

/**
 * 従業員検索クエリ
 */
export interface EmployeeSearchQuery {
  companyId: string;
  keyword?: string;           // 氏名・従業員コードで検索
  departmentId?: string | string[];
  employmentType?: EmploymentType | EmploymentType[];
  jobTypeId?: string | string[];
  gradeId?: string | string[];
  positionId?: string | string[];
  status?: EmployeeStatus;    // ステータスでフィルタ
  page?: number;
  limit?: number;
  sortBy?: EmployeeSortField;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 従業員ソートフィールド
 */
export type EmployeeSortField =
  | 'employeeCode'
  | 'lastName'
  | 'hireDate'
  | 'gradeLevel'
  | 'baseSalary'
  | 'createdAt';

// ============================================
// Statistics Types
// ============================================

/**
 * 等級別従業員数
 */
export interface EmployeeCountByGrade {
  gradeId: string;
  gradeName: string;
  gradeLevel: number;
  count: number;
}

/**
 * 職種別従業員数
 */
export interface EmployeeCountByJobType {
  jobTypeId: string;
  jobTypeName: string;
  categoryName: string;
  count: number;
}

/**
 * 部署別従業員数
 */
export interface EmployeeCountByDepartment {
  departmentId: string;
  departmentName: string;
  count: number;
}

/**
 * 従業員統計レスポンス
 */
export interface EmployeeStatisticsResponse {
  totalCount: number;
  byGrade: EmployeeCountByGrade[];
  byJobType: EmployeeCountByJobType[];
  byDepartment: EmployeeCountByDepartment[];
  byEmploymentType: {
    type: EmploymentType;
    count: number;
  }[];
  averageYearsOfService: number;
  averageBaseSalary: number;
}

// ============================================
// UI Types
// ============================================

/**
 * 従業員選択オプション
 */
export interface EmployeeOption {
  value: string;
  label: string;
  employeeCode: string;
  departmentName?: string;
}

/**
 * 従業員カード表示用データ
 */
export interface EmployeeCardData {
  id: string;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  gradeName: string | null;
  positionName: string | null;
  jobTypeName: string | null;
  baseSalary: number | null;
}

// ============================================
// Import/Export Types
// ============================================

/**
 * CSV/Excelインポート時の従業員データ
 */
export interface EmployeeImportRow {
  employeeCode: string;
  lastName: string;
  firstName: string;
  gender?: string;
  birthDate?: string;
  hireDate: string;
  departmentName?: string;
  employmentType: string;
  jobTypeName?: string;
  gradeName?: string;
  positionName?: string;
  baseSalary?: number;
}

/**
 * インポート結果
 */
export interface EmployeeImportResult {
  success: number;
  failed: number;
  errors: {
    row: number;
    employeeCode: string;
    message: string;
  }[];
}

/**
 * エクスポート形式
 */
export type EmployeeExportFormat = 'csv' | 'xlsx';
