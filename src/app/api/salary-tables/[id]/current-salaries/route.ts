import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET: 従業員の現基本給一覧取得
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: salaryTableId } = await params

    // 号俸テーブルを取得
    const salaryTable = await prisma.salaryTable.findUnique({
      where: { id: salaryTableId },
      select: { id: true, companyId: true, name: true },
    })

    if (!salaryTable) {
      return NextResponse.json({ error: "号俸テーブルが見つかりません" }, { status: 404 })
    }

    // 従業員一覧を取得
    const employees = await prisma.employee.findMany({
      where: { companyId: salaryTable.companyId },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        gradeId: true,
        grade: {
          select: { id: true, name: true, level: true },
        },
        jobType: {
          select: { id: true, name: true },
        },
        employeeCurrentSalaries: {
          where: { salaryTableId },
          select: { currentSalary: true },
        },
      },
      orderBy: [{ grade: { level: "desc" } }, { lastName: "asc" }],
    })

    // レスポンス形式に変換
    const result = employees.map((emp) => ({
      employeeId: emp.id,
      employeeNumber: emp.employeeCode,
      name: `${emp.lastName} ${emp.firstName}`,
      gradeId: emp.gradeId,
      gradeName: emp.grade?.name || "",
      gradeLevel: emp.grade?.level || 0,
      jobTypeName: emp.jobType?.name || "",
      currentSalary: emp.employeeCurrentSalaries[0]?.currentSalary || null,
    }))

    return NextResponse.json({
      employees: result,
      salaryTable: {
        id: salaryTable.id,
        name: salaryTable.name,
      },
    })
  } catch (error) {
    console.error("現基本給一覧取得エラー:", error)
    return NextResponse.json(
      { error: "現基本給一覧の取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * PUT: 現基本給一括保存
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: salaryTableId } = await params
    const body = await request.json()
    const { salaries } = body as { salaries: { employeeId: string; currentSalary: number }[] }

    if (!salaries || !Array.isArray(salaries)) {
      return NextResponse.json({ error: "無効なリクエストです" }, { status: 400 })
    }

    // バリデーション: 0以上の整数のみ許可
    for (const salary of salaries) {
      if (typeof salary.currentSalary !== "number" || salary.currentSalary < 0 || !Number.isInteger(salary.currentSalary)) {
        return NextResponse.json(
          { error: `無効な基本給: ${salary.currentSalary}（0以上の整数を指定してください）` },
          { status: 400 }
        )
      }
    }

    // 号俸テーブルの存在確認
    const salaryTable = await prisma.salaryTable.findUnique({
      where: { id: salaryTableId },
      select: { id: true, companyId: true },
    })

    if (!salaryTable) {
      return NextResponse.json({ error: "号俸テーブルが見つかりません" }, { status: 404 })
    }

    // 従業員の存在確認
    const employeeIds = salaries.map((s) => s.employeeId)
    const existingEmployees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        companyId: salaryTable.companyId,
      },
      select: { id: true },
    })

    const existingEmployeeIds = new Set(existingEmployees.map((e) => e.id))
    const invalidEmployeeIds = employeeIds.filter((id) => !existingEmployeeIds.has(id))

    if (invalidEmployeeIds.length > 0) {
      return NextResponse.json(
        { error: `存在しない従業員ID: ${invalidEmployeeIds.join(", ")}` },
        { status: 400 }
      )
    }

    // 一括upsert
    await prisma.$transaction(
      salaries.map((salary) =>
        prisma.employeeCurrentSalary.upsert({
          where: {
            employeeId_salaryTableId: {
              employeeId: salary.employeeId,
              salaryTableId,
            },
          },
          update: {
            currentSalary: salary.currentSalary,
          },
          create: {
            employeeId: salary.employeeId,
            salaryTableId,
            currentSalary: salary.currentSalary,
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      updatedCount: salaries.length,
    })
  } catch (error) {
    console.error("現基本給保存エラー:", error)
    return NextResponse.json(
      { error: "現基本給の保存に失敗しました" },
      { status: 500 }
    )
  }
}
