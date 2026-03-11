"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { SalaryTableCalculationResult } from "@/lib/salary-table/generator"
import { EmployeeDetailModal } from "@/components/employees/EmployeeDetailModal"

interface Grade {
  id: string
  name: string
  level: number
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  gradeId: string | null
  baseSalary: number | null
  gradeName?: string
}

interface SalaryTableSpreadsheetProps {
  calculationResult: SalaryTableCalculationResult
  grades: Grade[]
  employees?: Employee[]
}

export function SalaryTableSpreadsheet({
  calculationResult,
  grades,
  employees = [],
}: SalaryTableSpreadsheetProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleEmployeeClick = (employeeId: string) => {
    setSelectedEmployeeId(employeeId)
    setIsModalOpen(true)
  }

  const formatCurrency = (value: number) => {
    return "¥" + new Intl.NumberFormat("ja-JP").format(value)
  }

  // 等級をレベルの降順でソート（正①が最上位）
  const sortedGrades = useMemo(() => {
    return [...grades].sort((a, b) => b.level - a.level)
  }, [grades])

  // 号俸列を降順でソート（最上位から）
  const sortedLadder = useMemo(() => {
    return [...calculationResult.salaryLadder].sort((a, b) => b.stepNumber - a.stepNumber)
  }, [calculationResult.salaryLadder])

  // 各等級の号俸範囲を取得
  const gradeStepRanges = useMemo(() => {
    const ranges = new Map<string, { startStep: number; endStep: number; rankBands: { rank: string; bandNumber: number }[] }>()
    for (const assignment of calculationResult.gradeBandAssignments) {
      ranges.set(assignment.gradeId, {
        startStep: assignment.startStep,
        endStep: assignment.endStep,
        rankBands: assignment.rankBands,
      })
    }
    return ranges
  }, [calculationResult.gradeBandAssignments])

  // 号俸から等級のランク名を取得する関数
  const getGradeRankForStep = (gradeId: string, stepNumber: number): string | null => {
    const range = gradeStepRanges.get(gradeId)
    if (!range || stepNumber < range.startStep || stepNumber > range.endStep) {
      return null
    }

    // この号俸が属する号俸帯を計算
    const bandNumber = Math.ceil(stepNumber / calculationResult.stepsPerBand)

    // 号俸帯内での位置（1-indexed、上から）
    const positionInBand = calculationResult.stepsPerBand - ((stepNumber - 1) % calculationResult.stepsPerBand)

    // この号俸帯に対応するランク文字を検索
    const rankBand = range.rankBands.find(rb => rb.bandNumber === bandNumber)
    if (!rankBand) return null

    return `${rankBand.rank}${positionInBand}`
  }

  // 号俸番号が指定した等級の範囲内に含まれるかチェック
  const isStepInGradeRange = (stepNumber: number, gradeId: string): boolean => {
    const assignment = calculationResult.gradeBandAssignments.find(a => a.gradeId === gradeId)
    if (!assignment) return false
    return stepNumber >= assignment.startStep && stepNumber <= assignment.endStep
  }

  // 号俸番号から該当する等級を全て取得（オーバーラップ考慮）
  const getGradesForStep = (stepNumber: number): Grade[] => {
    const matchingGrades: Grade[] = []
    for (const assignment of calculationResult.gradeBandAssignments) {
      if (stepNumber >= assignment.startStep && stepNumber <= assignment.endStep) {
        const grade = grades.find(g => g.id === assignment.gradeId)
        if (grade) matchingGrades.push(grade)
      }
    }
    return matchingGrades
  }

  // 従業員情報（ミスマッチ情報付き）
  type RangeStatus = "ok" | "above_max" | "below_min" | "grade_mismatch"
  
  interface EmployeeWithMismatch extends Employee {
    targetStep: number
    tableGrades: Grade[]
    isMismatch: boolean
    rangeStatus: RangeStatus
    gradeMinSalary: number | null
    gradeMaxSalary: number | null
  }

  // 従業員を号俸でグループ化（等級関係なく、現基本給以上で最も低い号俸を検索）
  const employeesByStep = useMemo(() => {
    const map = new Map<number, EmployeeWithMismatch[]>()

    for (const emp of employees) {
      if (!emp.baseSalary || !emp.gradeId) continue

      // 従業員の等級のレンジを取得
      const empGradeAssignment = calculationResult.gradeBandAssignments.find(a => a.gradeId === emp.gradeId)
      const gradeMinSalary = empGradeAssignment?.minSalary ?? null
      const gradeMaxSalary = empGradeAssignment?.maxSalary ?? null

      // 号俸テーブル全体から現基本給以上の号俸を昇順でソート
      const eligibleSteps = calculationResult.salaryLadder
        .filter(step => step.baseSalary >= emp.baseSalary)
        .sort((a, b) => a.baseSalary - b.baseSalary)

      let targetStep: number | null = null

      if (eligibleSteps.length > 0) {
        // 現基本給以上で最も低い号俸を選択
        targetStep = eligibleSteps[0].stepNumber
      } else {
        // 現基本給以上の号俸がない場合、テーブルの最高号俸を選択
        const maxStep = calculationResult.salaryLadder.sort((a, b) => b.baseSalary - a.baseSalary)[0]
        targetStep = maxStep?.stepNumber ?? null
      }

      if (targetStep !== null) {
        // この号俸が属する等級を全て取得
        const tableGrades = getGradesForStep(targetStep)
        
        // ミスマッチ判定：従業員の等級が、当てはまった号俸の範囲に含まれているか
        const isMismatch = !isStepInGradeRange(targetStep, emp.gradeId)

        // レンジ状態を判定
        let rangeStatus: RangeStatus = "ok"
        if (isMismatch) {
          rangeStatus = "grade_mismatch"
        } else if (gradeMaxSalary !== null && emp.baseSalary > gradeMaxSalary) {
          rangeStatus = "above_max"
        } else if (gradeMinSalary !== null && emp.baseSalary < gradeMinSalary) {
          rangeStatus = "below_min"
        }

        const empWithMismatch: EmployeeWithMismatch = {
          ...emp,
          targetStep,
          tableGrades,
          isMismatch,
          rangeStatus,
          gradeMinSalary,
          gradeMaxSalary,
        }

        const existing = map.get(targetStep) || []
        existing.push(empWithMismatch)
        map.set(targetStep, existing)
      }
    }

    return map
  }, [employees, calculationResult.salaryLadder, calculationResult.gradeBandAssignments, grades])

  // 号俸帯表示を生成（号俸帯番号 + T/通常）
  const getBandDisplay = (stepNumber: number): string => {
    const bandNumber = Math.ceil(stepNumber / calculationResult.stepsPerBand)
    const positionInBand = ((stepNumber - 1) % calculationResult.stepsPerBand) + 1

    // 号俸帯の最後のステップの場合はTを付ける
    if (positionInBand === calculationResult.stepsPerBand) {
      return `${bandNumber}T`
    }
    return `${bandNumber}`
  }

  // 号俸帯の境界行かどうか（最下位ステップ = ステップ番号が号俸帯の最初）
  const isBandBoundaryRow = (stepNumber: number): boolean => {
    // 号俸帯の最下位（stepNumber % stepsPerBand === 1）が境界
    // ただし降順表示なので、号俸帯の最上位ステップが表示上の最後
    const positionInBand = ((stepNumber - 1) % calculationResult.stepsPerBand) + 1
    return positionInBand === calculationResult.stepsPerBand
  }

  // 号俸帯番号を取得
  const getBandNumber = (stepNumber: number): number => {
    return Math.ceil(stepNumber / calculationResult.stepsPerBand)
  }

  // 号俸帯情報を取得
  const getBandInfo = (stepNumber: number) => {
    const bandNumber = getBandNumber(stepNumber)
    return calculationResult.bands.find(b => b.bandNumber === bandNumber)
  }

  // 増加額を計算（前の号俸帯との号差の差）
  const getIncreaseAmount = (bandNumber: number): number | null => {
    if (bandNumber <= 1) return null
    const currentBand = calculationResult.bands.find(b => b.bandNumber === bandNumber)
    const prevBand = calculationResult.bands.find(b => b.bandNumber === bandNumber - 1)
    if (!currentBand || !prevBand) return null
    return currentBand.stepDiff - prevBand.stepDiff
  }

  // 増加率を計算
  const getIncreaseRate = (bandNumber: number): number | null => {
    if (bandNumber <= 1) return null
    const currentBand = calculationResult.bands.find(b => b.bandNumber === bandNumber)
    const prevBand = calculationResult.bands.find(b => b.bandNumber === bandNumber - 1)
    if (!currentBand || !prevBand || prevBand.stepDiff === 0) return null
    return currentBand.stepDiff / prevBand.stepDiff
  }

  return (
    <div className="overflow-auto max-h-[calc(100vh-200px)]">
      <table className="w-full text-xs border-collapse">
        {/* 2段ヘッダー */}
        <thead className="sticky top-0 z-20 bg-background">
          {/* 1段目 */}
          <tr className="border-b">
            <th className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 px-2 py-1 border-r" />
            <th className="sticky left-[50px] z-30 bg-gray-100 dark:bg-gray-800 px-2 py-1 border-r" />
            <th className="bg-gray-100 dark:bg-gray-800 px-2 py-1 border-r" />
            <th className="bg-gray-100 dark:bg-gray-800 px-2 py-1 border-r" />
            <th className="bg-gray-100 dark:bg-gray-800 px-2 py-1 border-r" />
            <th className="bg-gray-100 dark:bg-gray-800 px-2 py-1 border-r" />
            <th className="bg-gray-100 dark:bg-gray-800 px-2 py-1 border-r" />
            <th className="bg-gray-100 dark:bg-gray-800 px-2 py-1 border-r" />
            <th
              colSpan={sortedGrades.length}
              className="bg-blue-100 dark:bg-blue-900 px-2 py-1 text-center font-semibold border-r"
            >
              等級ランク
            </th>
            <th className="bg-gray-100 dark:bg-gray-800 px-2 py-1" />
          </tr>
          {/* 2段目 */}
          <tr className="border-b-2 border-gray-400">
            <th className="sticky left-0 z-30 bg-gray-200 dark:bg-gray-700 px-2 py-1.5 text-center font-semibold min-w-[50px] border-r">
              号俸
            </th>
            <th className="sticky left-[50px] z-30 bg-gray-200 dark:bg-gray-700 px-2 py-1.5 text-center font-semibold min-w-[50px] border-r">
              号俸帯
            </th>
            <th className="bg-gray-200 dark:bg-gray-700 px-2 py-1.5 text-right font-semibold min-w-[90px] border-r">
              基本給（月）
            </th>
            <th className="bg-gray-200 dark:bg-gray-700 px-2 py-1.5 text-right font-semibold min-w-[100px] border-r">
              基本給（総支給）
            </th>
            <th className="bg-gray-200 dark:bg-gray-700 px-2 py-1.5 text-right font-semibold min-w-[70px] border-r">
              号差（円）
            </th>
            <th className="bg-gray-200 dark:bg-gray-700 px-2 py-1.5 text-right font-semibold min-w-[60px] border-r">
              増加額
            </th>
            <th className="bg-gray-200 dark:bg-gray-700 px-2 py-1.5 text-right font-semibold min-w-[60px] border-r">
              増加率
            </th>
            <th className="bg-amber-100 dark:bg-amber-900/50 px-2 py-1.5 text-center font-semibold min-w-[140px] border-r">
              該当者(現給与ベース)
            </th>
            {sortedGrades.map((grade) => (
              <th
                key={grade.id}
                className="bg-blue-50 dark:bg-blue-900/50 px-2 py-1.5 text-center font-semibold min-w-[50px] border-r"
              >
                {grade.name}
              </th>
            ))}
            <th className="bg-red-100 dark:bg-red-900/50 px-2 py-1.5 text-center font-semibold min-w-[100px]">
              等級確認
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedLadder.map((step, index) => {
            const bandNumber = getBandNumber(step.stepNumber)
            const isBoundary = isBandBoundaryRow(step.stepNumber)
            const bandInfo = getBandInfo(step.stepNumber)
            const increaseAmount = isBoundary ? getIncreaseAmount(bandNumber) : null
            const increaseRate = isBoundary ? getIncreaseRate(bandNumber) : null
            const stepEmployees = employeesByStep.get(step.stepNumber) || []

            // 号俸帯で交互に背景色を変える
            const isOddBand = bandNumber % 2 === 1
            const rowBgClass = isOddBand ? "bg-white dark:bg-gray-950" : "bg-gray-50 dark:bg-gray-900"

            // 境界行のスタイル（太め）、通常行は薄い線
            const borderClass = isBoundary
              ? "border-t border-gray-400 dark:border-gray-500"
              : "border-t border-gray-200 dark:border-gray-800"

            return (
              <tr key={step.stepNumber} className={cn(rowBgClass, borderClass)}>
                {/* 号俸 */}
                <td className={cn(
                  "sticky left-0 z-10 px-2 py-0.5 text-center font-mono border-r",
                  rowBgClass
                )}>
                  {step.stepNumber}
                </td>
                {/* 号俸帯 */}
                <td className={cn(
                  "sticky left-[50px] z-10 px-2 py-0.5 text-center font-mono border-r",
                  rowBgClass
                )}>
                  {getBandDisplay(step.stepNumber)}
                </td>
                {/* 基本給（月） */}
                <td className="px-2 py-0.5 text-right font-mono border-r">
                  {formatCurrency(step.baseSalary)}
                </td>
                {/* 基本給（総支給）- 年収で表示 */}
                <td className="px-2 py-0.5 text-right font-mono border-r">
                  {formatCurrency(step.annualSalary)}
                </td>
                {/* 号差（円）- 境界行のみ */}
                <td className="px-2 py-0.5 text-right font-mono border-r">
                  {isBoundary && bandInfo ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {bandInfo.stepDiff.toLocaleString()}
                    </span>
                  ) : null}
                </td>
                {/* 増加額 - 境界行のみ */}
                <td className="px-2 py-0.5 text-right font-mono border-r">
                  {increaseAmount !== null ? (
                    <span className="text-blue-600 dark:text-blue-400">
                      {increaseAmount.toLocaleString()}
                    </span>
                  ) : null}
                </td>
                {/* 増加率 - 境界行のみ */}
                <td className="px-2 py-0.5 text-right font-mono border-r">
                  {increaseRate !== null ? (
                    <span className="text-purple-600 dark:text-purple-400">
                      {increaseRate.toFixed(3)}
                    </span>
                  ) : null}
                </td>
                {/* 該当者 */}
                <td className="px-2 py-0.5 text-center text-xs border-r bg-amber-50/50 dark:bg-amber-900/20">
                  {stepEmployees.length > 0 ? (
                    <div className="flex flex-col gap-0.5 items-center">
                      {stepEmployees.map((emp) => {
                        const gradeName = grades.find(g => g.id === emp.gradeId)?.name || ""
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => handleEmployeeClick(emp.id)}
                            className="whitespace-nowrap hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
                          >
                            {gradeName}：{emp.lastName} {emp.firstName}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </td>
                {/* 等級ランク列 */}
                {sortedGrades.map((grade) => {
                  const rankName = getGradeRankForStep(grade.id, step.stepNumber)
                  return (
                    <td key={grade.id} className="px-2 py-0.5 text-center font-mono border-r">
                      {rankName ? (
                        <span className="text-gray-700 dark:text-gray-300">
                          {rankName}
                        </span>
                      ) : null}
                    </td>
                  )
                })}
                {/* 等級確認列 */}
                <td className="px-2 py-0.5 text-left text-xs">
                  {stepEmployees.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {stepEmployees.map((emp) => {
                        const empGradeName = grades.find(g => g.id === emp.gradeId)?.name || ""
                        const tableGradeNames = emp.tableGrades.map(g => g.name).join("/") || "範囲外"
                        
                        switch (emp.rangeStatus) {
                          case "ok":
                            return (
                              <span
                                key={emp.id}
                                className="whitespace-nowrap text-green-600 dark:text-green-400"
                              >
                                ✓{emp.lastName}
                              </span>
                            )
                          case "above_max":
                            return (
                              <span
                                key={emp.id}
                                className="whitespace-nowrap text-orange-600 dark:text-orange-400 font-medium"
                              >
                                ⚠{emp.lastName} 上限超過
                              </span>
                            )
                          case "below_min":
                            return (
                              <span
                                key={emp.id}
                                className="whitespace-nowrap text-blue-600 dark:text-blue-400 font-medium"
                              >
                                ⚠{emp.lastName} 下限不足
                              </span>
                            )
                          case "grade_mismatch":
                            return (
                              <span
                                key={emp.id}
                                className="whitespace-nowrap text-red-600 dark:text-red-400 font-medium"
                              >
                                ⚠{emp.lastName} 役割:{empGradeName}→給与:{tableGradeNames}
                              </span>
                            )
                        }
                      })}
                    </div>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <EmployeeDetailModal
        employeeId={selectedEmployeeId}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  )
}
