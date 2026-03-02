import {
  Clock,
  ClipboardCheck,
  Send,
  Download,
  BarChart2,
  CheckCircle2,
} from "lucide-react"
import { type EvalStatus } from "../StatusIndicator"

// 評価詳細の型
export interface EvaluationDetail {
  id: string
  employeeId: string
  evaluationTemplateId: string
  evaluationType: string
  status: EvalStatus
  totalScore: number | null
  finalRating: "S" | "A" | "B" | "C" | "D" | null
  evaluatorComment: string | null
  selfComment: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
    grade: { id: string; name: string } | null
    jobType: { id: string; name: string } | null
    department: { id: string; name: string } | null
  }
  templateName: string
  items: EvaluationItem[]
}

export interface EvaluationItem {
  id: string
  name: string
  description: string | null
  category: string
  maxScore: number
  weight: number
  sortOrder: number
  selfScore: number | null
  evaluatorScore: number | null
  comment: string | null
  evaluationItemId: string | null
}

export interface ScoreData {
  selfScore: number | null
  evaluatorScore: number | null
  comment: string
}

// 詳細ステータス設定（ページ用）
export const individualStatusConfig: Record<EvalStatus, {
  label: string
  description: string
  color: string
  bgColor: string
  icon: typeof Clock
  step: number
}> = {
  STARTED: {
    label: "開始",
    description: "評価を開始しました",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    icon: Clock,
    step: 1,
  },
  PREPARING: {
    label: "配布準備",
    description: "評価シートを準備中です",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    icon: ClipboardCheck,
    step: 2,
  },
  DISTRIBUTED: {
    label: "配布完了",
    description: "従業員に配布済み。自己評価を待っています",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    icon: Send,
    step: 3,
  },
  COLLECTED: {
    label: "回収済み",
    description: "自己評価を回収しました。上司評価を行ってください",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    icon: Download,
    step: 4,
  },
  AGGREGATING: {
    label: "集計",
    description: "評価を集計中です",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    icon: BarChart2,
    step: 5,
  },
  COMPLETED: {
    label: "完了",
    description: "評価が完了しました",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    icon: CheckCircle2,
    step: 6,
  },
}

// ステップ定義
export const individualSteps: { key: EvalStatus; label: string }[] = [
  { key: "STARTED", label: "開始" },
  { key: "PREPARING", label: "準備" },
  { key: "DISTRIBUTED", label: "配布" },
  { key: "COLLECTED", label: "回収" },
  { key: "AGGREGATING", label: "集計" },
  { key: "COMPLETED", label: "完了" },
]

// 評価レート設定
export const ratingConfig: Record<string, { label: string; color: string }> = {
  S: { label: "S（非常に優秀）", color: "bg-purple-100 text-purple-800" },
  A: { label: "A（優秀）", color: "bg-blue-100 text-blue-800" },
  B: { label: "B（標準）", color: "bg-green-100 text-green-800" },
  C: { label: "C（要改善）", color: "bg-yellow-100 text-yellow-800" },
  D: { label: "D（不十分）", color: "bg-red-100 text-red-800" },
}

// ステータス遷移ヘルパー
export const getNextStatus = (current: EvalStatus): EvalStatus | null => {
  const order: EvalStatus[] = ["STARTED", "PREPARING", "DISTRIBUTED", "COLLECTED", "AGGREGATING", "COMPLETED"]
  const idx = order.indexOf(current)
  return idx < order.length - 1 ? order[idx + 1] : null
}

export const getPrevStatus = (current: EvalStatus): EvalStatus | null => {
  const order: EvalStatus[] = ["STARTED", "PREPARING", "DISTRIBUTED", "COLLECTED", "AGGREGATING", "COMPLETED"]
  const idx = order.indexOf(current)
  return idx > 0 ? order[idx - 1] : null
}
