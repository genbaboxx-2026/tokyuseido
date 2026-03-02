/**
 * 号俸テーブル関連の定数・バリデーションスキーマ・エクスポート
 *
 * 【用語定義】
 * - ランク: S1, S2, A1, A2, B1... D8 などの評価ランク
 * - 号俸帯: 号俸の範囲グループ（旧「15T」「15」「14T」「14」など）
 * - 号俸帯数: 号俸帯をいくつ作るか（例: 15）
 * - 号俸帯内ステップ数: 各号俸帯を何段階に分けるか（例: 8）
 * - 号俸帯間増加率: 号俸帯が上がるごとに号差を何倍にするか（例: 1.05）
 * - 等級: 正①〜正⑥
 */

import { z } from "zod"

// ============================================
// 定数
// ============================================

/**
 * 号俸テーブルUI テキスト
 */
export const SALARY_TABLE_UI_TEXT = {
  // ページタイトル
  PAGE_TITLE: "号俸テーブル設定",
  TABLE_VIEW_TITLE: "テーブル確認",
  EMPLOYEE_MAPPING_TITLE: "従業員当てはめ",

  // パラメータラベル
  BASE_SALARY_MAX: "基本給（MAX）",
  BASE_SALARY_MIN: "基本給（MIN）",
  STEPS_PER_BAND: "号俸帯内ステップ数",
  BAND_INCREASE_RATE: "号俸帯間増加率",
  INITIAL_STEP_DIFF: "初期号差",
  SALARY_BAND_COUNT: "号俸帯数",
  TABLE_NAME: "テーブル名",

  // 説明テキスト
  BASE_SALARY_MAX_DESC: "最上位号俸の基本給（目標値）",
  BASE_SALARY_MIN_DESC: "最下位号俸の基本給（号俸1の基本給）",
  INITIAL_STEP_DIFF_DESC: "最下位号俸帯の号差（円）",
  BAND_INCREASE_RATE_DESC: "号俸帯が上がるごとに号差を何倍にするか（例: 1.05 = 5%増加）",
  STEPS_PER_BAND_DESC: "各号俸帯内の段階数（例: 8 → S1〜S8）",
  SALARY_BAND_COUNT_DESC: "全体の号俸帯数（例: 15）",

  // 操作
  SAVE: "保存",
  CANCEL: "キャンセル",
  PREVIEW: "プレビュー",
  GENERATE: "テーブル生成",
  CONFIRM: "確定",
  REGENERATE: "再生成",

  // テーブル表示
  STEP_NUMBER: "号俸",
  SALARY_BAND: "号俸帯",
  RANK: "ランク",
  BASE_SALARY: "基本給/月",
  STEP_DIFF: "号差",
  INCREASE_AMOUNT: "増加額",
  INCREASE_RATE_ACTUAL: "増加率",
  ANNUAL_SALARY: "年収",
  GRADE: "等級",

  // 従業員当てはめ
  EMPLOYEE: "従業員",
  CURRENT_SALARY: "現在の基本給",
  TABLE_POSITION: "テーブル上の位置",
  DIFFERENCE: "差額",
  STATUS: "ステータス",

  // ミスマッチ
  MISMATCH: "ミスマッチ",
  MISMATCH_ALERT: "等級と給与のミスマッチがあります",
  MISMATCH_ABOVE: "上限超過",
  MISMATCH_BELOW: "下限未満",

  // プレビュー
  PREVIEW_TITLE: "変更プレビュー",
  CURRENT: "変更前",
  NEW: "変更後",
  CHANGE: "変更",

  // ステータス
  EXACT_MATCH: "一致",
  APPROXIMATE: "近似",
  OUT_OF_RANGE: "レンジ外",
  GRADE_MISMATCH: "等級ミスマッチ",
  NOT_ASSIGNED: "未割当",

  // その他
  LOADING: "読み込み中...",
  NO_DATA: "データがありません",
  NO_GRADES: "等級が設定されていません",
  NO_EMPLOYEES: "従業員がいません",
  SAVE_SUCCESS: "保存しました",
  GENERATE_SUCCESS: "号俸テーブルを生成しました",
  ERROR_OCCURRED: "エラーが発生しました",
  CONFIRM_REGENERATE: "テーブルを再生成すると、既存のエントリが全て置き換えられます。続行しますか？",
  YEN: "円",
  MONTHLY: "/月",
  ANNUALLY: "/年",
  CALCULATED_MAX: "計算結果",
  MAX_DIFF_WARNING: "計算結果のMAXが入力値と異なります",

  // ランク範囲設定
  RANK_RANGE: "ランク範囲",
  RANK_START_LETTER: "開始ランク",
  RANK_END_LETTER: "終了ランク",

  // 等級別設定
  GRADE_SETTINGS: "等級別設定",
  GRADE_OVERRIDE: "等級別オーバーライド",
  AUTO_CALCULATE: "自動計算",
  MANUAL_SETTING: "手動設定",

  // ゾーン表示
  ZONE_DISPLAY: "ゾーン表示",
  SHOW_ZONE_BOUNDARIES: "ゾーン境界を表示",

  // 総号俸数
  TOTAL_STEPS: "総号俸数",

  // 基本給テーブル（右側マトリクス）
  BASE_SALARY_TABLE: "基本給テーブル",
  MAX_ROW: "max",
  MIN_ROW: "min",
} as const

