/**
 * 会社管理機能のバリデーションスキーマ
 */

import { z } from 'zod';

// 会社作成・更新用スキーマ
export const companySchema = z.object({
  name: z.string().min(1, '会社名は必須です').max(200, '会社名は200文字以内で入力してください'),
  address: z.string().max(500, '住所は500文字以内で入力してください').optional().nullable(),
  representative: z.string().max(100, '代表者名は100文字以内で入力してください').optional().nullable(),
  establishedDate: z.string().optional().nullable(),
  businessDescription: z.string().max(2000, '事業内容は2000文字以内で入力してください').optional().nullable(),
});

export type CompanyFormData = z.infer<typeof companySchema>;
export type CompanyFormInput = z.input<typeof companySchema>;

// 部署作成・更新用スキーマ
export const departmentSchema = z.object({
  name: z.string().min(1, '部署名は必須です').max(100, '部署名は100文字以内で入力してください'),
  parentId: z.string().optional().nullable(),
});

export type DepartmentFormData = z.infer<typeof departmentSchema>;

// 役職作成・更新用スキーマ
export const positionSchema = z.object({
  name: z.string().min(1, '役職名は必須です').max(100, '役職名は100文字以内で入力してください'),
});

export type PositionFormData = z.infer<typeof positionSchema>;

// 職種大分類作成・更新用スキーマ
export const jobCategorySchema = z.object({
  name: z.string().min(1, '職種大分類名は必須です').max(100, '職種大分類名は100文字以内で入力してください'),
});

export type JobCategoryFormData = z.infer<typeof jobCategorySchema>;

// 職種小分類作成・更新用スキーマ
export const jobTypeSchema = z.object({
  name: z.string().min(1, '職種小分類名は必須です').max(100, '職種小分類名は100文字以内で入力してください'),
  jobCategoryId: z.string().min(1, '職種大分類を選択してください'),
});

export type JobTypeFormData = z.infer<typeof jobTypeSchema>;
