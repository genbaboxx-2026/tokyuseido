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
        createdAt: "desc",
      },
    })

    // 各レコードのカスタム項目数を取得
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
    })

    const itemCountMap = new Map(
      itemCounts.map((c) => [c.employeeId, c._count.id])
    )

    // レコードを整形
    const formattedRecords = records.map((record) => {
      const totalReviewers = record.reviewerAssignments.length
      const submittedCount = record.reviewerAssignments.filter(
        (ra) => ra.status === "submitted"
      ).length

      return {
        id: record.id,
        employeeId: record.employeeId,
        employee: record.employee,
        status: record.status,
        currentPhase: getPhaseFromStatus360(record.status),
        evaluationMethod: record.evaluationMethod,
        isAnonymous: record.isAnonymous,
        completedAt: record.completedAt,
        reviewerCount: totalReviewers,
        submittedCount,
        progress: totalReviewers > 0 ? Math.round((submittedCount / totalReviewers) * 100) : 0,
        itemCount: itemCountMap.get(record.employeeId) || 0,
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