/**
 * 号俸テーブルデフォルト値
 */
export const SALARY_TABLE_DEFAULTS = {
  baseSalaryMax: 500000,
  baseSalaryMin: 180000,
  initialStepDiff: 1900,
  bandIncreaseRate: 1.05,
  stepsPerBand: 8,
  salaryBandCount: 15,
} as const

/**
 * 号俸テーブルの制限値
 */
export const SALARY_TABLE_LIMITS = {
  baseSalaryMax: { min: 100000, max: 2000000 },
  baseSalaryMin: { min: 50000, max: 1000000 },
  initialStepDiff: { min: 500, max: 50000 },
  bandIncreaseRate: { min: 1.01, max: 1.20 },
  stepsPerBand: { min: 1, max: 20 },
  salaryBandCount: { min: 5, max: 50 },
} as const

/**
 * ゾーン定義
 */
export const SALARY_ZONES = [
  { name: "S", label: "Sゾーン", description: "最上位" },
  { name: "A", label: "Aゾーン", description: "上位" },
  { name: "B", label: "Bゾーン", description: "中位" },
  { name: "C", label: "Cゾーン", description: "下位" },
  { name: "D", label: "Dゾーン", description: "最下位" },
  { name: "E", label: "Eゾーン", description: "下位" },
  { name: "F", label: "Fゾーン", description: "最下位" },
] as const

/**
 * ランク文字オプション
 */
export const RANK_LETTER_OPTIONS = [
  { value: "S", label: "S" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "D", label: "D" },
  { value: "E", label: "E" },
  { value: "F", label: "F" },
] as const

// ============================================
// Zodスキーマ
// ============================================

/**
 * 等級別オーバーライドスキーマ
 */
export const gradeOverrideSchema = z.object({
  gradeId: z.string(),
  maxSalary: z.number().optional(),
  minSalary: z.number().optional(),
})

export type GradeOverrideData = z.infer<typeof gradeOverrideSchema>

/**
 * 号俸テーブル作成/更新スキーマ（新ロジック）
 *
 * 入力パラメータ（5つ）:
 * 1. baseSalaryMin - 基本給MIN（ユーザー入力）
 * 2. initialStepDiff - 初期号差
 * 3. bandIncreaseRate - 号俸帯間増加率
 * 4. stepsPerBand - 号俸帯内ステップ数
 * 5. salaryBandCount - 号俸帯数
 *
 * baseSalaryMax は上記パラメータから自動計算される
 */
