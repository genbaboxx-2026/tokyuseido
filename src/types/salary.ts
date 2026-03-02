/**
 * 号俸テーブル関連の型定義
 *
 * 【用語定義】
 * - ランク: S1, S2, A1, A2, B1... D8 などの評価ランク
 * - 号俸帯: 号俸の範囲グループ（旧「15T」「15」「14T」「14」など）
 * - 号俸帯数: 号俸帯をいくつ作るか（例: 15）
 * - 号俸帯内ステップ数: 各号俸帯を何段階に分けるか（例: 8）
 * - 号俸帯間増加率: 号俸帯が上がるごとに号差を何倍にするか（例: 1.05）
 * - 等級: 正①〜正⑥
 */

import type { SalaryTable as SalaryTableModel, SalaryTableEntry as SalaryTableEntryModel } from '../generated/prisma';

// ============================================
// Base Types (Prisma generated types)
// ============================================

export type SalaryTable = SalaryTableModel;
export type SalaryTableEntry = SalaryTableEntryModel;

// ============================================
// DTO Types - SalaryTable
// ============================================

/**
 * 号俸テーブル生成パラメータ
 *
 * 入力パラメータ（6つ）:
 * 1. baseSalaryMax - 基本給MAX（ユーザー入力）
 * 2. baseSalaryMin - 基本給MIN（ユーザー入力）
 * 3. stepsPerBand - 号俸帯内ステップ数（例: 8）
 * 4. bandIncreaseRate - 号俸帯間増加率（例: 1.05）
 * 5. initialStepDiff - 初期号差（例: 1,900円）
 * 6. salaryBandCount - 号俸帯数（例: 15）
 */
export interface SalaryTableGenerationParams {
  companyId: string;
  name: string;
  baseSalaryMax: number;      // 基本給MAX（ユーザー入力）
  baseSalaryMin: number;      // 基本給MIN（ユーザー入力）
  stepsPerBand: number;       // 号俸帯内ステップ数（例: 8）
  bandIncreaseRate: number;   // 号俸帯間増加率（例: 1.05）
  initialStepDiff: number;    // 初期号差（例: 1,900円）
  salaryBandCount: number;    // 号俸帯数（例: 15）
}

/**
 * 号俸テーブル作成用DTO
 */
export interface CreateSalaryTableDto extends SalaryTableGenerationParams {
  isActive?: boolean;
}

/**
 * 号俸テーブル更新用DTO
 */
export interface UpdateSalaryTableDto {
  name?: string;
  baseSalaryMax?: number;
  baseSalaryMin?: number;
  stepsPerBand?: number;
  bandIncreaseRate?: number;
  initialStepDiff?: number;
  salaryBandCount?: number;
  isActive?: boolean;
}

// ============================================
// DTO Types - SalaryTableEntry
// ============================================

/**
 * 号俸テーブルエントリ作成用DTO
 */
export interface CreateSalaryTableEntryDto {
  salaryTableId: string;
  gradeId: string;
  stepNumber: number;
  rank: string;
  baseSalary: number;
}

/**
 * 号俸テーブルエントリ更新用DTO
 */
export interface UpdateSalaryTableEntryDto {
  baseSalary: number;
}

// ============================================
// Response Types
// ============================================

/**
 * 号俸テーブル一覧レスポンス
 */
export interface SalaryTableListResponse {
  salaryTables: SalaryTable[];
}

/**
 * 号俸テーブル詳細レスポンス（エントリを含む）
 */
export interface SalaryTableDetailResponse extends SalaryTable {
  entries: SalaryTableEntryWithGrade[];
}

/**
 * 号俸テーブルエントリ（等級情報を含む）
 */
export interface SalaryTableEntryWithGrade extends SalaryTableEntry {
  gradeName: string;
  gradeLevel: number;
}

/**
 * 号俸テーブルマトリクスレスポンス（表示用）
 */
export interface SalaryTableMatrixResponse {
  salaryTable: SalaryTable;
  grades: {
    id: string;
    name: string;
    level: number;
  }[];
  rows: SalaryTableMatrixRow[];
}

/**
 * 号俸テーブルマトリクスの行
 */
export interface SalaryTableMatrixRow {
  stepNumber: number;
  rank: string;
  bandNumber?: number;         // 号俸帯番号
  bandDisplayLabel?: string;   // 号俸帯表示ラベル（例: "119〜113"）
  isBandBoundary?: boolean;    // 号俸帯境界（T行）かどうか
  entries: {
    gradeId: string;
    baseSalary: number;
    annualSalary: number;      // 年収（baseSalary * 12）
  }[];
}

/**
 * 号俸テーブルプレビュー（再生成時の差分確認用）
 */
