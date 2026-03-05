/**
 * 従業員の評価完了ステータス一括取得API
 * GET /api/employees/evaluation-statuses?companyId=xxx&type=individual|360
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const type = searchParams.get("type") // "individual" or "360"

    if (!companyId) {
      return NextResponse.json(
        { error: "companyIdが必要です" },
        { status: 400 }
      )
    }

    if (!type || !["individual", "360"].includes(type)) {
      return NextResponse.json(
        { error: "typeは'individual'または'360'である必要があります" },
        { status: 400 }
      )
    }

    // 会社の従業員を取得
    const employees = await prisma.employee.findMany({
      where: { companyId, status: "ACTIVE" },
      select: { id: true },
    })

    const employeeIds = employees.map((e) => e.id)

    if (type === "individual") {
      // 個別評価のステータスを取得（custom_itemsタイプで保存されている）
      const evaluations = await prisma.employeeEvaluation.findMany({
        where: {
          employeeId: { in: employeeIds },
          evaluationType: "custom_items",
        },
        select: {
          employeeId: true,
          status: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      })

      // 従業員ごとに最新のステータスを取得
      const statusMap = new Map<string, string>()
      for (const evaluation of evaluations) {
        if (!statusMap.has(evaluation.employeeId)) {
          statusMap.set(evaluation.employeeId, evaluation.status)
        }
      }

      const result = Array.from(statusMap.entries()).map(([employeeId, status]) => ({
        employeeId,
        status,
      }))

      return NextResponse.json(result)
    } else {
      // 360度評価のステータスを取得
      const records = await prisma.evaluation360Record.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
        },
        select: {
          employeeId: true,
          status: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      })

      // 従業員ごとに最新のステータスを取得
      const statusMap = new Map<string, string>()
      for (const record of records) {
        if (!statusMap.has(record.employeeId)) {
          // statusを大文字に変換して返す（COMPLETEDと比較できるように）
          statusMap.set(record.employeeId, record.status.toUpperCase())
        }
      }

      const result = Array.from(statusMap.entries()).map(([employeeId, status]) => ({
        employeeId,
        status,
      }))

      return NextResponse.json(result)
    }
  } catch (error) {
    console.error("評価ステータス取得エラー:", error)
    return NextResponse.json(
      { error: "取得に失敗しました" },
      { status: 500 }
    )
  }
}
