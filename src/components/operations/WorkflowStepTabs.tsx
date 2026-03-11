"use client"

import { cn } from "@/lib/utils"

export interface WorkflowStep {
  value: string
  label: string
  count: number
}

interface WorkflowStepTabsProps {
  steps: WorkflowStep[]
  activeStep: string
  onStepChange: (value: string) => void
  disabled?: boolean
}

export function WorkflowStepTabs({
  steps,
  activeStep,
  onStepChange,
  disabled = false,
}: WorkflowStepTabsProps) {
  const activeIndex = steps.findIndex((s) => s.value === activeStep)

  return (
    <div className="flex items-stretch w-full h-11">
      {steps.map((step, index) => {
        const isActive = index === activeIndex
        const isPast = index < activeIndex
        const isFirst = index === 0
        const isLast = index === steps.length - 1

        // disabled時は、アクティブなステップ以外はクリック不可
        const isClickable = !disabled || isActive

        return (
          <button
            key={step.value}
            type="button"
            onClick={() => {
              if (isClickable) {
                onStepChange(step.value)
              }
            }}
            disabled={!isClickable}
            className={cn(
              "relative flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:z-10",
              isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-70"
            )}
            style={{ zIndex: steps.length - index }}
          >
            <svg
              viewBox="0 0 200 44"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full"
            >
              <path
                d={
                  isFirst
                    ? "M0,0 L180,0 L200,22 L180,44 L0,44 Z"
                    : isLast
                      ? "M0,0 L200,0 L200,44 L0,44 L20,22 Z"
                      : "M0,0 L180,0 L200,22 L180,44 L0,44 L20,22 Z"
                }
                className={cn(
                  "transition-colors",
                  isActive
                    ? "fill-sky-500"
                    : isPast
                      ? "fill-sky-300"
                      : "fill-sky-100 dark:fill-sky-950"
                )}
              />
            </svg>
            <span
              className={cn(
                "relative z-[1] flex items-center justify-center h-full text-sm font-bold tracking-wide",
                isActive
                  ? "text-white"
                  : isPast
                    ? "text-white"
                    : "text-sky-400 dark:text-sky-500"
              )}
            >
              {step.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
