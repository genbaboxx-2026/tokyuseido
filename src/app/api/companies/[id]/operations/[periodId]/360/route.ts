import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Phase360 = "preparing" | "distributing" | "aggregated" | "completed"

// フェーズからステータスへのマッピング
const phase360ToStatuses: Record<Phase360, string[]> = {
  preparing: ["draft", "preparing_items", "preparing_reviewers", "ready"],
  distributing: ["distributing", "collecting"],
  aggregated: ["aggregated"],
  completed: ["completed"],
}

// ステータスからフェーズを取得
function getPhaseFromStatus360(status: string): Phase360 {
  switch (status) {
    case "draft":
    case "preparing_items":
    case "preparing_reviewers":
    case "ready":
      return "preparing"
    case "distributing":
    case "collecting":
      return "distributing"
    case "aggregated":
      return "aggregated"
    case "completed":
      return "completed"
    default:
      return "preparing"
  }
}

// GET: 360度評価の被評価者一覧（全従業員のステータス・評価者数・回収進捗含む）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await params
    const { searchParams } = new URL(request.url)
    const phase = searchParams.get("phase") as Phase360 | null
    const includeAll = searchParams.get("includeAll") === "true"

    // includeAll=trueの場合はフィルタなし、それ以外は従来通り
    const statusFilter = !includeAll && phase ? phase360ToStatuses[phase] : undefined

    // 360度評価レコードを取得
    const records = await prisma.evaluation360Record.findMany({
      where: {
        companyId,
        evaluationPeriodId: periodId,
        ...(statusFilter && { status: { in: statusFilter } }),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } },
            grade: { select: { id: true, name: true } },
            jobType: { select: { id: true, name: true } },
            evaluator360Ids: true,
          },
        },
        reviewerAssignments: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        employee: {
          lastName: "asc",
        },
      },
    })

    // 各レコードのカスタム項目数と満点を取得
    const employeeIds = records.map((r) => r.employeeId)
    const itemCounts = await prisma.evaluationCustomItem.groupBy({
      by: ["employeeId"],
      where: {
        companyId,
        periodId,
        evaluationType: "360",
        isDeleted: false,
        employeeId: { in: employeeIds },
      },
      _count: { id: true },
      _sum: { maxScore: true },
    })

    const itemCountMap = new Map(
      itemCounts.map((c) => [c.employeeId, c._count.id])
    )
    const maxScoreMap = new Map(
      itemCounts.map((c) => [c.employeeId, c._sum.maxScore || 0])
    )

    // カスタム項目がない従業員のために、テンプレートから満点を取得
    const employeesWithoutItems = records.filter(
      (r) => !itemCountMap.has(r.employeeId) || itemCountMap.get(r.employeeId) === 0
    )

    // 期間固有テンプレートまたはマスターテンプレートを取得（満点計算用）
    // まず期間固有テンプレートを確認
    let templates = await prisma.evaluation360Template.findMany({
      where: {
        companyId,
        periodId,
        isActive: true,
      },
      include: {
        grades: { select: { gradeId: true } },
        jobTypes: { select: { jobTypeId: true } },
        categories: {
          include: {
            items: { select: { maxScore: true } },
          },
        },
      },
    })

    // 期間固有テンプレートがなければマスターテンプレートを使用
    if (templates.length === 0) {
      templates = await prisma.evaluation360Template.findMany({
        where: {
          companyId,
          periodId: null,
          isActive: true,
          status: "confirmed",
        },
        include: {
          grades: { select: { gradeId: true } },
          jobTypes: { select: { jobTypeId: true } },
          categories: {
            include: {
              items: { select: { maxScore: true } },
            },
          },
        },
      })
    }

    // テンプレートの満点を計算
    const templateScoreMap = new Map<string, number>()
    const gradeOnlyMap = new Map<string, number>()
    const jobTypeOnlyMap = new Map<string, number>()
    let defaultTemplateScore = 0

    for (const template of templates) {
      const totalScore = template.categories.reduce(
        (sum, cat) => sum + cat.items.reduce((s, item) => s + item.maxScore, 0),
        0
      )

      // 最初のテンプレートをデフォルトとして使用
      if (defaultTemplateScore === 0 && totalScore > 0) {
        defaultTemplateScore = totalScore
      }

      // 等級×職種の組み合わせでマップ
      for (const grade of template.grades) {
        // 等級のみのマップ
        if (!gradeOnlyMap.has(grade.gradeId)) {
          gradeOnlyMap.set(grade.gradeId, totalScore)
        }
        for (const jobType of template.jobTypes) {
          const key = `${grade.gradeId}:${jobType.jobTypeId}`
          templateScoreMap.set(key, totalScore)
        }
      }
      // 職種のみのマップ
      for (const jobType of template.jobTypes) {
        if (!jobTypeOnlyMap.has(jobType.jobTypeId)) {
          jobTypeOnlyMap.set(jobType.jobTypeId, totalScore)
        }
      }
    }

    // カスタム項目がない従業員にテンプレートの満点を設定
    for (const record of employeesWithoutItems) {
      const gradeId = record.employee.grade?.id
      const jobTypeId = record.employee.jobType?.id

      let templateScore = 0

      // 1. 等級×職種の完全マッチ
      if (gradeId && jobTypeId) {
        const key = `${gradeId}:${jobTypeId}`
        templateScore = templateScoreMap.get(key) || 0
      }

      // 2. 等級のみのマッチ
      if (templateScore === 0 && gradeId) {
        templateScore = gradeOnlyMap.get(gradeId) || 0
      }

      // 3. 職種のみのマッチ
      if (templateScore === 0 && jobTypeId) {
        templateScore = jobTypeOnlyMap.get(jobTypeId) || 0
      }

      // 4. デフォルトのテンプレート満点
      if (templateScore === 0) {
        templateScore = defaultTemplateScore
      }

      if (templateScore > 0) {
        maxScoreMap.set(record.employeeId, templateScore)
      }
    }

    // 全レコードにデフォルトスコアを適用（まだスコアがない場合）
    if (defaultTemplateScore > 0) {
      for (const record of records) {
        if (!maxScoreMap.has(record.employeeId) || maxScoreMap.get(record.employeeId) === 0) {
          maxScoreMap.set(record.employeeId, defaultTemplateScore)
        }
      }
    }

    // レコードを整形
    const formattedRecords = records.map((record) => {
      const totalReviewers = record.reviewerAssignments.length
      const submittedCount = record.reviewerAssignments.filter(
        (ra) => ra.status === "submitted"
      ).length

      // 評価者IDの配列（順序維持）
      // reviewerAssignmentsがない場合は従業員のデフォルト評価者を使用
      const reviewerIds = record.reviewerAssignments.length > 0
        ? record.reviewerAssignments.map((ra) => ra.reviewer.id)
        : record.employee.evaluator360Ids || []

      // 従業員情報からevaluator360Idsを除外してレスポンス
      const { evaluator360Ids: _omit, ...employeeData } = record.employee

      return {
        id: record.id,
        employeeId: record.employeeId,
        employee: employeeData,
        status: record.status,
        currentPhase: getPhaseFromStatus360(record.status),
        evaluationMethod: record.evaluationMethod,
        isAnonymous: record.isAnonymous,
        completedAt: record.completedAt,
        reviewerCount: totalReviewers,
        reviewerIds,
        defaultReviewerIds: record.employee.evaluator360Ids || [],
        submittedCount,
        progress: totalReviewers > 0 ? Math.round((submittedCount / totalReviewers) * 100) : 0,
        categoryCount: itemCountMap.get(record.employeeId) || 0,
        maxScore: maxScoreMap.get(record.employeeId) || 0,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }
    })

    // includeAll=trueかつphaseが指定されている場合、アクティブ（該当フェーズ）を先にソート
    let sortedRecords = formattedRecords
    if (includeAll && phase) {
      sortedRecords = [...formattedRecords].sort((a, b) => {
        const aActive = a.currentPhase === phase
        const bActive = b.currentPhase === phase
        if (aActive && !bActive) return -1
        if (!aActive && bActive) return 1
        return 0
      })
    }

    return NextResponse.json({ records: sortedRecords })
  } catch (error) {
    console.error("360度評価一覧取得エラー:", error)
    return NextResponse.json(
      { error: "360度評価一覧の取得に失敗しました" },
      { status: 500 }
    )
  }
}

