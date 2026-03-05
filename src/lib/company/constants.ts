/**
 * 会社管理機能の定数定義
 */

// ページタイトル・ラベル
export const COMPANY_LABELS = {
  PAGE_TITLE: '会社管理',
  CREATE_NEW: '新規会社を作成',
  EDIT: '編集',
  DELETE: '削除',
  SAVE: '保存',
  CANCEL: 'キャンセル',
  COMPANY_NAME: '会社名',
  ADDRESS: '住所',
  REPRESENTATIVE: '代表者',
  ESTABLISHED_DATE: '設立日',
  BUSINESS_DESCRIPTION: '事業内容',
  EVALUATION_CYCLE: '評価周期',
  DEPARTMENT: '部署',
  POSITION: '役職',
  JOB_TYPE: '職種',
  LEVEL: 'レベル',
  LOADING: '読み込み中...',
  NO_DATA: 'データがありません',
  CONFIRM_DELETE: '本当に削除しますか？',
  CREATE_SUCCESS: '作成しました',
  UPDATE_SUCCESS: '更新しました',
  DELETE_SUCCESS: '削除しました',
  ERROR_OCCURRED: 'エラーが発生しました',
  ADD: '追加',
  BACK_TO_LIST: '一覧に戻る',
  COMPANY_SETTINGS: '会社設定',
  BASIC_INFO: '基本情報',
  DEPARTMENTS: '部署管理',
  POSITIONS: '役職管理',
  JOB_TYPES: '部署・職種管理',
  PARENT_DEPARTMENT: '親部署',
  NONE: 'なし',
  JOB_CATEGORY: '部署',
  JOB_TYPE_DETAIL: '職種',
  ADD_DEPARTMENT: '部署を追加',
  ADD_POSITION: '役職を追加',
  ADD_JOB_CATEGORY: '部署を追加',
  ADD_JOB_TYPE: '職種を追加',
  REQUIRED: '必須',
  ACTIONS: '操作',
  SALARY_SETTINGS: '給与設定',
  SALARY_REFLECTION_DATE: '号俸反映日',
  SALARY_RAISE_MONTH: '昇給月',
  BONUS_SETTINGS: '賞与設定',
  ADD_BONUS: '賞与を追加',
  ASSESSMENT_PERIOD: '査定対象期間',
  EVALUATION_PERIOD: '評価実施期間',
  PAYMENT_DATE: '支給日',
} as const;

// 評価周期のオプション
export const EVALUATION_CYCLE_OPTIONS = [
  { value: 'HALF_YEARLY', label: '半期' },
  { value: 'YEARLY', label: '年次' },
] as const;

// ページネーション
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
} as const;
