/**
 * 期間固有評価テンプレート関連のビジネスロジック
 */

import { prisma } from "@/lib/prisma"
import type {
  PeriodEvaluationTemplateData,
  PeriodEvaluationTemplateItemData,
} from "@/types/evaluation-template"

/**
 * マスターテンプレートから期間固有テンプレートを作成
 */
export async function createPeriodTemplateFromMaster(
  periodId: string,
  sourceTemplateId: string
): Promise<PeriodEvaluationTemplateData> {
  // マスターテンプレートを取得
  const sourceTemplate = await prisma.evaluationTemplate.findUnique({
    where: { id: sourceTemplateId },
    include: {
      items: {
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      },
      gradeJobTypeConfig: {
        include: {
          grade: { select: { id: true, name: true } },
          jobType: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!sourceTemplate) {
    throw new Error("マスターテンプレートが見つかりません")
  }

  const { gradeJobTypeConfig } = sourceTemplate
  if (!gradeJobTypeConfig) {
    throw new Error("テンプレートに等級・職種設定がありません")
  }

  // 既存の期間固有テンプレートをチェック
  const existing = await prisma.periodEvaluationTemplate.findUnique({
    where: {
      periodId_gradeId_jobTypeId: {
        periodId,
        gradeId: gradeJobTypeConfig.grade.id,
        jobTypeId: gradeJobTypeConfig.jobType.id,
      },
    },
  })

  if (existing) {
    throw new Error("この期間の期間固有テンプレートは既に存在します")
  }

  // 期間固有テンプレートを作成
  const periodTemplate = await prisma.periodEvaluationTemplate.create({
    data: {
      periodId,
      sourceTemplateId: sourceTemplate.id,
      gradeId: gradeJobTypeConfig.grade.id,
      jobTypeId: gradeJobTypeConfig.jobType.id,
      name: sourceTemplate.name,
      description: sourceTemplate.description,
      status: "draft",
      items: {
        create: sourceTemplate.items.map((item) => ({
          sourceItemId: item.id,
          name: item.name,
          description: item.description,
          category: item.category,
          maxScore: item.maxScore,
          weight: item.weight,
          sortOrder: item.sortOrder,
          isAdded: false,
          isDeleted: false,
          isModified: false,
        })),
      },
    },
    include: {
      grade: { select: { id: true, name: true } },
      jobType: { select: { id: true, name: true } },
      sourceTemplate: { select: { id: true, name: true } },
      items: {
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      },
    },
  })

  return formatPeriodTemplate(periodTemplate)
}

/**
 * 期間固有テンプレートを更新
 */
export async function updatePeriodTemplate(
  templateId: string,
  data: {
    name?: string
    description?: string
    status?: "draft" | "confirmed"
    items?: PeriodEvaluationTemplateItemData[]
  }
): Promise<PeriodEvaluationTemplateData> {
  // テンプレート存在確認
  const existing = await prisma.periodEvaluationTemplate.findUnique({
    where: { id: templateId },
    include: { items: true },
  })

  if (!existing) {
    throw new Error("期間固有テンプレートが見つかりません")
  }

  // 基本情報の更新
  const updateData: {
    name?: string
    description?: string
    status?: string
  } = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.status !== undefined) updateData.status = data.status

  // 項目の更新がある場合
  if (data.items) {
    // 既存項目をIDマップ化
    const existingItemMap = new Map(existing.items.map((item) => [item.id, item]))

    // 削除する項目（送られてきたリストに含まれない既存項目）
    const incomingIds = new Set(data.items.filter((i) => i.id).map((i) => i.id))
    const toDelete = existing.items.filter((item) => !incomingIds.has(item.id))

    // 更新と追加を分ける
    const toUpdate = data.items.filter((i) => i.id && existingItemMap.has(i.id))
    const toCreate = data.items.filter((i) => !i.id)

    // トランザクションで処理
    await prisma.$transaction(async (tx) => {
      // 削除
      if (toDelete.length > 0) {
        await tx.periodEvaluationTemplateItem.deleteMany({
          where: {
            id: { in: toDelete.map((i) => i.id) },
          },
        })
      }

      // 更新
      for (const item of toUpdate) {
        const originalItem = existingItemMap.get(item.id!)
        const isModified =
          originalItem &&
          (originalItem.name !== item.name ||
            originalItem.description !== item.description ||
            originalItem.category !== item.category ||
            originalItem.maxScore !== item.maxScore ||
            originalItem.weight !== item.weight)

        await tx.periodEvaluationTemplateItem.update({
          where: { id: item.id },
          data: {
            name: item.name,
            description: item.description,
            category: item.category,
            maxScore: item.maxScore,
            weight: item.weight,
            sortOrder: item.sortOrder,
            isModified: isModified || item.isModified,
          },
        })
      }

      // 追加
      if (toCreate.length > 0) {
        await tx.periodEvaluationTemplateItem.createMany({
          data: toCreate.map((item) => ({
            periodTemplateId: templateId,
            sourceItemId: item.sourceItemId || null,
            name: item.name,
            description: item.description || null,
            category: item.category,
            maxScore: item.maxScore,
            weight: item.weight,
            sortOrder: item.sortOrder,
            isAdded: true,
            isDeleted: false,
            isModified: false,
          })),
        })
      }

      // 基本情報更新
      if (Object.keys(updateData).length > 0) {
        await tx.periodEvaluationTemplate.update({
          where: { id: templateId },
          data: updateData,
        })
      }
    })
  } else if (Object.keys(updateData).length > 0) {
    await prisma.periodEvaluationTemplate.update({
      where: { id: templateId },
      data: updateData,
    })
  }

  // 更新後のデータを取得して返す
  const updated = await prisma.periodEvaluationTemplate.findUnique({
    where: { id: templateId },
    include: {
      grade: { select: { id: true, name: true } },
      jobType: { select: { id: true, name: true } },
      sourceTemplate: { select: { id: true, name: true } },
      items: {
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      },
    },
  })

  return formatPeriodTemplate(updated!)
}

/**
 * 期間固有テンプレートを従業員評価に反映
 */
export async function applyPeriodTemplateToEmployees(
  templateId: string,
  options: {
    employeeIds?: string[]
    overwrite?: boolean
  } = {}
): Promise<{
  appliedCount: number
  skippedCount: number
  details: { employeeId: string; status: "applied" | "skipped" | "error"; reason?: string }[]
}> {
  const { employeeIds, overwrite = false } = options

  // 期間固有テンプレートを取得
  const periodTemplate = await prisma.periodEvaluationTemplate.findUnique({
    where: { id: templateId },
    include: {
      items: {
        where: { isDeleted: false },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      },
      period: true,
    },
  })

  if (!periodTemplate) {
    throw new Error("期間固有テンプレートが見つかりません")
  }

  // マスターテンプレートを取得（EmployeeEvaluation との関連のため）
  const masterTemplate = await prisma.evaluationTemplate.findUnique({
    where: { id: periodTemplate.sourceTemplateId },
    include: {
      items: true,
    },
  })

  if (!masterTemplate) {
    throw new Error("マスターテンプレートが見つかりません")
  }

  // 対象の従業員評価を取得
  const whereCondition: {
    evaluationPeriodId: string
    evaluationType: string
    employee?: {
      gradeId: string
      jobTypeId: string
    }
    employeeId?: { in: string[] }
    evaluationTemplateId: string
  } = {
    evaluationPeriodId: periodTemplate.periodId,
    evaluationType: "individual",
    evaluationTemplateId: masterTemplate.id,
    employee: {
      gradeId: periodTemplate.gradeId,
      jobTypeId: periodTemplate.jobTypeId,
    },
  }

  if (employeeIds && employeeIds.length > 0) {
    whereCondition.employeeId = { in: employeeIds }
  }

  const employeeEvaluations = await prisma.employeeEvaluation.findMany({
    where: whereCondition,
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
      items: true,
    },
  })

  const details: { employeeId: string; status: "applied" | "skipped" | "error"; reason?: string }[] = []
  let appliedCount = 0
  let skippedCount = 0

  // マスターテンプレート項目のIDマップ
  const masterItemMap = new Map(masterTemplate.items.map((item) => [item.id, item]))

  for (const evaluation of employeeEvaluations) {
    try {
      // 既にスコアが入力されているかチェック
      const hasScores = evaluation.items.some(
        (item) => item.selfScore !== null || item.evaluatorScore !== null
      )

      if (hasScores && !overwrite) {
        details.push({
          employeeId: evaluation.employeeId,
          status: "skipped",
          reason: "既にスコアが入力されています",
        })
        skippedCount++
        continue
      }

      // 期間固有テンプレートの項目から従業員評価項目を再生成
      await prisma.$transaction(async (tx) => {
        // 既存の項目を削除
        await tx.employeeEvaluationItem.deleteMany({
          where: { employeeEvaluationId: evaluation.id },
        })

        // 新しい項目を作成（期間固有テンプレートの項目からマスターテンプレート項目IDにマッピング）
        const newItems = periodTemplate.items.map((periodItem) => {
          // sourceItemIdがあればそれを使用、なければ名前で検索
          let masterItemId = periodItem.sourceItemId

          if (!masterItemId) {
            // カテゴリと名前でマスター項目を検索
            for (const [id, masterItem] of masterItemMap) {
              if (masterItem.category === periodItem.category && masterItem.name === periodItem.name) {
                masterItemId = id
                break
              }
            }
          }

          // マスター項目が見つからない場合は、最初のマスター項目を使用
          // （追加された項目の場合、マスターに対応がない）
          if (!masterItemId) {
            // 追加項目の場合、マスターの最初の項目を関連付け（制約回避）
            masterItemId = masterTemplate.items[0]?.id
          }

          return {
            employeeEvaluationId: evaluation.id,
            evaluationTemplateItemId: masterItemId!,
            selfScore: null,
            evaluatorScore: null,
            comment: null,
          }
        })

        if (newItems.length > 0) {
          await tx.employeeEvaluationItem.createMany({
            data: newItems,
          })
        }
      })

      details.push({
        employeeId: evaluation.employeeId,
        status: "applied",
      })
      appliedCount++
    } catch (error) {
      details.push({
        employeeId: evaluation.employeeId,
        status: "error",
        reason: error instanceof Error ? error.message : "不明なエラー",
      })
    }
  }

  return { appliedCount, skippedCount, details }
}

/**
 * 期間固有テンプレート一覧を取得
 */
export async function getPeriodTemplates(
  periodId: string
): Promise<PeriodEvaluationTemplateData[]> {
  const templates = await prisma.periodEvaluationTemplate.findMany({
    where: { periodId },
    include: {
      grade: { select: { id: true, name: true } },
      jobType: { select: { id: true, name: true } },
      sourceTemplate: { select: { id: true, name: true } },
      items: {
        where: { isDeleted: false },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      },
    },
    orderBy: [
      { grade: { level: "asc" } },
      { jobType: { displayOrder: "asc" } },
    ],
  })

  return templates.map(formatPeriodTemplate)
}

/**
 * 期間固有テンプレート詳細を取得
 */
export async function getPeriodTemplateDetail(
  templateId: string
): Promise<PeriodEvaluationTemplateData | null> {
  const template = await prisma.periodEvaluationTemplate.findUnique({
    where: { id: templateId },
    include: {
      grade: { select: { id: true, name: true } },
      jobType: { select: { id: true, name: true } },
      sourceTemplate: { select: { id: true, name: true } },
      items: {
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      },
    },
  })

  if (!template) return null

  return formatPeriodTemplate(template)
}

/**
 * 期間固有テンプレートを削除
 */
export async function deletePeriodTemplate(templateId: string): Promise<void> {
  await prisma.periodEvaluationTemplate.delete({
    where: { id: templateId },
  })
}

// ヘルパー関数
function formatPeriodTemplate(template: {
  id: string
  periodId: string
  sourceTemplateId: string
  gradeId: string
  jobTypeId: string
  name: string
  description: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  grade?: { id: string; name: string } | null
  jobType?: { id: string; name: string } | null
  sourceTemplate?: { id: string; name: string } | null
  items?: Array<{
    id: string
    sourceItemId: string | null
    name: string
    description: string | null
    category: string
    maxScore: number
    weight: number
    sortOrder: number
    isAdded: boolean
    isDeleted: boolean
    isModified: boolean
  }>
}): PeriodEvaluationTemplateData {
  const items = template.items || []
  const activeItems = items.filter((i) => !i.isDeleted)

  return {
    id: template.id,
    periodId: template.periodId,
    sourceTemplateId: template.sourceTemplateId,
    gradeId: template.gradeId,
    jobTypeId: template.jobTypeId,
    name: template.name,
    description: template.description,
    status: template.status as "draft" | "confirmed",
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    grade: template.grade || undefined,
    jobType: template.jobType || undefined,
    sourceTemplate: template.sourceTemplate || undefined,
    items: items.map((item) => ({
      id: item.id,
      sourceItemId: item.sourceItemId,
      name: item.name,
      description: item.description,
      category: item.category,
      maxScore: item.maxScore,
      weight: item.weight,
      sortOrder: item.sortOrder,
      isAdded: item.isAdded,
      isDeleted: item.isDeleted,
      isModified: item.isModified,
    })),
    itemCount: activeItems.length,
    totalMaxScore: activeItems.reduce((sum, item) => sum + item.maxScore, 0),
    hasChanges: items.some((i) => i.isAdded || i.isDeleted || i.isModified),
  }
}