export const salaryTableFormSchema = z.object({
  companyId: z.string().min(1, "会社IDは必須です"),
  name: z.string().max(100, "テーブル名は100文字以内で入力してください").optional().default(""),
  baseSalaryMax: z.number().optional(), // 自動計算（フォームから送信時に設定）
  baseSalaryMin: z
    .number()
    .min(SALARY_TABLE_LIMITS.baseSalaryMin.min, `基本給（MIN）は${SALARY_TABLE_LIMITS.baseSalaryMin.min.toLocaleString()}円以上で入力してください`)
    .max(SALARY_TABLE_LIMITS.baseSalaryMin.max, `基本給（MIN）は${SALARY_TABLE_LIMITS.baseSalaryMin.max.toLocaleString()}円以下で入力してください`),
  initialStepDiff: z
    .number()
    .int("初期号差は整数で入力してください")
    .min(SALARY_TABLE_LIMITS.initialStepDiff.min, `初期号差は${SALARY_TABLE_LIMITS.initialStepDiff.min.toLocaleString()}円以上で入力してください`)
    .max(SALARY_TABLE_LIMITS.initialStepDiff.max, `初期号差は${SALARY_TABLE_LIMITS.initialStepDiff.max.toLocaleString()}円以下で入力してください`),
  bandIncreaseRate: z
    .number()
    .min(SALARY_TABLE_LIMITS.bandIncreaseRate.min, `号俸帯間増加率は${SALARY_TABLE_LIMITS.bandIncreaseRate.min}以上で入力してください`)
    .max(SALARY_TABLE_LIMITS.bandIncreaseRate.max, `号俸帯間増加率は${SALARY_TABLE_LIMITS.bandIncreaseRate.max}以下で入力してください`),
  stepsPerBand: z
    .number()
    .int("号俸帯内ステップ数は整数で入力してください")
    .min(SALARY_TABLE_LIMITS.stepsPerBand.min, `号俸帯内ステップ数は${SALARY_TABLE_LIMITS.stepsPerBand.min}以上で入力してください`)
    .max(SALARY_TABLE_LIMITS.stepsPerBand.max, `号俸帯内ステップ数は${SALARY_TABLE_LIMITS.stepsPerBand.max}以下で入力してください`),
  salaryBandCount: z
    .number()
    .int("号俸帯数は整数で入力してください")
    .min(SALARY_TABLE_LIMITS.salaryBandCount.min, `号俸帯数は${SALARY_TABLE_LIMITS.salaryBandCount.min}以上で入力してください`)
    .max(SALARY_TABLE_LIMITS.salaryBandCount.max, `号俸帯数は${SALARY_TABLE_LIMITS.salaryBandCount.max}以下で入力してください`),
  isActive: z.boolean().default(true),
  // ランク範囲設定
  rankStartLetter: z.enum(["S", "A", "B", "C", "D", "E", "F"]).default("S"),
  rankEndLetter: z.enum(["S", "A", "B", "C", "D", "E", "F"]).default("D"),
  // 等級別オーバーライド
  gradeOverrides: z.array(gradeOverrideSchema).optional(),
}).refine((data) => {
  const letterOrder = ["S", "A", "B", "C", "D", "E", "F"]
  return letterOrder.indexOf(data.rankStartLetter) <= letterOrder.indexOf(data.rankEndLetter)
}, {
  message: "開始ランクは終了ランク以前の文字を選択してください",
  path: ["rankEndLetter"],
})

export type SalaryTableFormData = z.infer<typeof salaryTableFormSchema>

/**
 * 号俸テーブル更新スキーマ
 */
export const salaryTableUpdateSchema = z.object({
  name: z.string().min(1, "テーブル名は必須です").max(100, "テーブル名は100文字以内で入力してください").optional(),
  baseSalaryMax: z
    .number()
    .min(SALARY_TABLE_LIMITS.baseSalaryMax.min)
    .max(SALARY_TABLE_LIMITS.baseSalaryMax.max)
    .optional(),
  baseSalaryMin: z
    .number()
    .min(SALARY_TABLE_LIMITS.baseSalaryMin.min)
    .max(SALARY_TABLE_LIMITS.baseSalaryMin.max)
    .optional(),
  initialStepDiff: z
    .number()
    .int()
    .min(SALARY_TABLE_LIMITS.initialStepDiff.min)
    .max(SALARY_TABLE_LIMITS.initialStepDiff.max)
    .optional(),
  bandIncreaseRate: z
    .number()
    .min(SALARY_TABLE_LIMITS.bandIncreaseRate.min)
    .max(SALARY_TABLE_LIMITS.bandIncreaseRate.max)
    .optional(),
  stepsPerBand: z
    .number()
    .int()
    .min(SALARY_TABLE_LIMITS.stepsPerBand.min)
    .max(SALARY_TABLE_LIMITS.stepsPerBand.max)
    .optional(),
  salaryBandCount: z
    .number()
    .int()
    .min(SALARY_TABLE_LIMITS.salaryBandCount.min)
    .max(SALARY_TABLE_LIMITS.salaryBandCount.max)
    .optional(),
  isActive: z.boolean().optional(),
  rankStartLetter: z.enum(["S", "A", "B", "C", "D", "E", "F"]).optional(),
  rankEndLetter: z.enum(["S", "A", "B", "C", "D", "E", "F"]).optional(),
  gradeOverrides: z.array(gradeOverrideSchema).optional(),
})

export type SalaryTableUpdateData = z.infer<typeof salaryTableUpdateSchema>

// ============================================
// エクスポート
// ============================================

export * from "./generator"
