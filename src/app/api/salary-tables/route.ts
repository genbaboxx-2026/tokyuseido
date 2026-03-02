import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  salaryTableFormSchema,
  generateSalaryTableEntries,
  calculateBaseSalaryMax,
} from "@/lib/salary-table"

/**
 * GET: 号俸テーブル一覧取得
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    if (!companyId) {
      return NextResponse.json({ error: "会社IDは必須です" }, { status: 400 })
    }

    const salaryTables = await prisma.salaryTable.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { entries: true },
        },
      },
    })

    return NextResponse.json(salaryTables)
  } catch (error) {
    console.error("号俸テーブル一覧取得エラー:", error)
    return NextResponse.json(
      { error: "号俸テーブル一覧の取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * POST: 号俸テーブル作成（パラメータから自動生成）
 *
 * 【用語マッピング】
 * フォーム → DB
 * - stepsPerBand → rankDivision
 * - bandIncreaseRate → increaseRate
 * - salaryBandCount → totalRanks
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = salaryTableFormSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const {
      companyId,
      name,
      baseSalaryMax,
      baseSalaryMin,
      stepsPerBand,       // 号俸帯内ステップ数 → DB: rankDivision
      bandIncreaseRate,   // 号俸帯間増加率 → DB: increaseRate
      initialStepDiff,
      salaryBandCount,    // 号俸帯数 → DB: totalRanks
      isActive,
      rankStartLetter,
      rankEndLetter,
    } = validationResult.data

    // 会社の存在確認
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json({ error: "指定された会社が見つかりません" }, { status: 404 })
    }

    // 会社の等級を取得
    const grades = await prisma.grade.findMany({
      where: { companyId },
      orderBy: { level: "asc" },
    })

    if (grades.length === 0) {
      return NextResponse.json(
        { error: "等級が設定されていません。先に等級を設定してください。" },
        { status: 400 }
      )
    }

    // 計算結果MAXを取得
    const calculatedMax = calculateBaseSalaryMax({
      baseSalaryMin,
      initialStepDiff,
      bandIncreaseRate,
      stepsPerBand,
      salaryBandCount,
      rankStartLetter: rankStartLetter as "S" | "A" | "B" | "C" | "D" | "E" | "F",
      rankEndLetter: rankEndLetter as "S" | "A" | "B" | "C" | "D" | "E" | "F",
    })

    // トランザクションで号俸テーブルとエントリを作成
    const result = await prisma.$transaction(async (tx) => {
      // 号俸テーブルを作成
      // 注: DBカラム名は旧名称のまま（マイグレーション未実施）
      // 名前が指定されていない場合はデフォルト名を生成
      const tableName = name || `号俸テーブル_${new Date().toISOString().slice(0, 10)}`

      const salaryTable = await tx.salaryTable.create({
        data: {
          companyId,
          name: tableName,
          baseSalaryMax: calculatedMax, // 計算結果を保存
          baseSalaryMin,
          rankDivision: stepsPerBand,       // 号俸帯内ステップ数
          increaseRate: bandIncreaseRate,   // 号俸帯間増加率
          initialStepDiff,
          totalRanks: salaryBandCount,      // 号俸帯数
          isActive: isActive ?? true,
        },
      })

      // 号俸テーブルエントリを生成
      const entries = generateSalaryTableEntries(
        {
          baseSalaryMin,
          initialStepDiff,
          bandIncreaseRate,
          stepsPerBand,
          salaryBandCount,
          rankStartLetter: rankStartLetter as "S" | "A" | "B" | "C" | "D" | "E" | "F",
          rankEndLetter: rankEndLetter as "S" | "A" | "B" | "C" | "D" | "E" | "F",
        },
        grades.map((g) => ({ id: g.id, name: g.name, level: g.level }))
      )

      // エントリを一括作成
      await tx.salaryTableEntry.createMany({
        data: entries.map((entry) => ({
          salaryTableId: salaryTable.id,
          gradeId: entry.gradeId,
          stepNumber: entry.stepNumber,
          rank: entry.rank,
          baseSalary: entry.baseSalary,
        })),
      })

      // 作成結果を取得
      const createdTable = await tx.salaryTable.findUnique({
        where: { id: salaryTable.id },
        include: {
          entries: {
            include: {
              grade: true,
            },
            orderBy: [{ grade: { level: "desc" } }, { stepNumber: "asc" }],
          },
        },
      })

      return createdTable
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("号俸テーブル作成エラー:", error)
    return NextResponse.json(
      { error: "号俸テーブルの作成に失敗しました" },
      { status: 500 }
    )
  }
}
