// 等級制度関連の定数・UIテキスト

export const GRADE_UI_TEXT = {
  // ページタイトル
  PAGE_TITLE: "等級制度管理",

  // 一覧・操作
  GRADE_LIST: "等級一覧",
  CREATE_GRADE: "等級を作成",
  EDIT: "編集",
  DELETE: "削除",
  SAVE: "保存",
  CANCEL: "キャンセル",

  // フィールド名
  GRADE_NAME: "等級名",
  LEVEL: "レベル",
  EMPLOYMENT_TYPE: "雇用形態",
  IS_MANAGEMENT: "管理職",

  // マトリクス・役割
  MATRIX_SETTINGS: "等級×職種マトリクス",
  ROLE_RESPONSIBILITY: "役割責任",
  ENABLED: "有効",
  DISABLED: "無効",
  EMPLOYEES: "該当者",
  POSITION_NAME: "役職名",
  RESPONSIBILITY_CONTENT: "責任内容",
  ADD_ITEM: "項目を追加",

  // その他
  LOADING: "読み込み中...",
  NO_DATA: "データがありません",
  CONFIRM_DELETE: "この等級を削除してもよろしいですか？",
  DELETE_SUCCESS: "等級を削除しました",
  SAVE_SUCCESS: "保存しました",
  ERROR_OCCURRED: "エラーが発生しました",
} as const

export const EMPLOYMENT_TYPE_LABELS = {
  FULL_TIME: "正社員",
  CONTRACT: "契約社員",
  OUTSOURCE: "業務委託",
  PART_TIME: "パート",
} as const

export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "FULL_TIME", label: "正社員" },
  { value: "CONTRACT", label: "契約社員" },
  { value: "OUTSOURCE", label: "業務委託" },
  { value: "PART_TIME", label: "パート" },
] as const
