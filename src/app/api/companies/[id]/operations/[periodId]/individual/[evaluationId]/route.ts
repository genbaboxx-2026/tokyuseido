import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET: 個別評価の詳細を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; evaluationId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { evaluationId } = await params

    const evaluation = await prisma.employeeEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        employee: {
          include: {
            grade: { select: { id: true, name: true } },
            jobType: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        evaluator: {
          select: { id: true, firstName: true, lastName: true },
        },
        evaluationTemplate: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            evaluationTemplateItem: true,
          },
          orderBy: {
            evaluationTemplateItem: {
              sortOrder: "asc",
            },
          },
        },
      },
    })

    if (!evaluation) {
      return NextResponse.json({ error: "評価が見つかりません" }, { status: 404 })
    }

    return NextResponse.json({ evaluation })
  } catch (error) {
    console.error("個別評価取得エラー:", error)
    return NextResponse.json(
      { error: "個別評価の取得に失敗しました" },
      { status: 500 }
    )
  }
}

// PATCH: 個別評価を更新（評価者、ステータス等）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string; evaluationId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { evaluationId } = await params
    const body = await request.json()
    const { evaluatorId, status } = body

    // 更新データを構築
    const updateData: {
      evaluatorId?: string | null
      status?: "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"
    } = {}

    if (evaluatorId !== undefined) {
      updateData.evaluatorId = evaluatorId || null
    }

    if (status !== undefined) {
      // ステータスの妥当性をチェック
      const validStatuses = ["STARTED", "PREPARING", "DISTRIBUTED", "COLLECTED", "AGGREGATING", "COMPLETED"]
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "無効なステータスです" }, { status: 400 })
      }
      updateData.status = status
    }

    const evaluation = await prisma.employeeEvaluation.update({
      where: { id: evaluationId },
      data: updateData,
      include: {
        employee: {
          include: {
            grade: { select: { id: true, name: true } },
            jobType: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        evaluator: {
          select: { id: true, firstName: true, lastName: true },
        },
        evaluationTemplate: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({ evaluation })
  } catch (error) {
    console.error("個別評価更新エラー:", error)
    return NextResponse.json(
      { error: "個別評価の更新に失敗しました" },
      { status: 500 }
    )
  }
}
