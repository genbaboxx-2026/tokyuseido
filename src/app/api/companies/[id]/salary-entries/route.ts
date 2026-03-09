import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET: 企業の有効な号俸テーブルエントリを取得
 * クエリパラメータ:
 * - gradeId: 等級ID（必須）指定した等級のエントリのみ取得
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId } = await params
    const { searchParams } = new URL(request.url)
    const gradeId = searchParams.get("gradeId")

    if (!gradeId) {
      return NextResponse.json({ error: "gradeIdは必須です" }, { status: 400 })
    }

    // 有効な号俸テーブルを取得
    const activeSalaryTable = await prisma.salaryTable.findFirst({
      where: {
        companyId,
        isActive: true,
      },
      select: { id: true },
    })

    if (!activeSalaryTable) {
      return NextResponse.json({
        entries: [],
        message: "有効な号俸テーブルがありません",
      })
    }

    // 指定等級のエントリを取得
    const entries = await prisma.salaryTableEntry.findMany({
      where: {
        salaryTableId: activeSalaryTable.id,
        gradeId,
      },
      orderBy: { stepNumber: "asc" },
      select: {
        id: true,
        stepNumber: true,
        rank: true,
        baseSalary: true,
      },
    })

    return NextResponse.json({ entries })
  } catch (error) {
    console.error("号俸エントリ取得エラー:", error)
    return NextResponse.json(
      { error: "号俸エントリの取得に失敗しました" },
      { status: 500 }
    )
  }
}
