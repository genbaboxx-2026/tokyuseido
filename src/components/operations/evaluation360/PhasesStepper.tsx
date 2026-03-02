"use client"

import { CheckCircle2 } from "lucide-react"
import { type Evaluation360Status, steps, getStepFromStatus } from "./Evaluation360Types"

interface PhasesStepperProps {
  currentStatus: Evaluation360Status
}

export function PhasesStepper({ currentStatus }: PhasesStepperProps) {
  const currentStep = getStepFromStatus(currentStatus)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const stepNum = idx + 1
          const isCompleted = stepNum < currentStep
          const isCurrent = stepNum === currentStep
          const isLast = idx === steps.length - 1

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    isCompleted
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                      ? "bg-blue-500 text-white ring-4 ring-blue-200"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : stepNum}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCurrent ? "text-blue-600" : isCompleted ? "text-emerald-600" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    isCompleted ? "bg-emerald-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
