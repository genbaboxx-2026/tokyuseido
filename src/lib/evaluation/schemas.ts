// 評価制度のバリデーションスキーマ

import { z } from "zod"

// 評価期間
export const evaluationPeriodSchema = z.object({
  companyId: z.string().cuid(),
  name: z.string().min(1, "評価期間名は必須です").max(100, "評価期間名は100文字以内で入力してください"),
  periodType: z.enum(["FIRST_HALF", "SECOND_HALF"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(["STARTED", "PREPARING", "DISTRIBUTED", "COLLECTED", "AGGREGATING", "COMPLETED"]).optional(),
})

export const evaluationPeriodUpdateSchema = evaluationPeriodSchema.partial().omit({ companyId: true })

// 個別評価
export const individualEvaluationCreateSchema = z.object({
  evaluationPeriodId: z.string().cuid(),
  employeeId: z.string().cuid(),
  evaluatorId: z.string().cuid(),
})

export const individualEvaluationUpdateSchema = z.object({
  status: z.enum(["STARTED", "PREPARING", "DISTRIBUTED", "COLLECTED", "AGGREGATING", "COMPLETED"]).optional(),
  totalScore: z.number().min(0).max(5).optional().nullable(),
  finalRating: z.enum(["S", "A", "B", "C", "D"]).optional().nullable(),
})

// 評価スコア
export const evaluationScoreSchema = z.object({
  individualEvaluationId: z.string().cuid(),
  evaluationItemId: z.string().cuid(),
  selfScore: z.number().int().min(0).max(5).optional().nullable(),
  evaluatorScore: z.number().int().min(0).max(5).optional().nullable(),
  comment: z.string().max(1000, "コメントは1000文字以内で入力してください").optional().nullable(),
})

export const evaluationScoreUpdateSchema = evaluationScoreSchema.partial().omit({
  individualEvaluationId: true,
  evaluationItemId: true,
})

// 評価項目
export const evaluationItemCreateSchema = z.object({
  name: z.string().min(1, "項目名は必須です").max(200, "項目名は200文字以内で入力してください"),
  description: z.string().max(1000, "説明は1000文字以内で入力してください").optional().nullable(),
  category: z.string().min(1, "カテゴリは必須です").max(100),
  weight: z.number().min(0).max(10).optional().nullable(),
  gradeJobTypeConfigId: z.string().cuid().optional().nullable(),
})

export const evaluationItemUpdateSchema = evaluationItemCreateSchema.partial()

// 360度評価
export const evaluation360CreateSchema = z.object({
  evaluationPeriodId: z.string().cuid(),
  employeeId: z.string().cuid(),
})

export const evaluation360UpdateSchema = z.object({
  status: z.enum(["STARTED", "PREPARING", "DISTRIBUTED", "COLLECTED", "AGGREGATING", "COMPLETED"]).optional(),
  averageScore: z.number().min(0).max(5).optional().nullable(),
  feedback: z.string().max(2000, "フィードバックは2000文字以内で入力してください").optional().nullable(),
})

// 評価者割当
export const evaluatorAssignmentSchema = z.object({
  evaluation360Id: z.string().cuid(),
  evaluatorId: z.string().cuid(),
  order: z.number().int().min(1).max(4),
})

export const evaluatorAssignmentsSchema = z.array(evaluatorAssignmentSchema)

// 360度評価スコア
export const evaluation360ScoreSchema = z.object({
  evaluation360Id: z.string().cuid(),
  evaluatorAssignmentId: z.string().cuid(),
  evaluationItemId: z.string().cuid(),
  score: z.number().int().min(0).max(5),
  comment: z.string().max(1000, "コメントは1000文字以内で入力してください").optional().nullable(),
})

export const evaluation360ScoresSchema = z.array(evaluation360ScoreSchema)

// 評価基準
export const evaluationCriteriaSchema = z.object({
  companyId: z.string().cuid(),
  firstHalfRating: z.enum(["S", "A", "B", "C", "D"]),
  secondHalfRating: z.enum(["S", "A", "B", "C", "D"]),
  finalRating: z.enum(["S", "A", "B", "C", "D"]),
})

export const evaluationCriteriaArraySchema = z.array(evaluationCriteriaSchema)

// 号俸改定ルール
export const gradeAdjustmentRuleSchema = z.object({
  gradeId: z.string().cuid(),
  currentRank: z.string().min(1).max(10),
  rating: z.enum(["S", "A", "B", "C", "D"]),
  stepAdjustment: z.number().int().min(-10).max(10),
})

export const gradeAdjustmentRulesSchema = z.array(gradeAdjustmentRuleSchema)

// バルク評価スコア入力
export const bulkEvaluationScoresSchema = z.object({
  individualEvaluationId: z.string().cuid(),
  scores: z.array(
    z.object({
      evaluationItemId: z.string().cuid(),
      selfScore: z.number().int().min(0).max(5).optional().nullable(),
      evaluatorScore: z.number().int().min(0).max(5).optional().nullable(),
      comment: z.string().max(1000).optional().nullable(),
    })
  ),
})

// 型エクスポート
export type EvaluationPeriodInput = z.infer<typeof evaluationPeriodSchema>
export type EvaluationPeriodUpdateInput = z.infer<typeof evaluationPeriodUpdateSchema>
export type IndividualEvaluationCreateInput = z.infer<typeof individualEvaluationCreateSchema>
export type IndividualEvaluationUpdateInput = z.infer<typeof individualEvaluationUpdateSchema>
export type EvaluationScoreInput = z.infer<typeof evaluationScoreSchema>
export type EvaluationItemCreateInput = z.infer<typeof evaluationItemCreateSchema>
export type EvaluationItemUpdateInput = z.infer<typeof evaluationItemUpdateSchema>
export type Evaluation360CreateInput = z.infer<typeof evaluation360CreateSchema>
export type Evaluation360UpdateInput = z.infer<typeof evaluation360UpdateSchema>
export type EvaluatorAssignmentInput = z.infer<typeof evaluatorAssignmentSchema>
export type Evaluation360ScoreInput = z.infer<typeof evaluation360ScoreSchema>
export type EvaluationCriteriaInput = z.infer<typeof evaluationCriteriaSchema>
export type GradeAdjustmentRuleInput = z.infer<typeof gradeAdjustmentRuleSchema>
export type BulkEvaluationScoresInput = z.infer<typeof bulkEvaluationScoresSchema>
