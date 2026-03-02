import { Clock, FileText, Users, Send, Download, BarChart2, CheckCircle2 } from "lucide-react"

// ステータス型
export type Evaluation360Status =
  | "draft"
  | "preparing_items"
  | "preparing_reviewers"
  | "ready"
  | "distributing"
  | "collecting"
  | "aggregated"
  | "completed"

// ステータス設定
export const statusConfig: Record<
  Evaluation360Status,
  {
    label: string
    description: string
    color: string
    bgColor: string
    icon: typeof Clock
    step: number
  }
> = {
  draft: {
    label: "未開始",
    description: "評価をまだ開始していません",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    icon: Clock,
    step: 1,
  },
  preparing_items: {
    label: "項目準備",
    description: "評価項目を準備中です",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    icon: FileText,
    step: 2,
  },
  preparing_reviewers: {
    label: "評価者選定",
    description: "評価者を選定中です",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    icon: Users,
    step: 2,
  },
  ready: {
    label: "配布可能",
    description: "配布の準備が完了しました",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    icon: Send,
    step: 2,
  },
  distributing: {
    label: "配布中",
    description: "評価者が入力中です",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    icon: Send,
    step: 3,
  },
  collecting: {
    label: "回収中",
    description: "一部提出済み、未提出があります",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    icon: Download,
    step: 4,
  },
  aggregated: {
    label: "集計済み",
    description: "評価を集計しました",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    icon: BarChart2,
    step: 5,
  },
  completed: {
    label: "完了",
    description: "評価が確定しました",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    icon: CheckCircle2,
    step: 6,
  },
}

// ステップ定義
export const steps = [
  { key: "start", label: "開始" },
  { key: "prepare", label: "準備" },
  { key: "distribute", label: "配布" },
  { key: "collect", label: "回収" },
  { key: "aggregate", label: "集計" },
  { key: "complete", label: "完了" },
]

export const getStepFromStatus = (status: Evaluation360Status): number => {
  return statusConfig[status].step
}

// カテゴリ型
export type CategoryType = {
  id?: string
  name: string
  sortOrder: number
  description?: string | null
  items: { id?: string; content: string; maxScore: number; sortOrder: number }[]
}

// レコード型
export interface Evaluation360Record {
  id: string
  status: Evaluation360Status
  isAnonymous: boolean
  evaluationMethod: "web" | "paper"
  employee?: {
    id: string
    firstName: string
    lastName: string
    department?: { name: string }
    grade?: { name: string }
    jobType?: { name: string }
  }
  categories?: Array<{
    id: string
    name: string
    sortOrder: number
    description?: string | null
    items: Array<{
      id: string
      content: string
      maxScore: number
      sortOrder: number
    }>
  }>
  reviewerAssignments?: Array<{
    id: string
    reviewerId: string
    status: string
    submittedAt: string | null
    totalLoad?: number
    loadLevel?: string
    reviewer: {
      firstName: string
      lastName: string
      department?: { name: string }
      grade?: { name: string }
    }
  }>
}

// 集計結果型
export interface Evaluation360Summary {
  summary: {
    reviewerCount: number
    totalAvgScore: number
    totalMaxScore: number
    percentage: number
  }
  reviewerSummaries: Array<{
    label: string
    totalScore: number
    maxPossibleScore: number
    percentage: number
  }>
  categories: Array<{
    id: string
    name: string
    avgScore: number
    maxScore: number
    percentage: number
    items: Array<{
      id: string
      content: string
      maxScore: number
      avgScore: number
      scores: Array<{ label: string; score: number }>
    }>
  }>
  highlights: {
    high: Array<{ itemId: string; content: string; avgScore: number; maxScore: number }>
    low: Array<{ itemId: string; content: string; avgScore: number; maxScore: number }>
    highVariance: Array<{ itemId: string; content: string; stdDev: number }>
  }
  comments: Array<{ label: string; comment: string }>
}
