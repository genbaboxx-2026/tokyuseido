import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { findEmployeeSalaryPosition, checkGradeSalaryMismatch } from "@/lib/salary-table"
import type { EmployeeSalaryMatch, SalaryMatchStatus } from "@/types/salary"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET: 従業員の号俸当てはめ結果取得（ミスマッチ検出含む）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params

    // 号俸テーブルを取得
    const salaryTable = await prisma.salaryTable.findUnique({
      where: { id },
      include: {
        entries: {
          select: {
            gradeId: true,
            stepNumber: true,
            rank: true,
            baseSalary: true,
          },
        },
      },
    })

    if (!salaryTable) {
      return NextResponse.json({ error: "号俸テーブルが見つかりません" }, { status: 404 })
    }

    // 等級を取得
    const grades = await prisma.grade.findMany({
      where: { companyId: salaryTable.companyId },
      orderBy: { level: "desc" },
      select: { id: true, name: true, level: true },
    })

    // 従業員を取得
    const employees = await prisma.employee.findMany({
      where: { companyId: salaryTable.companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        baseSalary: true,
        gradeId: true,
        currentStep: true,
        currentRank: true,
        grade: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ grade: { level: "desc" } }, { lastName: "asc" }],
    })

    // 各従業員の号俸当てはめを計算
    const matches: EmployeeSalaryMatch[] = employees.map((emp) => {
      // 等級未割当の場合
      if (!emp.gradeId || !emp.grade) {
        return {
          employeeId: emp.id,
          employeeName: `${emp.lastName} ${emp.firstName}`,
          gradeId: "",
          gradeName: "",
          currentBaseSalary: emp.baseSalary || 0,
          matchedStep: null,
          matchedRank: null,
          tableBaseSalary: null,
          difference: null,
          status: "NOT_ASSIGNED" as SalaryMatchStatus,
        }
      }

      // 基本給未設定の場合
      if (!emp.baseSalary) {
        return {
          employeeId: emp.id,
          employeeName: `${emp.lastName} ${emp.firstName}`,
          gradeId: emp.gradeId,
          gradeName: emp.grade.name,
          currentBaseSalary: 0,
          matchedStep: null,
          matchedRank: null,
          tableBaseSalary: null,
          difference: null,
          status: "NOT_ASSIGNED" as SalaryMatchStatus,
        }
      }

      // 号俸位置を検索
      const position = findEmployeeSalaryPosition(
        emp.baseSalary,
        emp.gradeId,
        salaryTable.entries.map((e) => ({
          gradeId: e.gradeId,
          stepNumber: e.stepNumber,
          rank: e.rank,
          baseSalary: e.baseSalary,
        }))
      )

      // ミスマッチをチェック
      const mismatch = checkGradeSalaryMismatch(
        emp.baseSalary,
        emp.gradeId,
        salaryTable.entries.map((e) => ({
          gradeId: e.gradeId,
          stepNumber: e.stepNumber,
          rank: e.rank,
          baseSalary: e.baseSalary,
        })),
        grades.map((g) => ({ id: g.id, name: g.name, level: g.level }))
      )

      // ステータスを決定
      let status: SalaryMatchStatus
      if (mismatch.hasMismatch) {
        status = "GRADE_MISMATCH"
      } else if (!position.isWithinRange) {
        status = "OUT_OF_RANGE"
      } else if (position.isExactMatch) {
        status = "EXACT_MATCH"
      } else {
        status = "APPROXIMATE"
      }

      return {
        employeeId: emp.id,
        employeeName: `${emp.lastName} ${emp.firstName}`,
        gradeId: emp.gradeId,
        gradeName: emp.grade.name,
        currentBaseSalary: emp.baseSalary,
        matchedStep: position.stepNumber,
        matchedRank: position.rank,
        tableBaseSalary: position.tableBaseSalary,
        difference: position.difference,
        status,
      }
    })

    // サマリーを計算
    const summary = {
      total: matches.length,
      exactMatch: matches.filter((m) => m.status === "EXACT_MATCH").length,
      approximate: matches.filter((m) => m.status === "APPROXIMATE").length,
      outOfRange: matches.filter((m) => m.status === "OUT_OF_RANGE").length,
      gradeMismatch: matches.filter((m) => m.status === "GRADE_MISMATCH").length,
      notAssigned: matches.filter((m) => m.status === "NOT_ASSIGNED").length,
    }

    return NextResponse.json({
      matches,
      summary,
      salaryTable: {
        id: salaryTable.id,
        name: salaryTable.name,
      },
    })
  } catch (error) {
    console.error("従業員号俸当てはめ取得エラー:", error)
    return NextResponse.json(
      { error: "従業員号俸当てはめの取得に失敗しました" },
      { status: 500 }
    )
  }
}
