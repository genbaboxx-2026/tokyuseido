import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  salaryTableUpdateSchema,
  generateSalaryTable,
  entriesToMatrix,
  calculateBaseSalaryMax,
} from "@/lib/salary-table"
import type { SalaryTableChange } from "@/types/salary"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST: 変更時の差分プレビュー（従業員への影響を表示）
 *
 * 【用語マッピング】
 * フォーム → DB
 * - stepsPerBand → rankDivision
 * - bandIncreaseRate → increaseRate
 * - salaryBandCount → totalRanks
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
      include: {
        entries: {
          include: {
            grade: {
              select: { id: true, name: true, level: true },
            },
          },
        },
      },
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

    // 新しいパラメータを計算（新用語 → DB用語マッピング）
    const newBaseSalaryMax = updateData.baseSalaryMax ?? existingTable.baseSalaryMax
    const newBaseSalaryMin = updateData.baseSalaryMin ?? existingTable.baseSalaryMin
    const newStepsPerBand = updateData.stepsPerBand ?? existingTable.rankDivision
    const newBandIncreaseRate = updateData.bandIncreaseRate ?? existingTable.increaseRate
    const newInitialStepDiff = updateData.initialStepDiff ?? existingTable.initialStepDiff
    const newSalaryBandCount = updateData.salaryBandCount ?? existingTable.totalRanks

    // 計算結果MAXを取得
    const calculatedMax = calculateBaseSalaryMax({
      baseSalaryMin: newBaseSalaryMin,
      initialStepDiff: newInitialStepDiff,
      bandIncreaseRate: newBandIncreaseRate,
      stepsPerBand: newStepsPerBand,
      salaryBandCount: newSalaryBandCount,
    })

    const newParams = {
      baseSalaryMax: calculatedMax,
      baseSalaryMin: newBaseSalaryMin,
      stepsPerBand: newStepsPerBand,
      salaryBandCount: newSalaryBandCount,
    }

    // 等級を取得
    const grades = await prisma.grade.findMany({
      where: { companyId: existingTable.companyId },
      orderBy: { level: "desc" },
      select: { id: true, name: true, level: true },
    })

    // 新しいエントリをプレビュー生成
    const previewEntries = generateSalaryTable(
      {
        baseSalaryMax: calculatedMax,
        baseSalaryMin: newBaseSalaryMin,
        stepsPerBand: newStepsPerBand,
        bandIncreaseRate: newBandIncreaseRate,
        initialStepDiff: newInitialStepDiff,
        salaryBandCount: newSalaryBandCount,
      },
      grades.map((g) => ({ id: g.id, name: g.name, level: g.level }))
    )

    // 現在のエントリをマップ化
    const currentEntryMap = new Map<string, { baseSalary: number; rank: string }>()
    for (const entry of existingTable.entries) {
      currentEntryMap.set(`${entry.gradeId}-${entry.stepNumber}`, {
        baseSalary: entry.baseSalary,
        rank: entry.rank,
      })
    }

    // 変更点を抽出
    const changes: SalaryTableChange[] = []
    const gradeNameMap = new Map(grades.map((g) => [g.id, g.name]))

    for (const newEntry of previewEntries) {
      const key = `${newEntry.gradeId}-${newEntry.stepNumber}`
      const currentEntry = currentEntryMap.get(key)

      if (!currentEntry || currentEntry.baseSalary !== newEntry.baseSalary) {
        changes.push({
          gradeId: newEntry.gradeId,
          gradeName: gradeNameMap.get(newEntry.gradeId) || "",
          stepNumber: newEntry.stepNumber,
          rank: newEntry.rank,
          currentBaseSalary: currentEntry?.baseSalary ?? null,
          newBaseSalary: newEntry.baseSalary,
          difference: newEntry.baseSalary - (currentEntry?.baseSalary ?? 0),
        })
      }
    }

    // マトリクス形式に変換
    const currentMatrix = entriesToMatrix(
      existingTable.entries.map((e) => ({
        gradeId: e.gradeId,
        stepNumber: e.stepNumber,
        rank: e.rank,
        baseSalary: e.baseSalary,
      })),
      grades,
      {
        baseSalaryMax: existingTable.baseSalaryMax,
        baseSalaryMin: existingTable.baseSalaryMin,
        stepsPerBand: existingTable.rankDivision,
        salaryBandCount: existingTable.totalRanks,
      }
    )

    const previewMatrix = entriesToMatrix(previewEntries, grades, newParams)

    // 影響を受ける従業員を取得
    const employees = await prisma.employee.findMany({
      where: {
        companyId: existingTable.companyId,
        baseSalary: { not: null },
        gradeId: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        baseSalary: true,
        gradeId: true,
        grade: {
          select: { name: true },
        },
      },
    })

    // 従業員への影響を計算
    const employeeImpacts = employees.map((emp) => {
      // 現在の位置
      const currentEntries = existingTable.entries.filter((e) => e.gradeId === emp.gradeId)
      let currentPosition: { stepNumber: number; rank: string } | null = null
      let minDiff = Infinity

      for (const entry of currentEntries) {
        const diff = Math.abs(entry.baseSalary - (emp.baseSalary || 0))
        if (diff < minDiff) {
          minDiff = diff
          currentPosition = { stepNumber: entry.stepNumber, rank: entry.rank }
        }
      }

      // 新しい位置
      const newEntries = previewEntries.filter((e) => e.gradeId === emp.gradeId)
      let newPosition: { stepNumber: number; rank: string; baseSalary: number } | null = null
      minDiff = Infinity

      for (const entry of newEntries) {
        const diff = Math.abs(entry.baseSalary - (emp.baseSalary || 0))
        if (diff < minDiff) {
          minDiff = diff
          newPosition = { stepNumber: entry.stepNumber, rank: entry.rank, baseSalary: entry.baseSalary }
        }
      }

      return {
        employeeId: emp.id,
        employeeName: `${emp.lastName} ${emp.firstName}`,
        gradeName: emp.grade?.name || "",
        currentBaseSalary: emp.baseSalary || 0,
        currentStep: currentPosition?.stepNumber || null,
        currentRank: currentPosition?.rank || null,
        newStep: newPosition?.stepNumber || null,
        newRank: newPosition?.rank || null,
        tableBaseSalary: newPosition?.baseSalary || null,
        difference: (newPosition?.baseSalary || 0) - (emp.baseSalary || 0),
      }
    })

    return NextResponse.json({
      current: {
        salaryTable: {
          ...existingTable,
          // 新用語でレスポンス
          stepsPerBand: existingTable.rankDivision,
          bandIncreaseRate: existingTable.increaseRate,
          salaryBandCount: existingTable.totalRanks,
        },
        grades,
        rows: currentMatrix,
      },
      preview: {
        salaryTable: {
          ...existingTable,
          baseSalaryMax: calculatedMax,
          baseSalaryMin: newBaseSalaryMin,
          stepsPerBand: newStepsPerBand,
          bandIncreaseRate: newBandIncreaseRate,
          initialStepDiff: newInitialStepDiff,
          salaryBandCount: newSalaryBandCount,
        },
        grades,
        rows: previewMatrix,
      },
      changes,
      employeeImpacts: employeeImpacts.filter((e) => e.difference !== 0),
      summary: {
        totalChanges: changes.length,
        affectedEmployees: employeeImpacts.filter((e) => e.difference !== 0).length,
        totalEmployees: employees.length,
      },
    })
  } catch (error) {
    console.error("プレビュー生成エラー:", error)
    return NextResponse.json(
      { error: "プレビューの生成に失敗しました" },
      { status: 500 }
    )
  }
}
