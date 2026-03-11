import type { EvaluationRating } from "@/generated/prisma"

export type ResultStatus = "DRAFT" | "CONFIRMED" | "REVERTED"

export interface EvaluationResultData {
  id: string
  employeeId: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    grade: { id: string; name: string; level: number } | null
    jobType: { id: string; name: string } | null
    department: { id: string; name: string } | null
  }
  score360Raw: number | null
  score360Max: number | null
  scoreIndividualRaw: number | null
  scoreIndividualMax: number | null
  ratio360: number | null
  ratioIndividual: number | null
  combinedScore: number
  periodRank: EvaluationRating
  previousPeriodRank: EvaluationRating | null
  annualRank: EvaluationRating
  previousStep: number | null
  previousRank: string | null
  previousBaseSalary: number | null
  stepAdjustment: number
  newStep: number | null
  newRank: string | null
  newBaseSalary: number | null
  status: ResultStatus
  warnings: string[]
}

export interface FinalizeSummary {
  totalEmployees: number
  rankDistribution: Record<EvaluationRating, number>
  stepChanges: { up: number; same: number; down: number }
  monthlyCostImpact: number
  annualCostImpact: number
  missingAdjustmentRules: number
  missingStepEmployees: number
}

export interface GenerateFinalizeResponse {
  results: EvaluationResultData[]
  summary: FinalizeSummary
}

export interface ConfirmFinalizeResponse {
  success: boolean
  confirmedAt: string
  updatedEmployees: number
  skippedEmployees: number
}
