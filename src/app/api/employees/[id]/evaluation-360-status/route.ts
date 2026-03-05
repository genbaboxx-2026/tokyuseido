/**
 * 従業員の360度評価ステータスAPI
 * GET /api/employees/[id]/evaluation-360-status - ステータス取得
 * POST /api/employees/[id]/evaluation-360-status - ステータス保存
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * 従業員の360度評価ステータスを取得
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id } = await context.params

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { companyId: true },
    })

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      )
    }

    // 最新の評価期間を取得
    const latestPeriod = await prisma.evaluationPeriod.findFirst({
      where: { companyId: employee.companyId },
      orderBy: { createdAt: "desc" },
    })

    if (!latestPeriod) {
      return NextResponse.json({
        employeeId: id,
        status: "NOT_STARTED",
      })
    }

    // 360度評価レコードを取得
    const record = await prisma.evaluation360Record.findFirst({
      where: {
        employeeId: id,
        evaluationPeriodId: latestPeriod.id,
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({
      employeeId: id,
      status: record?.status?.toUpperCase() || "NOT_STARTED",
    })
  } catch (error) {
    console.error("360度評価ステータス取得エラー:", error)
    return NextResponse.json(
      { error: "ステータスの取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * 従業員の360度評価ステータスを保存
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { id } = await context.params
    const body = await request.json()
    const { status } = body as { status: string }

    if (!status) {
      return NextResponse.json(
        { error: "ステータスが必要です" },
        { status: 400 }
      )
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { companyId: true },
    })

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      )
    }

    // 最新の評価期間を取得または作成
    let latestPeriod = await prisma.evaluationPeriod.findFirst({
      where: { companyId: employee.companyId },
      orderBy: { createdAt: "desc" },
    })

    if (!latestPeriod) {
      // 評価期間がなければ作成
      const now = new Date()
      latestPeriod = await prisma.evaluationPeriod.create({
        data: {
          companyId: employee.companyId,
          name: `${now.getFullYear()}年度評価`,
          periodType: "FIRST_HALF",
          startDate: new Date(now.getFullYear(), 0, 1),
          endDate: new Date(now.getFullYear(), 11, 31),
          status: "STARTED",
        },
      })
    }

    // ステータスを小文字に変換（DBの形式に合わせる）
    const dbStatus = status.toLowerCase()

    // 既存のレコードを探す
    const existingRecord = await prisma.evaluation360Record.findFirst({
      where: {
        employeeId: id,
        evaluationPeriodId: latestPeriod.id,
      },
    })

    let record
    if (existingRecord) {
      record = await prisma.evaluation360Record.update({
        where: { id: existingRecord.id },
        data: {
          status: dbStatus,
          completedAt: dbStatus === "completed" ? new Date() : null,
        },
      })
    } else {
      record = await prisma.evaluation360Record.create({
        data: {
          employeeId: id,
          evaluationPeriodId: latestPeriod.id,
          companyId: employee.companyId,
          status: dbStatus,
          completedAt: dbStatus === "completed" ? new Date() : null,
        },
      })
    }

    return NextResponse.json({
      employeeId: id,
      status: record.status.toUpperCase(),
    })
  } catch (error) {
    console.error("360度評価ステータス保存エラー:", error)
    return NextResponse.json(
      { error: "ステータスの保存に失敗しました" },
      { status: 500 }
    )
  }
}
