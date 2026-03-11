/**
 * 企業従業員API - 評価対象者取得
 * GET /api/companies/[id]/employees - 企業に所属する従業員一覧（評価フラグでフィルタ可能）
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { Prisma } from "@/generated/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId } = await params
    const { searchParams } = new URL(request.url)

    // フィルタオプション
    const has360Evaluation = searchParams.get("has360Evaluation")
    const hasIndividualEvaluation = searchParams.get("hasIndividualEvaluation")

    // 検索条件を構築
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      status: "ACTIVE",
    }

    // 評価フラグでフィルタリング
    if (has360Evaluation === "true") {
      where.has360Evaluation = true
    } else if (has360Evaluation === "false") {
      where.has360Evaluation = false
    }

    if (hasIndividualEvaluation === "true") {
      where.hasIndividualEvaluation = true
    } else if (hasIndividualEvaluation === "false") {
      where.hasIndividualEvaluation = false
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        has360Evaluation: true,
        hasIndividualEvaluation: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        grade: {
          select: {
            id: true,
            name: true,
          },
        },
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
        position: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    })

    return NextResponse.json({ employees })
  } catch (error) {
    console.error("企業従業員一覧取得エラー:", error)
    return NextResponse.json(
      { error: "従業員一覧の取得に失敗しました" },
      { status: 500 }
    )
  }
}