export interface SalaryTablePreviewResponse {
  current: SalaryTableMatrixResponse | null;
  preview: SalaryTableMatrixResponse;
  changes: SalaryTableChange[];
}

/**
 * 号俸テーブル変更内容
 */
export interface SalaryTableChange {
  gradeId: string;
  gradeName: string;
  stepNumber: number;
  rank: string;
  currentBaseSalary: number | null;
  newBaseSalary: number;
  difference: number;
}

// ============================================
// Employee Salary Matching Types
// ============================================

/**
 * 従業員の号俸当てはめ結果
 */
export interface EmployeeSalaryMatch {
  employeeId: string;
  employeeName: string;
  gradeId: string;
  gradeName: string;
  currentBaseSalary: number;
  matchedStep: number | null;
  matchedRank: string | null;
  tableBaseSalary: number | null;
  difference: number | null;
  status: SalaryMatchStatus;
}

/**
 * 号俸当てはめステータス
 */
export type SalaryMatchStatus =
  | 'EXACT_MATCH'      // 完全一致
  | 'APPROXIMATE'      // 近似（差分あり）
  | 'OUT_OF_RANGE'     // レンジ外
  | 'GRADE_MISMATCH'   // 等級と給与のミスマッチ
  | 'NOT_ASSIGNED';    // 等級未割当

export const SalaryMatchStatusLabels: Record<SalaryMatchStatus, string> = {
  EXACT_MATCH: '一致',
  APPROXIMATE: '近似',
  OUT_OF_RANGE: 'レンジ外',
  GRADE_MISMATCH: '等級ミスマッチ',
  NOT_ASSIGNED: '未割当',
};

/**
 * 従業員号俸当てはめ一覧レスポンス
 */
export interface EmployeeSalaryMatchListResponse {
  matches: EmployeeSalaryMatch[];
  summary: {
    total: number;
    exactMatch: number;
    approximate: number;
    outOfRange: number;
    gradeMismatch: number;
    notAssigned: number;
  };
}

// ============================================
// Salary Simulation Types
// ============================================

/**
 * 昇給シミュレーションパラメータ
 */
export interface SalarySimulationParams {
  salaryTableId: string;
  employeeId?: string;  // 指定しない場合は全従業員
  rating: 'S' | 'A' | 'B' | 'C' | 'D';
}

/**
 * 昇給シミュレーション結果
 */
export interface SalarySimulationResult {
  employeeId: string;
  employeeName: string;
  currentStep: number;
  currentRank: string;
  currentBaseSalary: number;
  newStep: number;
  newRank: string;
  newBaseSalary: number;
  stepChange: number;
  salaryChange: number;
  salaryChangePercent: number;
}

/**
 * 昇給シミュレーション一覧レスポンス
 */
export interface SalarySimulationListResponse {
  results: SalarySimulationResult[];
  summary: {
    totalEmployees: number;
    totalCurrentSalary: number;
    totalNewSalary: number;
    totalChange: number;
    averageChangePercent: number;
  };
}

// ============================================
// Query Types
// ============================================

/**
 * 号俸テーブル検索クエリ
 */
export interface SalaryTableSearchQuery {
  companyId: string;
  isActive?: boolean;
}

// ============================================
// UI Types
// ============================================

/**
 * ランク選択オプション
 */
export interface RankOption {
  value: string;
  label: string;
  zone: 'S' | 'A' | 'B' | 'C' | 'D';
}

/**
 * ゾーンの定義
 */
export interface SalaryZone {
  name: 'S' | 'A' | 'B' | 'C' | 'D';
  label: string;
  ranks: string[];
  minStep: number;
  maxStep: number;
}

/**
 * 号俸帯情報（UI表示用）
 */
export interface SalaryBandDisplayInfo {
  bandNumber: number;          // 号俸帯番号（1が最下位）
  displayLabel: string;        // 表示用ラベル（例: "119〜113" or "120"）
  stepDiff: number;            // この号俸帯の号差
  startStep: number;           // 開始号俸番号
  endStep: number;             // 終了号俸番号
}

/**
 * 基本給テーブル（右側マトリクス）のセル
 */
export interface BaseSalaryTableCell {
  gradeId: string;
  gradeName: string;
  rank: string;
  baseSalary: number;
  annualSalary: number;
}

/**
 * 基本給テーブル（右側マトリクス）
 */
export interface BaseSalaryTableMatrix {
  grades: {
    id: string;
    name: string;
    level: number;
    maxSalary: number;
    minSalary: number;
  }[];
  rows: {
    rank: string;
    zone: string;
    cells: BaseSalaryTableCell[];
  }[];
}
