"use client"

import { useMemo, useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, RotateCcw, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SalaryTableCalculationResult } from "@/lib/salary-table/generator"
import { getRankLettersInRange } from "@/lib/salary-table/generator"

interface Grade {
  id: string
  name: string
  level: number
}

interface AdjustmentRule {
  id?: string
  currentBand: number
  isTransition: boolean
  targetBand: number
  adjustmentValue: number
}

interface SalaryAdjustmentCriteriaProps {
  salaryTableId: string
  calculationResult: SalaryTableCalculationResult
  grades: Grade[]
  rankStartLetter?: string
  rankEndLetter?: string
  onGradeBandChange?: (gradeId: string, startBand: number) => void
}

// ランク文字の色マッピング
const RANK_COLORS: Record<string, string> = {
  S: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  A: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  B: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  C: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  D: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  E: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
}

// デフォルトの調整値を計算するロジック
function calculateDefaultValue(
  currentBand: number,
  isTransition: boolean,
  targetBand: number
): number {
  const baseDiff = targetBand - currentBand
  return isTransition ? baseDiff - 1 : baseDiff
}

export function SalaryAdjustmentCriteria({
  salaryTableId,
  calculationResult,
  grades,
  rankStartLetter = "S",
  rankEndLetter = "D",
  onGradeBandChange,
}: SalaryAdjustmentCriteriaProps) {
  const queryClient = useQueryClient()
  const totalBands = calculationResult.bands.length
  const bandsPerGrade = calculationResult.bandsPerGrade

  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>("")

  // 昇順/降順の切り替え（true=降順: 大きい号俸帯が上）
  const [isDescending, setIsDescending] = useState(true)

  // 等級別の開始号俸帯オーバーライド（ローカルstate）
  const [gradeBandOverrides, setGradeBandOverrides] = useState<Map<string, number>>(new Map())

  // ランク文字リストを取得
  const rankLetters = useMemo(() => {
    return getRankLettersInRange(
      rankStartLetter as "S" | "A" | "B" | "C" | "D" | "E",
      rankEndLetter as "S" | "A" | "B" | "C" | "D" | "E"
    )
  }, [rankStartLetter, rankEndLetter])

  // 等級をレベルの降順でソート
  const sortedGrades = useMemo(() => {
    return [...grades].sort((a, b) => b.level - a.level)
  }, [grades])

  // 号俸帯番号の配列を生成（1〜totalBands）
  const bandNumbers = useMemo(() => {
    return Array.from({ length: totalBands }, (_, i) => i + 1)
  }, [totalBands])

  // 改定マトリクスの行リスト（号俸番号を含む）
  const stepsPerBand = calculationResult.stepsPerBand
  const matrixRows = useMemo(() => {
    const result: Array<{ band: number; isTransition: boolean; label: string; stepRange: string }> = []
    for (const band of bandNumbers) {
      const startStep = (band - 1) * stepsPerBand + 1
      const endStep = band * stepsPerBand
      // 通常行: 号俸範囲を表示（例: 1〜7）
      result.push({
        band,
        isTransition: false,
        label: `${band}`,
        stepRange: `${startStep}〜${endStep - 1}`,
      })
      // T行: 最上位号俸のみ（例: 8）
      result.push({
        band,
        isTransition: true,
        label: `${band}T`,
        stepRange: `${endStep}`,
      })
    }
    // 昇順/降順に応じて並べ替え
    return isDescending ? result.reverse() : result
  }, [bandNumbers, stepsPerBand, isDescending])

  // 等級の開始号俸帯を取得（オーバーライドがあればそれを使用）
  const getGradeStartBand = useCallback((gradeId: string) => {
    if (gradeBandOverrides.has(gradeId)) {
      return gradeBandOverrides.get(gradeId)!
    }
    const assignment = calculationResult.gradeBandAssignments.find(a => a.gradeId === gradeId)
    if (!assignment) return 1
    return Math.ceil(assignment.startStep / calculationResult.stepsPerBand)
  }, [calculationResult, gradeBandOverrides])

  // 等級の号俸帯マッピングを取得
  const getGradeBandMapping = useCallback((gradeId: string) => {
    const startBand = getGradeStartBand(gradeId)
    const mapping = new Map<number, string>()
    const reversedRanks = [...rankLetters].reverse()

    for (let i = 0; i < reversedRanks.length; i++) {
      const bandNum = startBand + i
      if (bandNum <= totalBands) {
        mapping.set(bandNum, reversedRanks[i])
      }
    }

    for (let bandNum = startBand + reversedRanks.length; bandNum <= totalBands; bandNum++) {
      mapping.set(bandNum, "↓")
    }

    return mapping
  }, [getGradeStartBand, rankLetters, totalBands])

  // 等級の開始号俸帯を左に移動
  const handleShiftLeft = useCallback((gradeId: string) => {
    const currentStart = getGradeStartBand(gradeId)
    if (currentStart > 1) {
      const newStart = currentStart - 1
      setGradeBandOverrides(prev => {
        const newMap = new Map(prev)
        newMap.set(gradeId, newStart)
        return newMap
      })
      onGradeBandChange?.(gradeId, newStart)
    }
  }, [getGradeStartBand, onGradeBandChange])

  // 等級の開始号俸帯を右に移動
  const handleShiftRight = useCallback((gradeId: string) => {
    const currentStart = getGradeStartBand(gradeId)
    // 右端に収まる範囲内で移動
    if (currentStart + bandsPerGrade - 1 < totalBands) {
      const newStart = currentStart + 1
      setGradeBandOverrides(prev => {
        const newMap = new Map(prev)
        newMap.set(gradeId, newStart)
        return newMap
      })
      onGradeBandChange?.(gradeId, newStart)
    }
  }, [getGradeStartBand, bandsPerGrade, totalBands, onGradeBandChange])

  // 改定ルールを取得
  const { data: rules = [], isLoading: isLoadingRules } = useQuery<AdjustmentRule[]>({
    queryKey: ["adjustmentRules", salaryTableId],
    queryFn: async () => {
      const res = await fetch(`/api/salary-tables/${salaryTableId}/adjustment-rules`)
      if (!res.ok) throw new Error("改定ルールの取得に失敗しました")
      return res.json()
    },
  })

  // ルールをマップに変換
  const rulesMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const rule of rules) {
      const key = `${rule.currentBand}-${rule.isTransition}-${rule.targetBand}`
      map.set(key, rule.adjustmentValue)
    }
    return map
  }, [rules])

  // ルール更新Mutation
  const updateRulesMutation = useMutation({
    mutationFn: async (newRules: AdjustmentRule[]) => {
      const res = await fetch(`/api/salary-tables/${salaryTableId}/adjustment-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: newRules }),
      })
      if (!res.ok) throw new Error("改定ルールの保存に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adjustmentRules", salaryTableId] })
    },
  })

  // ルール削除Mutation
  const deleteRulesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/salary-tables/${salaryTableId}/adjustment-rules`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("改定ルールのリセットに失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adjustmentRules", salaryTableId] })
    },
  })

  // 値を取得
  const getValue = useCallback((currentBand: number, isTransition: boolean, targetBand: number) => {
    const key = `${currentBand}-${isTransition}-${targetBand}`
    if (rulesMap.has(key)) {
      return rulesMap.get(key)!
    }
    return calculateDefaultValue(currentBand, isTransition, targetBand)
  }, [rulesMap])

  // セルの編集開始
  const handleCellClick = (currentBand: number, isTransition: boolean, targetBand: number) => {
    const key = `${currentBand}-${isTransition}-${targetBand}`
    const currentValue = getValue(currentBand, isTransition, targetBand)
    setEditingCell(key)
    setEditValue(currentValue.toString())
  }

  // 編集値の確定
  const handleEditConfirm = (currentBand: number, isTransition: boolean, targetBand: number) => {
    const newValue = parseInt(editValue)
    if (isNaN(newValue)) {
      setEditingCell(null)
      return
    }

    const defaultValue = calculateDefaultValue(currentBand, isTransition, targetBand)
    const newRules = rules.filter(
      r => !(r.currentBand === currentBand && r.isTransition === isTransition && r.targetBand === targetBand)
    )

    if (newValue !== defaultValue) {
      newRules.push({ currentBand, isTransition, targetBand, adjustmentValue: newValue })
    }

    updateRulesMutation.mutate(newRules)
    setEditingCell(null)
  }

  // 対角線のセルかどうか
  const isDiagonalCell = (currentBand: number, isTransition: boolean, targetBand: number) => {
    if (isTransition) {
      return targetBand === currentBand + 1
    }
    return targetBand === currentBand
  }

  // カスタム値かどうか
  const isCustomValue = (currentBand: number, isTransition: boolean, targetBand: number) => {
    const key = `${currentBand}-${isTransition}-${targetBand}`
    return rulesMap.has(key)
  }

  const isLoading = isLoadingRules || updateRulesMutation.isPending || deleteRulesMutation.isPending

  // 列幅を固定（大きめに設定）
  const firstColWidth = "w-[140px] min-w-[140px]"
  const bandColWidth = "w-[56px] min-w-[56px]"

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">等級別号俸改定基準</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDescending(!isDescending)}
          >
            <ArrowUpDown className="h-3 w-3 mr-1" />
            {isDescending ? "1が下" : "1が上"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => deleteRulesMutation.mutate()}
            disabled={isLoading || rules.length === 0}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            デフォルトに戻す
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingRules ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="text-sm border-collapse">
              {/* 共通ヘッダー */}
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b-2 border-gray-400">
                  <th className={cn("bg-gray-200 dark:bg-gray-700 px-3 py-2 text-left font-semibold border border-gray-300 dark:border-gray-600", firstColWidth)}>
                    等級
                  </th>
                  {bandNumbers.map((band) => (
                    <th
                      key={band}
                      className={cn("bg-gray-200 dark:bg-gray-700 px-2 py-2 text-center font-semibold border border-gray-300 dark:border-gray-600", bandColWidth)}
                    >
                      {band}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 等級×号俸帯マッピング部分 */}
                {sortedGrades.map((grade) => {
                  const bandMapping = getGradeBandMapping(grade.id)
                  const startBand = getGradeStartBand(grade.id)
                  const canShiftLeft = startBand > 1
                  const canShiftRight = startBand + bandsPerGrade - 1 < totalBands

                  return (
                    <tr key={grade.id} className="border-b border-dashed border-gray-300 dark:border-gray-600">
                      <td className={cn("bg-gray-50 dark:bg-gray-800 px-2 py-1.5 font-medium border border-gray-300 dark:border-gray-600", firstColWidth)}>
                        <div className="flex items-center justify-between gap-1">
                          <span className="min-w-[32px]">{grade.name}</span>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleShiftLeft(grade.id)}
                              disabled={!canShiftLeft}
                              className={cn(
                                "p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors",
                                !canShiftLeft && "opacity-30 cursor-not-allowed"
                              )}
                              title="左へ移動"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShiftRight(grade.id)}
                              disabled={!canShiftRight}
                              className={cn(
                                "p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors",
                                !canShiftRight && "opacity-30 cursor-not-allowed"
                              )}
                              title="右へ移動"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                      {bandNumbers.map((band) => {
                        const rankLetter = bandMapping.get(band)
                        const colorClass = rankLetter && rankLetter !== "↓" ? RANK_COLORS[rankLetter] : ""

                        return (
                          <td
                            key={band}
                            className={cn(
                              "px-2 py-2 text-center border border-gray-300 dark:border-gray-600",
                              colorClass,
                              bandColWidth
                            )}
                          >
                            {rankLetter === "↓" ? (
                              <span className="text-gray-400">↓</span>
                            ) : (
                              rankLetter || ""
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* 最下行の↓ */}
                <tr className="border-b-2 border-gray-400">
                  <td className={cn("bg-gray-50 dark:bg-gray-800 px-3 py-2 text-center text-muted-foreground border border-gray-300 dark:border-gray-600", firstColWidth)}>
                    ↓
                  </td>
                  {bandNumbers.map((band) => (
                    <td
                      key={band}
                      className={cn("px-2 py-2 text-center text-muted-foreground border border-gray-300 dark:border-gray-600", bandColWidth)}
                    >
                      ↓
                    </td>
                  ))}
                </tr>

                {/* 改定マトリクス本体 */}
                {matrixRows.map((row, rowIndex) => {
                  // 境界線: 降順ならT行、昇順なら通常行で引く
                  const isBandBoundary = isDescending
                    ? (row.isTransition && rowIndex > 0)
                    : (!row.isTransition && rowIndex > 0)

                  return (
                    <tr
                      key={row.label}
                      className={cn(isBandBoundary && "border-t border-gray-400 dark:border-gray-500")}
                    >
                      <td className={cn("bg-gray-100 dark:bg-gray-800 px-3 py-1.5 font-medium border border-gray-300 dark:border-gray-600", firstColWidth)}>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">{row.stepRange}</span>
                          <span>{row.label}</span>
                        </div>
                      </td>
                      {bandNumbers.map((targetBand) => {
                        const value = getValue(row.band, row.isTransition, targetBand)
                        const isDiagonal = isDiagonalCell(row.band, row.isTransition, targetBand)
                        const isCustom = isCustomValue(row.band, row.isTransition, targetBand)
                        const cellKey = `${row.band}-${row.isTransition}-${targetBand}`
                        const isEditing = editingCell === cellKey

                        let valueColorClass = "text-gray-400"
                        if (value > 0) {
                          valueColorClass = "text-emerald-600 dark:text-emerald-400"
                        } else if (value < 0) {
                          valueColorClass = "text-red-600 dark:text-red-400"
                        }

                        return (
                          <td
                            key={targetBand}
                            className={cn(
                              "px-1 py-1.5 text-center font-mono border border-gray-300 dark:border-gray-600",
                              isDiagonal && "bg-gray-200 dark:bg-gray-700",
                              isCustom && "bg-yellow-50 dark:bg-yellow-900/20",
                              bandColWidth
                            )}
                          >
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleEditConfirm(row.band, row.isTransition, targetBand)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleEditConfirm(row.band, row.isTransition, targetBand)
                                  } else if (e.key === "Escape") {
                                    setEditingCell(null)
                                  }
                                }}
                                className="h-5 w-10 px-1 text-xs text-center"
                                autoFocus
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCellClick(row.band, row.isTransition, targetBand)}
                                className={cn(
                                  "w-full text-center hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer rounded px-1",
                                  valueColorClass
                                )}
                                disabled={isLoading}
                              >
                                {value > 0 ? `+${value}` : value}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          * 等級行の ← → で開始位置を移動、改定値セルをクリックで編集できます
        </p>
      </CardContent>
    </Card>
  )
}
