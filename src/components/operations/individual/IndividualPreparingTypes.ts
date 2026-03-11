// IndividualPreparingTab用の型定義

export type Phase = "preparing" | "distributing" | "collected" | "aggregated" | "completed"
export type EvaluationStatus = "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"

export const statusOptions: { value: EvaluationStatus; label: string }[] = [
  { value: "STARTED", label: "開始" },
  { value: "PREPARING", label: "準備中" },
  { value: "DISTRIBUTED", label: "配布済" },
  { value: "COLLECTED", label: "回収済" },
  { value: "AGGREGATING", label: "集計中" },
  { value: "COMPLETED", label: "完了" },
]

export interface EvaluationItem {
  id: string
  selfScore: number | null
  evaluatorScore: number | null
  comment: string | null
  templateItem: {
    id: string
    name: string
    description: string | null
    category: string
    maxScore: number
    weight: number
  } | null
}

export interface Evaluator {
  id: string
  firstName: string
  lastName: string
}

export interface Evaluation {
  id: string
  employeeId: string
  status: EvaluationStatus
  currentPhase: Phase
  detailStep: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    individualEvaluatorId: string | null
    grade: { id: string; name: string } | null
    jobType: { id: string; name: string } | null
    department: { id: string; name: string } | null
  }
  evaluator: Evaluator | null
  evaluatorId: string | null
  template: { id: string; name: string } | null
  hasChangesFromMaster: boolean
  itemStats: {
    total: number
    selfScored: number
    managerScored: number
  }
  items: EvaluationItem[]
}

export interface Employee {
  id: string
  firstName: string
  lastName: string
  department?: { name: string } | null
}

export interface ItemFormData {
  name: string
  description: string
  category: string
  maxScore: number
}

export const defaultItemForm: ItemFormData = {
  name: "",
  description: "",
  category: "一般",
  maxScore: 5,
}
