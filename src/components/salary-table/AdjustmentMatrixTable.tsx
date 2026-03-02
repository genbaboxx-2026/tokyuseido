"use client"

import { useMemo, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RotateCcw } from "lucide-react"

interface AdjustmentRule {
  currentBand: number
  isTransition: boolean
  targetBand: number
  adjustmentValue: number
}

interface AdjustmentMatrixTableProps {
  totalBands: number
  rules: AdjustmentRule[]
  onRulesChange: (rules: AdjustmentRule[]) => void
  onResetToDefault: () => void
  isLoading?: boolean
}

// デフォルトの調整値を計算するロジック
// 対角線（currentBand == targetBand）が基準で0
// 右に行くほど+1、左に行くほど-1
// Tランクは通常ランクより1少ない
function calculateDefaultValue(
  currentBand: number,
  isTransition: boolean,
  targetBand: number
): number {
  const baseDiff = targetBand - currentBand
  // Tランクは1少ない
  return isTransition ? baseDiff - 1 : baseDiff
}

export function AdjustmentMatrixTable({
  totalBands,
  rules,
  onRulesChange,
  onResetToDefault,
  isLoading = false,
}: AdjustmentMatrixTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>("")

  // 号俸帯番号の配列を生成（1〜totalBands）
  const bandNumbers = useMemo(() => {
    return Array.from({ length: totalBands }, (_, i) => i + 1)
  }, [totalBands])

  // 行のリスト: [{ band: 1, isTransition: false }, { band: 1, isTransition: true }, ...]
  const rows = useMemo(() => {
    const result: Array<{ band: number; isTransition: boolean; label: string }> = []
    for (const band of bandNumbers) {
      result.push({ band, isTransition: false, label: `${band}` })
      result.push({ band, isTransition: true, label: `${band}T` })
    }
    return result
  }, [bandNumbers])

  // ルールをマップに変換してO(1)でアクセスできるようにする
  const rulesMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const rule of rules) {
      const key = `${rule.currentBand}-${rule.isTransition}-${rule.targetBand}`
      map.set(key, rule.adjustmentValue)
    }
    return map
  }, [rules])

  // 値を取得（カスタム値があればそれを使用、なければデフォルト）
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

    // デフォルト値と同じならルールから削除、違えばルールに追加/更新
    const newRules = rules.filter(
      r => !(r.currentBand === currentBand && r.isTransition === isTransition && r.targetBand === targetBand)
    )

    if (newValue !== defaultValue) {
      newRules.push({
        currentBand,
        isTransition,
        targetBand,
        adjustmentValue: newValue,
      })
    }

    onRulesChange(newRules)
    setEditingCell(null)
  }

  // 対角線のセルかどうか（背景色用）
  const isDiagonalCell = (currentBand: number, isTransition: boolean, targetBand: number) => {
    if (isTransition) {
      // Tランクの対角線は targetBand = currentBand + 1 のとき0
      return targetBand === currentBand + 1
    }
    return targetBand === currentBand
  }

  // カスタム値かどうか
  const isCustomValue = (currentBand: number, isTransition: boolean, targetBand: number) => {
    const key = `${currentBand}-${isTransition}-${targetBand}`
    return rulesMap.has(key)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">評価レート×現賃金ランク 改定値マトリクス</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onResetToDefault}
          disabled={isLoading || rules.length === 0}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          デフォルトに戻す
        </Button>
      </div>
      <div className="overflow-auto max-h-[500px]">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b-2 border-gray-400">
              <th className="sticky left-0 z-20 bg-gray-200 dark:bg-gray-700 px-1 py-1.5 text-center font-semibold min-w-[60px] border border-gray-300 dark:border-gray-600">
                <div className="text-[10px]">評価レート</div>
                <div>現賃金ランク</div>
              </th>
              {bandNumbers.map((band) => (
                <th
                  key={band}
                  className="bg-gray-200 dark:bg-gray-700 px-1 py-1.5 text-center font-semibold min-w-[36px] border border-gray-300 dark:border-gray-600"
                >
                  帯{band}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              // 号俸帯が変わる境界線
              const isBandBoundary = !row.isTransition && rowIndex > 0

              return (
                <tr
                  key={row.label}
                  className={cn(
                    isBandBoundary && "border-t border-gray-400 dark:border-gray-500"
                  )}
                >
                  <td className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-center font-medium border border-gray-300 dark:border-gray-600">
                    {row.label}
                  </td>
                  {bandNumbers.map((targetBand) => {
                    const value = getValue(row.band, row.isTransition, targetBand)
                    const isDiagonal = isDiagonalCell(row.band, row.isTransition, targetBand)
                    const isCustom = isCustomValue(row.band, row.isTransition, targetBand)
                    const cellKey = `${row.band}-${row.isTransition}-${targetBand}`
                    const isEditing = editingCell === cellKey

                    // 値の色
                    let valueColorClass = "text-gray-400" // 0はグレー
                    if (value > 0) {
                      valueColorClass = "text-emerald-600 dark:text-emerald-400"
                    } else if (value < 0) {
                      valueColorClass = "text-red-600 dark:text-red-400"
                    }

                    return (
                      <td
                        key={targetBand}
                        className={cn(
                          "px-0.5 py-0.5 text-center font-mono border border-gray-300 dark:border-gray-600",
                          isDiagonal && "bg-gray-200 dark:bg-gray-700",
                          isCustom && "bg-yellow-50 dark:bg-yellow-900/20"
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
      <p className="text-xs text-muted-foreground">
        * セルをクリックして値を編集できます。背景が黄色のセルはカスタム値です。
      </p>
    </div>
  )
}
