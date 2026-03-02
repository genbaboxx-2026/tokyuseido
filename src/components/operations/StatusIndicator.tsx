"use client"

import { Clock, Play, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// 6段階ステータス型
export type EvalStatus = "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"

// 評価ステータス設定（6段階）
export const evalStatusConfig: Record<EvalStatus, { label: string; color: string; lightColor: string; icon: typeof Clock; step: number }> = {
  STARTED: { label: "開始", color: "bg-red-500", lightColor: "bg-red-100 text-red-800", icon: Clock, step: 1 },
  PREPARING: { label: "配布準備", color: "bg-red-500", lightColor: "bg-red-100 text-red-800", icon: Clock, step: 2 },
  DISTRIBUTED: { label: "配布完了", color: "bg-yellow-400", lightColor: "bg-yellow-100 text-yellow-800", icon: Play, step: 3 },
  COLLECTED: { label: "回収済み", color: "bg-yellow-400", lightColor: "bg-yellow-100 text-yellow-800", icon: Play, step: 4 },
  AGGREGATING: { label: "集計", color: "bg-yellow-400", lightColor: "bg-yellow-100 text-yellow-800", icon: Play, step: 5 },
  COMPLETED: { label: "完了", color: "bg-green-500", lightColor: "bg-emerald-100 text-emerald-800", icon: CheckCircle2, step: 6 },
}

// 進捗ステップの定義
export const progressSteps: { key: EvalStatus; label: string; shortLabel: string }[] = [
  { key: "STARTED", label: "開始", shortLabel: "開始" },
  { key: "PREPARING", label: "配布準備", shortLabel: "準備" },
  { key: "DISTRIBUTED", label: "配布完了", shortLabel: "配布" },
  { key: "COLLECTED", label: "回収済み", shortLabel: "回収" },
  { key: "AGGREGATING", label: "集計", shortLabel: "集計" },
  { key: "COMPLETED", label: "完了", shortLabel: "完了" },
]

interface StatusIndicatorProps {
  status: EvalStatus
  onStatusChange?: (evaluationId: string, newStatus: EvalStatus) => void
  evaluationId?: string
}

// Uber Eats風プログレスインジケーター
export function StatusIndicator({
  status,
  onStatusChange,
  evaluationId
}: StatusIndicatorProps) {
  const currentStep = evalStatusConfig[status].step

  const handleClick = (clickedStatus: EvalStatus) => {
    if (onStatusChange && evaluationId) {
      onStatusChange(evaluationId, clickedStatus)
    }
  }

  const getCircleColor = (stepNum: number, isCompleted: boolean, isCurrent: boolean) => {
    // 全部完了（ステータスがCOMPLETED）の場合は緑
    if (currentStep === 6 && (isCompleted || isCurrent)) {
      return "bg-emerald-500 text-white"
    }
    // 完了したステップは青
    if (isCompleted) {
      return "bg-blue-500 text-white"
    }
    // 現在実施中は黄
    if (isCurrent) {
      return "bg-amber-400 text-amber-900"
    }
    // 未完了はグレー
    return "bg-gray-100 text-gray-400 border border-gray-300"
  }

  return (
    <div className="flex items-center w-full max-w-sm mx-auto">
      {progressSteps.map((step, idx) => {
        const stepNum = idx + 1
        const isCompleted = stepNum < currentStep
        const isCurrent = stepNum === currentStep
        const isClickable = !!onStatusChange && !!evaluationId

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* 丸（文言入り） */}
            <div
              onClick={() => isClickable && handleClick(step.key)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-medium transition-all shrink-0 ${
                getCircleColor(stepNum, isCompleted, isCurrent)
              } ${isClickable ? "cursor-pointer hover:scale-110 hover:shadow-md" : ""}`}
            >
              {step.shortLabel}
            </div>
            {/* 線（最後以外） */}
            {idx < progressSteps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-0.5 ${
                  currentStep === 6
                    ? "bg-emerald-500"
                    : isCompleted
                    ? "bg-blue-500"
                    : "bg-gray-200"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ステータスバッジコンポーネント
export function StatusBadge({ status }: { status: EvalStatus }) {
  const config = evalStatusConfig[status]
  return (
    <Badge className={config.lightColor}>
      {config.label}
    </Badge>
  )
}
