"use client"

import { useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { SALARY_TABLE_UI_TEXT, getRankZone } from "@/lib/salary-table"
import type { SalaryTableMatrixRow } from "@/types/salary"

interface Grade {
  id: string
  name: string
  level: number
}

interface SalaryTableMatrixProps {
  grades: Grade[]
  rows: SalaryTableMatrixRow[]
  showAnnualSalary?: boolean
  highlightGradeId?: string
  highlightStepNumber?: number
  compactMode?: boolean
  showZoneBoundaries?: boolean
}

// ゾーンのバッジ色（テキスト用）
const ZONE_COLORS: Record<string, string> = {
  S: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  A: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  B: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  C: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  D: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  E: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  F: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
}

// ゾーンの行背景色
const ZONE_ROW_COLORS: Record<string, string> = {
  S: "bg-green-50 dark:bg-green-950/30",
  A: "bg-blue-50 dark:bg-blue-950/30",
  B: "bg-yellow-50 dark:bg-yellow-950/30",
  C: "bg-orange-50 dark:bg-orange-950/30",
  D: "bg-red-50 dark:bg-red-950/30",
  E: "bg-purple-50 dark:bg-purple-950/30",
  F: "bg-gray-50 dark:bg-gray-950/30",
}

// ゾーン境界線スタイル
const ZONE_BOUNDARY_STYLE = "border-t-2 border-t-gray-400 dark:border-t-gray-600"

export function SalaryTableMatrix({
  grades,
  rows,
  showAnnualSalary = false,
  highlightGradeId,
  highlightStepNumber,
  compactMode = false,
  showZoneBoundaries = true,
}: SalaryTableMatrixProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP").format(value)
  }

  // 等級をレベルの降順でソート
  const sortedGrades = useMemo(() => {
    return [...grades].sort((a, b) => b.level - a.level)
  }, [grades])

  // ゾーン境界を計算（各ゾーンの最初の行を特定）
  const zoneBoundaryRows = useMemo(() => {
    const boundaries = new Set<number>()
    let previousZone: string | null = null

    for (let i = 0; i < rows.length; i++) {
      const currentZone = getRankZone(rows[i].rank)
      if (previousZone !== null && previousZone !== currentZone) {
        boundaries.add(rows[i].stepNumber)
      }
      previousZone = currentZone
    }

    return boundaries
  }, [rows])

  // 各ゾーンの開始行インデックスを計算（ゾーンラベル表示用）
  const zoneStartRows = useMemo(() => {
    const starts = new Map<string, number>()
    let previousZone: string | null = null

    for (let i = 0; i < rows.length; i++) {
      const currentZone = getRankZone(rows[i].rank)
      if (!starts.has(currentZone)) {
        starts.set(currentZone, rows[i].stepNumber)
      }
      previousZone = currentZone
    }

    return starts
  }, [rows])

  // 各ゾーンの行数を計算
  const zoneRowCounts = useMemo(() => {
    const counts = new Map<string, number>()

    for (const row of rows) {
      const zone = getRankZone(row.rank)
      counts.set(zone, (counts.get(zone) || 0) + 1)
    }

    return counts
  }, [rows])

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {SALARY_TABLE_UI_TEXT.NO_DATA}
      </div>
    )
  }

  // コンパクトモードの場合は行数を制限
  const displayRows = compactMode ? rows.slice(0, 20) : rows

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background min-w-[80px]">
              {SALARY_TABLE_UI_TEXT.STEP_NUMBER}
            </TableHead>
            <TableHead className="sticky left-[80px] z-10 bg-background min-w-[80px]">
              {SALARY_TABLE_UI_TEXT.RANK}
            </TableHead>
            {sortedGrades.map((grade) => (
              <TableHead
                key={grade.id}
                className={cn(
                  "text-center min-w-[120px]",
                  highlightGradeId === grade.id && "bg-primary/10"
                )}
              >
                {grade.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map((row) => {
            const zone = getRankZone(row.rank)
            const isHighlightedStep = highlightStepNumber === row.stepNumber
            const isZoneBoundary = showZoneBoundaries && zoneBoundaryRows.has(row.stepNumber)
            const isZoneStart = zoneStartRows.get(zone) === row.stepNumber
            const zoneRowCount = zoneRowCounts.get(zone) || 1

            return (
              <TableRow
                key={row.stepNumber}
                className={cn(
                  isHighlightedStep && "bg-primary/5",
                  showZoneBoundaries && ZONE_ROW_COLORS[zone],
                  isZoneBoundary && ZONE_BOUNDARY_STYLE
                )}
              >
                <TableCell
                  className={cn(
                    "sticky left-0 z-10 font-medium",
                    showZoneBoundaries ? ZONE_ROW_COLORS[zone] : "bg-background",
                    isZoneBoundary && ZONE_BOUNDARY_STYLE
                  )}
                >
                  {row.stepNumber}
                </TableCell>
                <TableCell
                  className={cn(
                    "sticky left-[80px] z-10",
                    showZoneBoundaries ? ZONE_ROW_COLORS[zone] : "bg-background",
                    isZoneBoundary && ZONE_BOUNDARY_STYLE
                  )}
                >
                  <Badge variant="outline" className={cn("font-mono", ZONE_COLORS[zone])}>
                    {row.rank}
                  </Badge>
                </TableCell>
                {sortedGrades.map((grade) => {
                  const entry = row.entries.find((e) => e.gradeId === grade.id)
                  const isHighlighted =
                    highlightGradeId === grade.id && highlightStepNumber === row.stepNumber

                  return (
                    <TableCell
                      key={grade.id}
                      className={cn(
                        "text-right",
                        highlightGradeId === grade.id && "bg-primary/10",
                        isHighlighted && "bg-primary/20 font-bold",
                        isZoneBoundary && ZONE_BOUNDARY_STYLE
                      )}
                    >
                      {entry ? (
                        <div className="flex flex-col">
                          <span>{formatCurrency(entry.baseSalary)}</span>
                          {showAnnualSalary && (
                            <span className="text-xs text-muted-foreground">
                              ({formatCurrency(entry.annualSalary)}{SALARY_TABLE_UI_TEXT.ANNUALLY})
                            </span>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {compactMode && rows.length > 20 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          他 {rows.length - 20} 行...
        </div>
      )}

      {/* 凡例 */}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {/* 使用されているゾーンのみ表示 */}
        {Array.from(zoneRowCounts.keys()).map((zone) => (
          <Badge key={zone} variant="outline" className={cn("font-mono", ZONE_COLORS[zone])}>
            {zone}ゾーン ({zoneRowCounts.get(zone)}行)
          </Badge>
        ))}
      </div>

      {/* ゾーン境界表示の説明 */}
      {showZoneBoundaries && (
        <div className="mt-2 text-xs text-muted-foreground">
          * 太い線はゾーン境界を示しています
        </div>
      )}
    </div>
  )
}
