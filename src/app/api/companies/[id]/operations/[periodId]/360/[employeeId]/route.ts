import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET: 360度評価レコード詳細
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, employeeId } = await params

    // レコードを取得（なければ作成）
    let record = await prisma.evaluation360Record.findUnique({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId,
        },
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
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: { select: { id: true, name: true } },
                grade: { select: { id: true, name: true } },
              },
            },
            scores: true,
          },
        },
      },
    })

    if (!record) {
      // レコードがなければ作成
      record = await prisma.evaluation360Record.create({
        data: {
          evaluationPeriodId: periodId,
          employeeId,
          companyId,
          status: "draft",
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
            include: {
              reviewer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  department: { select: { id: true, name: true } },
                  grade: { select: { id: true, name: true } },
                },
              },
              scores: true,
            },
          },
        },
      })
    }

    // EvaluationCustomItemから評価項目を取得
    const customItems = await prisma.evaluationCustomItem.findMany({
      where: {
        employeeId,
        companyId,
        periodId,
        evaluationType: "360",
        isDeleted: false,
      },
      orderBy: [
        { categorySortOrder: "asc" },
        { sortOrder: "asc" },
      ],
    })

    // カテゴリごとにグループ化
    const categoriesMap = new Map<string, {
      id: string
      name: string
      sortOrder: number
      items: {
        id: string
        content: string
        maxScore: number
        sortOrder: number
      }[]
    }>()

    customItems.forEach((item) => {
      const categoryName = item.categoryName || "その他"
      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          id: `cat-${categoriesMap.size}`,
          name: categoryName,
          sortOrder: item.categorySortOrder || 0,
          items: [],
        })
      }
      categoriesMap.get(categoryName)!.items.push({
        id: item.id,
        content: item.itemName,
        maxScore: item.maxScore,
        sortOrder: item.sortOrder,
      })
    })

    const categories = Array.from(categoriesMap.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    )

    // 評価者の全体担当数を計算
    const reviewerIds = record.reviewerAssignments.map((ra) => ra.reviewerId)
    const reviewerLoadMap = new Map<string, number>()

    if (reviewerIds.length > 0) {
      const reviewerCounts = await prisma.evaluation360ReviewerAssignment.groupBy({
        by: ["reviewerId"],
        where: {
          reviewerId: { in: reviewerIds },
          record: {
            evaluationPeriodId: periodId,
          },
        },
        _count: { id: true },
      })

      for (const count of reviewerCounts) {
        reviewerLoadMap.set(count.reviewerId, count._count.id)
      }
    }

    // レスポンスを整形
    const response = {
      ...record,
      categories,
      reviewerAssignments: record.reviewerAssignments.map((ra) => ({
        ...ra,
        totalLoad: reviewerLoadMap.get(ra.reviewerId) || 0,
        loadLevel:
          (reviewerLoadMap.get(ra.reviewerId) || 0) <= 10
            ? "green"
            : (reviewerLoadMap.get(ra.reviewerId) || 0) <= 15
            ? "yellow"
            : "red",
      })),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("360度評価レコード取得エラー:", error)
    return NextResponse.json(
      { error: "360度評価レコードの取得に失敗しました" },
      { status: 500 }
    )
  }
}

// DELETE: 360度評価レコードを削除（draft状態のみ）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; employeeId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId, employeeId } = await params

    const record = await prisma.evaluation360Record.findUnique({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId,
        },
      },
    })

    if (!record) {
      return NextResponse.json(
        { error: "レコードが見つかりません" },
        { status: 404 }
      )
    }

    if (record.status !== "draft") {
      return NextResponse.json(
        { error: "draft状態以外のレコードは削除できません" },
        { status: 400 }
      )
    }

    // トランザクションでレコードとカスタム項目を削除
    await prisma.$transaction(async (tx) => {
      // カスタム項目を削除
      await tx.evaluationCustomItem.deleteMany({
        where: {
          employeeId,
          companyId,
          periodId,
          evaluationType: "360",
        },
      })

      // レコードを削除
      await tx.evaluation360Record.delete({
        where: { id: record.id },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("360度評価レコード削除エラー:", error)
    return NextResponse.json(
      { error: "360度評価レコードの削除に失敗しました" },
      { status: 500 }
    )
  }
}
