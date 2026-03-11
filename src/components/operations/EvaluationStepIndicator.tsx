"use client"

import { cn } from "@/lib/utils"
import { CheckCircle2 } from "lucide-react"

interface EvaluationStepIndicatorProps {
  currentStep: 1 | 2
  canProceedToStep2: boolean
  onStepClick?: (step: 1 | 2) => void
}

const steps = [
  { step: 1 as const, label: "評価実行" },
  { step: 2 as const, label: "最終確認・号俸反映" },
]

export function EvaluationStepIndicator({
  currentStep,
  canProceedToStep2,
  onStepClick,
}: EvaluationStepIndicatorProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => {
        const isActive = s.step === currentStep
        const isCompleted = s.step < currentStep
        const isClickable =
          s.step === 1 || (s.step === 2 && canProceedToStep2)

        return (
          <div key={s.step} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => isClickable && onStepClick?.(s.step)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full",
                isActive
                  ? "bg-sky-500 text-white shadow-sm"
                  : isCompleted
                    ? "bg-sky-100 text-sky-700"
                    : isClickable
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : "bg-gray-50 text-gray-400 cursor-not-allowed"
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <span
                  className={cn(
                    "flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold shrink-0",
                    isActive
                      ? "bg-white text-sky-500"
                      : "bg-gray-300 text-white"
                  )}
                >
                  {s.step}
                </span>
              )}
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <div className="w-8 h-px bg-gray-300 shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}
