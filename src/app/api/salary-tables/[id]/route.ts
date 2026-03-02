import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  salaryTableUpdateSchema,
  generateSalaryTableEntries,
  calculateBaseSalaryMax,
} from "@/lib/salary-table"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET: 号俸テーブル詳細取得（全エントリ含む）
 *
 * 【用語マッピング】
 * DB → レスポンス
 * - rankDivision → stepsPerBand（号俸帯内ステップ数）
 * - increaseRate → bandIncreaseRate（号俸帯間増加率）
 * - totalRanks → salaryBandCount（号俸帯数）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params

    const salaryTable = await prisma.salaryTable.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            grade: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
          orderBy: [{ grade: { level: "desc" } }, { stepNumber: "asc" }],
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!salaryTable) {
      return NextResponse.json({ error: "号俸テーブルが見つかりません" }, { status: 404 })
    }

    // マトリクス形式に変換
    const grades = await prisma.grade.findMany({
      where: { companyId: salaryTable.companyId },
      orderBy: { level: "desc" },
      select: { id: true, name: true, level: true },
    })

    // エントリをマトリクスに変換
    const entryMap = new Map<string, typeof salaryTable.entries[0]>()
    for (const entry of salaryTable.entries) {
      entryMap.set(`${entry.gradeId}-${entry.stepNumber}`, entry)
    }

    // 号俸でグループ化
    const stepNumbers = [...new Set(salaryTable.entries.map((e) => e.stepNumber))].sort(
      (a, b) => a - b
    )

    // 号俸帯情報を計算
    const stepsPerBand = salaryTable.rankDivision
    const salaryBandCount = salaryTable.totalRanks

    const rows = stepNumbers.map((stepNumber) => {
      const sampleEntry = salaryTable.entries.find((e) => e.stepNumber === stepNumber)

      // 号俸帯番号を計算（1始まり）
      const bandNumber = Math.ceil(stepNumber / stepsPerBand)

      // 号俸帯内での位置
      const positionInBand = ((stepNumber - 1) % stepsPerBand) + 1

      // 号俸帯境界（T行）かどうか
      const isBandBoundary = positionInBand === stepsPerBand && bandNumber < salaryBandCount

      // 号俸帯の表示ラベル（グループの先頭行にのみ表示）
      let bandDisplayLabel = ""
      if (positionInBand === 1) {
        const startStep = (bandNumber - 1) * stepsPerBand + 1
        const endStep = bandNumber * stepsPerBand
        if (stepsPerBand === 1) {
          bandDisplayLabel = `${startStep}`
        } else {
          bandDisplayLabel = `${endStep}〜${startStep}`
        }
      }

      return {
        stepNumber,
        rank: sampleEntry?.rank || "",
        bandNumber,
        bandDisplayLabel,
        isBandBoundary,
        entries: grades.map((grade) => {
          const entry = entryMap.get(`${grade.id}-${stepNumber}`)
          return {
            gradeId: grade.id,
            baseSalary: entry?.baseSalary ?? 0,
            annualSalary: (entry?.baseSalary ?? 0) * 12,
          }
        }),
      }
    })

    return NextResponse.json({
      salaryTable: {
        id: salaryTable.id,
        companyId: salaryTable.companyId,
        name: salaryTable.name,
        baseSalaryMax: salaryTable.baseSalaryMax,
        baseSalaryMin: salaryTable.baseSalaryMin,
        // 新用語でレスポンス
        stepsPerBand: salaryTable.rankDivision,
        bandIncreaseRate: salaryTable.increaseRate,
        salaryBandCount: salaryTable.totalRanks,
        initialStepDiff: salaryTable.initialStepDiff,
        isActive: salaryTable.isActive,
        createdAt: salaryTable.createdAt,
        updatedAt: salaryTable.updatedAt,
      },
      grades,
      rows,
      company: salaryTable.company,
    })
  } catch (error) {
    console.error("号俸テーブル詳細取得エラー:", error)
    return NextResponse.json(
      { error: "号俸テーブル詳細の取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * PUT: 号俸テーブル更新（再生成）
 *
 * 【用語マッピング】
 * フォーム → DB
 * - stepsPerBand → rankDivision
 * - bandIncreaseRate → increaseRate
 * - salaryBandCount → totalRanks
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // 既存のテーブルを取得
    const existingTable = await prisma.salaryTable.findUnique({
      where: { id },
    })

    if (!existingTable) {
      return NextResponse.json({ error: "号俸テーブルが見つかりません" }, { status: 404 })
    }

    // バリデーション
    const validationResult = salaryTableUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // パラメータが変更されたかチェック
    const paramsChanged =
      updateData.baseSalaryMax !== undefined ||
      updateData.baseSalaryMin !== undefined ||
      updateData.stepsPerBand !== undefined ||
      updateData.bandIncreaseRate !== undefined ||
      updateData.initialStepDiff !== undefined ||
      updateData.salaryBandCount !== undefined

    // 等級を取得
    const grades = await prisma.grade.findMany({
      where: { companyId: existingTable.companyId },
      orderBy: { level: "asc" },
    })

    if (grades.length === 0) {
      return NextResponse.json(
        { error: "等級が設定されていません" },
        { status: 400 }
      )
    }

    // 新しいパラメータを決定（新用語 → DB用語マッピング）
    const newBaseSalaryMax = updateData.baseSalaryMax ?? existingTable.baseSalaryMax
    const newBaseSalaryMin = updateData.baseSalaryMin ?? existingTable.baseSalaryMin
    const newStepsPerBand = updateData.stepsPerBand ?? existingTable.rankDivision
    const newBandIncreaseRate = updateData.bandIncreaseRate ?? existingTable.increaseRate
    const newInitialStepDiff = updateData.initialStepDiff ?? existingTable.initialStepDiff
    const newSalaryBandCount = updateData.salaryBandCount ?? existingTable.totalRanks

    // 計算結果MAXを取得
    const calculatedMax = paramsChanged
      ? calculateBaseSalaryMax({
          baseSalaryMin: newBaseSalaryMin,
          initialStepDiff: newInitialStepDiff,
          bandIncreaseRate: newBandIncreaseRate,
          stepsPerBand: newStepsPerBand,
          salaryBandCount: newSalaryBandCount,
        })
      : existingTable.baseSalaryMax

    const result = await prisma.$transaction(async (tx) => {
      // 号俸テーブルを更新
      const updatedTable = await tx.salaryTable.update({
        where: { id },
        data: {
          name: updateData.name,
          baseSalaryMax: calculatedMax,
          baseSalaryMin: updateData.baseSalaryMin,
          rankDivision: updateData.stepsPerBand,
          increaseRate: updateData.bandIncreaseRate,
          initialStepDiff: updateData.initialStepDiff,
          totalRanks: updateData.salaryBandCount,
          isActive: updateData.isActive,
        },
      })

      // パラメータが変更された場合はエントリを再生成
      if (paramsChanged) {
        // 既存のエントリを削除
        await tx.salaryTableEntry.deleteMany({
          where: { salaryTableId: id },
        })

        // 新しいエントリを生成
        const entries = generateSalaryTableEntries(
          {
            baseSalaryMin: updatedTable.baseSalaryMin,
            initialStepDiff: updatedTable.initialStepDiff,
            bandIncreaseRate: updatedTable.increaseRate,
            stepsPerBand: updatedTable.rankDivision,
            salaryBandCount: updatedTable.totalRanks,
          },
          grades.map((g) => ({ id: g.id, name: g.name, level: g.level }))
        )

        // エントリを一括作成
        await tx.salaryTableEntry.createMany({
          data: entries.map((entry) => ({
            salaryTableId: id,
            gradeId: entry.gradeId,
            stepNumber: entry.stepNumber,
            rank: entry.rank,
            baseSalary: entry.baseSalary,
          })),
        })
      }

      return updatedTable
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("号俸テーブル更新エラー:", error)
    return NextResponse.json(
      { error: "号俸テーブルの更新に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * DELETE: 号俸テーブル削除
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id } = await params

    const salaryTable = await prisma.salaryTable.findUnique({
      where: { id },
    })

    if (!salaryTable) {
      return NextResponse.json({ error: "号俸テーブルが見つかりません" }, { status: 404 })
    }

    // 削除（Cascade設定によりentriesも自動削除される）
    await prisma.salaryTable.delete({
      where: { id },
    })

    return NextResponse.json({ message: "号俸テーブルを削除しました" })
  } catch (error) {
    console.error("号俸テーブル削除エラー:", error)
    return NextResponse.json(
      { error: "号俸テーブルの削除に失敗しました" },
      { status: 500 }
    )
  }
}
