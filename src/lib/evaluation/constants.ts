// 評価制度関連の定数・UIテキスト

export const EVALUATION_UI_TEXT = {
  // ページタイトル
  PAGE_TITLE: "評価制度",
  EVALUATION_PERIODS: "評価期間",
  INDIVIDUAL_EVALUATION: "個別評価",
  EVALUATION_360: "360度評価",
  EVALUATION_CRITERIA: "評価基準",
  ADJUSTMENT_RULES: "号俸改定基準",
  EVALUATION_ITEMS: "評価項目",

  // ボタン・操作
  CREATE: "作成",
  EDIT: "編集",
  DELETE: "削除",
  SAVE: "保存",
  CANCEL: "キャンセル",
  SUBMIT: "提出",
  CLOSE: "閉じる",
  BACK: "戻る",

  // フィールド名
  PERIOD_NAME: "評価期間名",
  PERIOD_TYPE: "期種別",
  START_DATE: "開始日",
  END_DATE: "終了日",
  STATUS: "ステータス",
  EVALUATEE: "被評価者",
  EVALUATOR: "評価者",
  SELF_EVALUATION: "自己評価",
  SUPERVISOR_EVALUATION: "上司評価",
  SCORE: "スコア",
  COMMENT: "コメント",
  TOTAL_SCORE: "合計得点",
  AVERAGE_SCORE: "平均得点",
  FINAL_RATING: "最終評価",
  FEEDBACK: "フィードバック",
  CATEGORY: "カテゴリ",
  WEIGHT: "重み",
  ITEM_NAME: "項目名",
  DESCRIPTION: "説明",

  // 期種別
  FIRST_HALF: "上期",
  SECOND_HALF: "下期",

  // ステータス
  NOT_STARTED: "未開始",
  IN_PROGRESS: "評価中",
  COMPLETED: "完了",
  FEEDBACK_DONE: "フィードバック済",

  // 評価レート
  RATING_S: "S",
  RATING_A: "A",
  RATING_B: "B",
  RATING_C: "C",
  RATING_D: "D",

  // その他
  LOADING: "読み込み中...",
  NO_DATA: "データがありません",
  CONFIRM_DELETE: "削除してもよろしいですか？",
  DELETE_SUCCESS: "削除しました",
  SAVE_SUCCESS: "保存しました",
  ERROR_OCCURRED: "エラーが発生しました",
  SELECT_PLACEHOLDER: "選択してください",
  NO_EVALUATORS: "評価者が設定されていません",
  ASSIGNMENT_COMPLETE: "評価者割当完了",
  INPUT_COMPLETE: "入力完了",
  RESULT: "結果",
} as const

// 評価スコア選択肢
export const EVALUATION_SCORE_OPTIONS = [
  { value: 5, label: "5点：非常に良い（常に達成）" },
  { value: 4, label: "4点：良い（概ね達成）" },
  { value: 3, label: "3点：普通（一部達成）" },
  { value: 1, label: "1点：やや不十分（十分ではない）" },
  { value: 0, label: "0点：不十分（達成できていない）" },
] as const

// 評価スコアの詳細説明
export const EVALUATION_SCORE_DESCRIPTIONS: Record<number, { short: string; long: string }> = {
  5: { short: "非常に良い", long: "常に達成" },
  4: { short: "良い", long: "概ね達成" },
  3: { short: "普通", long: "一部達成" },
  1: { short: "やや不十分", long: "十分ではない" },
  0: { short: "不十分", long: "達成できていない" },
}

// 期種別オプション
export const PERIOD_TYPE_OPTIONS = [
  { value: "FIRST_HALF", label: "上期" },
  { value: "SECOND_HALF", label: "下期" },
] as const

// ステータスオプション
export const EVALUATION_STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "未開始" },
  { value: "IN_PROGRESS", label: "評価中" },
  { value: "COMPLETED", label: "完了" },
  { value: "FEEDBACK_DONE", label: "フィードバック済" },
] as const

// 評価レートオプション
export const EVALUATION_RATING_OPTIONS = [
  { value: "S", label: "S" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "D", label: "D" },
] as const

// 360度評価の評価者順序
export const EVALUATOR_ORDER_LABELS: Record<number, string> = {
  1: "評価者1",
  2: "評価者2",
  3: "評価者3",
  4: "評価者4",
}

// 評価カテゴリ（プリセット）
export const EVALUATION_CATEGORIES = [
  "計画・管理",
  "安全への取り組み",
  "技術・スキル",
  "コミュニケーション",
  "チームワーク",
  "問題解決",
  "責任感",
  "勤務態度",
] as const

export type EvaluationRating = "S" | "A" | "B" | "C" | "D"
export type PeriodType = "FIRST_HALF" | "SECOND_HALF"
export type EvaluationStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FEEDBACK_DONE"
