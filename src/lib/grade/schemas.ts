// 等級関連のZodバリデーションスキーマ

import { z } from "zod"

// 等級作成・更新スキーマ
export const gradeFormSchema = z.object({
  name: z.string().min(1, "等級名は必須です").max(50, "等級名は50文字以内で入力してください"),
  level: z.number().int().min(1, "レベルは1以上で入力してください").max(100, "レベルは100以下で入力してください"),
  employmentType: z.enum(["FULL_TIME", "CONTRACT", "OUTSOURCE", "PART_TIME"]),
  isManagement: z.boolean().default(false),
  companyId: z.string().min(1, "会社IDは必須です"),
})

export type GradeFormValues = z.infer<typeof gradeFormSchema>

// 等級×職種設定更新スキーマ
export const gradeJobTypeConfigSchema = z.object({
  gradeId: z.string().min(1, "等級IDは必須です"),
  jobTypeId: z.string().min(1, "職種IDは必須です"),
  isEnabled: z.boolean(),
})

export type GradeJobTypeConfigValues = z.infer<typeof gradeJobTypeConfigSchema>

// マトリクス一括更新スキーマ
export const matrixUpdateSchema = z.object({
  companyId: z.string().min(1, "会社IDは必須です"),
  updates: z.array(gradeJobTypeConfigSchema),
})

export type MatrixUpdateValues = z.infer<typeof matrixUpdateSchema>

// 役割責任スキーマ
export const gradeRoleSchema = z.object({
  gradeJobTypeConfigId: z.string().min(1, "設定IDは必須です"),
  responsibilities: z.array(z.string()).default([]),
  positionNames: z.array(z.string()).default([]),
})

export type GradeRoleValues = z.infer<typeof gradeRoleSchema>

// クエリパラメータスキーマ
export const gradeQuerySchema = z.object({
  companyId: z.string().min(1).optional(),
})