// POST: 360度評価レコードを一括作成（対象従業員の選択）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await params
    const body = await request.json()
    const { employeeIds } = body as { employeeIds: string[] }

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { error: "従業員IDが必要です" },
        { status: 400 }
      )
    }

    // 既存のレコードを確認
    const existingRecords = await prisma.evaluation360Record.findMany({
      where: {
        evaluationPeriodId: periodId,
        employeeId: { in: employeeIds },
      },
      select: { employeeId: true },
    })

    const existingEmployeeIds = new Set(existingRecords.map((r) => r.employeeId))
    const newEmployeeIds = employeeIds.filter((id) => !existingEmployeeIds.has(id))

    if (newEmployeeIds.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: employeeIds.length,
        message: "すべての従業員は既にレコードが存在します",
      })
    }

    // 新しいレコードを作成
    const createdRecords = await prisma.evaluation360Record.createMany({
      data: newEmployeeIds.map((employeeId) => ({
        evaluationPeriodId: periodId,
        employeeId,
        companyId,
        status: "draft",
      })),
    })

    return NextResponse.json({
      created: createdRecords.count,
      skipped: employeeIds.length - newEmployeeIds.length,
      message: `${createdRecords.count}件のレコードを作成しました`,
    })
  } catch (error) {
    console.error("360度評価レコード作成エラー:", error)
    return NextResponse.json(
      { error: "360度評価レコードの作成に失敗しました" },
      { status: 500 }
    )
  }
}
