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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { SALARY_TABLE_UI_TEXT, getRankZone } from "@/lib/salary-table"
import type { SalaryStepDetail } from "@/lib/salary-table/generator"

interface Grade {
  id: string
  name: string
  level: number
}

interface GradeRange {
  min: number
  max: number
  startStep: number
  endStep: number
}

interface SalaryTableDetailViewProps {
  steps: SalaryStepDetail[]
  grades: Grade[]
  gradeRanges?: Map<string, GradeRange>
  baseSalaryMin: number
  baseSalaryMax: number
  totalSteps: number
  stepsPerBand: number  // 号俸帯内ステップ数
}

// ゾーンのバッジ色
const ZONE_COLORS: Record<string, string> = {
  S: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  A: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  B: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  C: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  D: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  E: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  F: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
}

// ゾーンの行背景色
const ZONE_ROW_COLORS: Record<string, string> = {
  S: "bg-green-50/50 dark:bg-green-950/20",
  A: "bg-blue-50/50 dark:bg-blue-950/20",
  B: "bg-yellow-50/50 dark:bg-yellow-950/20",
  C: "bg-orange-50/50 dark:bg-orange-950/20",
  D: "bg-red-50/50 dark:bg-red-950/20",
  E: "bg-purple-50/50 dark:bg-purple-950/20",
  F: "bg-gray-50/50 dark:bg-gray-950/20",
}

export function SalaryTableDetailView({
  steps,
  grades,
  gradeRanges,
  baseSalaryMin,
  baseSalaryMax,
  totalSteps,
  stepsPerBand,
}: SalaryTableDetailViewProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP").format(value)
  }

  const formatRate = (value: number) => {
    if (value === 0) return "-"
    return value.toFixed(3)
  }

  // 等級をレベルの降順でソート（高い等級から）
  const sortedGrades = useMemo(() => {
    return [...grades].sort((a, b) => b.level - a.level)
  }, [grades])

  // ゾーン境界を計算
  const zoneBoundarySteps = useMemo(() => {
    const boundaries = new Set<number>()
    let previousZone: string | null = null

    for (const step of steps) {
      const currentZone = getRankZone(step.rank)
      if (previousZone !== null && previousZone !== currentZone) {
        boundaries.add(step.stepNumber)
      }
      previousZone = currentZone
    }

    return boundaries
  }, [steps])

  if (steps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {SALARY_TABLE_UI_TEXT.NO_DATA}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(baseSalaryMin)}</div>
            <p className="text-xs text-muted-foreground">{SALARY_TABLE_UI_TEXT.BASE_SALARY_MIN}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(baseSalaryMax)}</div>
            <p className="text-xs text-muted-foreground">{SALARY_TABLE_UI_TEXT.BASE_SALARY_MAX}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalSteps}</div>
            <p className="text-xs text-muted-foreground">{SALARY_TABLE_UI_TEXT.TOTAL_STEPS}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{grades.length}</div>
            <p className="text-xs text-muted-foreground">等級数</p>
          </CardContent>
        </Card>
      </div>

      {/* 等級別レンジ */}
      {gradeRanges && gradeRanges.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">等級別基本給レンジ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {sortedGrades.map((grade) => {
                const range = gradeRanges.get(grade.id)
                if (!range) return null
                return (
                  <div key={grade.id} className="p-3 border rounded-lg">
                    <div className="font-semibold">{grade.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(range.min)} 〜 {formatCurrency(range.max)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      号俸 {range.startStep} 〜 {range.endStep}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 詳細テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">号俸テーブル詳細</CardTitle>
          <CardDescription>
            全{totalSteps}号俸の基本給、号差、増加額、増加率、年収
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-background min-w-[60px] text-center">
                    {SALARY_TABLE_UI_TEXT.STEP_NUMBER}
                  </TableHead>
                  <TableHead className="min-w-[60px] text-center">
                    {SALARY_TABLE_UI_TEXT.RANK}
                  </TableHead>
                  <TableHead className="min-w-[100px] text-right">
                    {SALARY_TABLE_UI_TEXT.BASE_SALARY}
                  </TableHead>
                  <TableHead className="min-w-[80px] text-right">
                    {SALARY_TABLE_UI_TEXT.STEP_DIFF}
                  </TableHead>
                  <TableHead className="min-w-[80px] text-right">
                    {SALARY_TABLE_UI_TEXT.INCREASE_AMOUNT}
                  </TableHead>
                  <TableHead className="min-w-[70px] text-right">
                    {SALARY_TABLE_UI_TEXT.INCREASE_RATE_ACTUAL}
                  </TableHead>
                  <TableHead className="min-w-[100px] text-right">
                    {SALARY_TABLE_UI_TEXT.ANNUAL_SALARY}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step) => {
                  const zone = getRankZone(step.rank)
                  const isZoneBoundary = zoneBoundarySteps.has(step.stepNumber)

                  return (
                    <TableRow
                      key={step.stepNumber}
                      className={cn(
                        ZONE_ROW_COLORS[zone],
                        isZoneBoundary && "border-t-2 border-t-gray-400 dark:border-t-gray-600"
                      )}
                    >
                      <TableCell
                        className={cn(
                          "sticky left-0 z-10 text-center font-mono",
                          ZONE_ROW_COLORS[zone],
                          isZoneBoundary && "border-t-2 border-t-gray-400 dark:border-t-gray-600"
                        )}
                      >
                        {step.stepNumber}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("font-mono", ZONE_COLORS[zone])}>
                          {step.rank}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(step.baseSalary)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {step.stepDiff > 0 ? `+${formatCurrency(step.stepDiff)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {step.increaseAmount > 0 ? `+${formatCurrency(step.increaseAmount)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatRate(step.bandIncreaseRate)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(step.annualSalary)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(ZONE_COLORS).map(([zone, colorClass]) => {
          const zoneSteps = steps.filter((s) => getRankZone(s.rank) === zone)
          if (zoneSteps.length === 0) return null
          return (
            <Badge key={zone} variant="outline" className={cn("font-mono", colorClass)}>
              {zone}ゾーン ({zoneSteps.length}号俸)
            </Badge>
          )
        })}
      </div>
    </div>
  )
}
