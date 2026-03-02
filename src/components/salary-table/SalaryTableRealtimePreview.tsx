"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { getRankZone } from "@/lib/salary-table"
import type {
  SalaryTableCalculationResult,
} from "@/lib/salary-table/generator"
import { generateGradeRankMatrix } from "@/lib/salary-table/generator"
import { TrendingUp, Layers, Users, Sparkles, BarChart3 } from "lucide-react"

interface Grade {
  id: string
  name: string
  level: number
}

interface SalaryTableRealtimePreviewProps {
  calculationResult: SalaryTableCalculationResult | null
  grades: Grade[]
  onGradeStartBandChange?: (gradeId: string, startBand: number) => void
  isCalculating?: boolean
}

// ゾーンの色定義
const ZONE_BG_COLORS: Record<string, string> = {
  S: "bg-emerald-100 dark:bg-emerald-900/50",
  A: "bg-blue-100 dark:bg-blue-900/50",
  B: "bg-amber-100 dark:bg-amber-900/50",
  C: "bg-orange-100 dark:bg-orange-900/50",
  D: "bg-red-100 dark:bg-red-900/50",
  E: "bg-purple-100 dark:bg-purple-900/50",
  F: "bg-gray-100 dark:bg-gray-900/50",
}

const ZONE_TEXT_COLORS: Record<string, string> = {
  S: "text-emerald-700 dark:text-emerald-300",
  A: "text-blue-700 dark:text-blue-300",
  B: "text-amber-700 dark:text-amber-300",
  C: "text-orange-700 dark:text-orange-300",
  D: "text-red-700 dark:text-red-300",
  E: "text-purple-700 dark:text-purple-300",
  F: "text-gray-700 dark:text-gray-300",
}

// グレード行の背景色
const GRADE_ROW_COLORS = [
  "bg-violet-50 dark:bg-violet-950/30",
  "bg-blue-50 dark:bg-blue-950/30",
  "bg-teal-50 dark:bg-teal-950/30",
  "bg-amber-50 dark:bg-amber-950/30",
  "bg-rose-50 dark:bg-rose-950/30",
  "bg-slate-50 dark:bg-slate-950/30",
]

export function SalaryTableRealtimePreview({
  calculationResult,
  grades,
  onGradeStartBandChange,
  isCalculating = false,
}: SalaryTableRealtimePreviewProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP").format(value)
  }

  // 給与マトリクスを生成
  const salaryMatrix = useMemo(() => {
    if (!calculationResult) return null
    return generateGradeRankMatrix(calculationResult)
  }, [calculationResult])

  // 号俸列の情報
  const ladderInfo = useMemo(() => {
    if (!calculationResult || calculationResult.salaryLadder.length === 0) {
      return { min: 0, max: 0, totalSteps: 0, totalBands: 0 }
    }
    return {
      min: calculationResult.baseSalaryMin,
      max: calculationResult.baseSalaryMax,
      totalSteps: calculationResult.totalSteps,
      totalBands: calculationResult.totalBands,
    }
  }, [calculationResult])

  if (isCalculating) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!calculationResult || calculationResult.salaryLadder.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-gradient-to-br from-muted/30 to-muted/10">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">
            パラメータを入力するとプレビューが表示されます
          </p>
        </div>
      </div>
    )
  }

  // 等級割り当てをソート（高い等級から）
  const sortedAssignments = [...calculationResult.gradeBandAssignments].sort(
    (a, b) => b.gradeLevel - a.gradeLevel
  )

  // 開始号俸帯の選択肢を生成
  const startBandOptions: number[] = []
  for (let i = 1; i <= calculationResult.totalBands - calculationResult.bandsPerGrade + 1; i++) {
    startBandOptions.push(i)
  }

  return (
    <div className="space-y-6">
      {/* 1. サマリーカード */}
      <div className="grid grid-cols-4 gap-4">
        {/* 号俸列レンジ */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
          <div className="relative">
            <div className="flex items-center gap-2 text-blue-100 text-xs mb-1">
              <TrendingUp className="w-3 h-3" />
              基本給レンジ
            </div>
            <div className="text-lg font-bold tracking-tight">
              {formatCurrency(ladderInfo.min)}
            </div>
            <div className="text-lg font-bold tracking-tight">
              〜 {formatCurrency(ladderInfo.max)}円
            </div>
          </div>
        </div>

        {/* 総号俸数 */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
          <div className="relative">
            <div className="flex items-center gap-2 text-emerald-100 text-xs mb-1">
              <Layers className="w-3 h-3" />
              総号俸数
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {ladderInfo.totalSteps}
              <span className="text-sm font-normal ml-1">号俸</span>
            </div>
          </div>
        </div>

        {/* 号俸帯数 */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
          <div className="relative">
            <div className="flex items-center gap-2 text-amber-100 text-xs mb-1">
              <BarChart3 className="w-3 h-3" />
              号俸帯数
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {ladderInfo.totalBands}
              <span className="text-sm font-normal ml-1">帯</span>
            </div>
          </div>
        </div>

        {/* 等級数 */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
          <div className="relative">
            <div className="flex items-center gap-2 text-violet-100 text-xs mb-1">
              <Users className="w-3 h-3" />
              等級数
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {grades.length}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 号俸帯詳細 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            号俸帯詳細
            <span className="text-xs text-muted-foreground font-normal ml-2">
              各号俸帯の号差と基本給範囲
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">号俸範囲</TableHead>
                  <TableHead className="w-16 text-center">号俸帯</TableHead>
                  <TableHead className="text-right">号差</TableHead>
                  <TableHead className="text-right">増加率</TableHead>
                  <TableHead className="text-right">min基本給</TableHead>
                  <TableHead className="text-right">max基本給</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...calculationResult.bands].reverse().map((band, index, arr) => {
                  // 増加率を計算（前の号俸帯との比較）
                  const prevBand = arr[index + 1] // reverseしているので+1が前の帯
                  const increaseRate = prevBand ? (band.stepDiff / prevBand.stepDiff) : 1

                  return (
                    <TableRow key={band.bandNumber}>
                      <TableCell className="text-center font-mono text-sm text-muted-foreground">
                        {band.startStep}〜{band.endStep}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm font-medium">
                        {band.bandNumber}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(band.stepDiff)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {prevBand ? (
                          <span className="text-blue-600 dark:text-blue-400">
                            ×{increaseRate.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(band.minSalary)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatCurrency(band.maxSalary)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 3. 等級設定テーブル */}
      {grades.length > 0 && calculationResult.gradeBandAssignments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4" />
              等級設定テーブル
              <span className="text-xs text-muted-foreground font-normal ml-2">
                開始号俸を変更すると自動的に{calculationResult.bandsPerGrade}帯分（{calculationResult.ranksPerGrade}号俸）が割り当てられます
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">等級</TableHead>
                  <TableHead className="text-center w-64">開始号俸</TableHead>
                  <TableHead className="text-center w-24">終了号俸</TableHead>
                  <TableHead className="text-right">min基本給</TableHead>
                  <TableHead className="text-right">max基本給</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAssignments.map((assignment, index) => {
                  // 各開始号俸帯に対応するmin/max給与を計算
                  const startStepOptionsWithSalary = startBandOptions.map((band) => {
                    const stepsPerBand = calculationResult.stepsPerBand
                    const startStep = (band - 1) * stepsPerBand + 1
                    const endBand = band + calculationResult.bandsPerGrade - 1
                    const endStep = endBand * stepsPerBand

                    // この範囲の給与を取得
                    const startSalary = calculationResult.salaryLadder.find(s => s.stepNumber === startStep)?.baseSalary ?? 0
                    const endSalary = calculationResult.salaryLadder.find(s => s.stepNumber === endStep)?.baseSalary ?? 0

                    return {
                      band,
                      startStep,
                      endStep,
                      minSalary: startSalary,
                      maxSalary: endSalary,
                    }
                  })

                  return (
                    <TableRow key={assignment.gradeId} className={GRADE_ROW_COLORS[index % GRADE_ROW_COLORS.length]}>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold">
                          {assignment.gradeName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {onGradeStartBandChange ? (
                          <Select
                            value={String(assignment.startBand)}
                            onValueChange={(value) => onGradeStartBandChange(assignment.gradeId, Number(value))}
                          >
                            <SelectTrigger className="w-20 h-8 mx-auto">
                              <SelectValue>
                                {assignment.startStep}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {[...startStepOptionsWithSalary].reverse().map((option) => (
                                <SelectItem key={option.band} value={String(option.band)}>
                                  <span className="font-mono">{option.startStep}</span>
                                  <span className="text-muted-foreground ml-2 text-xs">
                                    （{formatCurrency(option.minSalary)}〜{formatCurrency(option.maxSalary)}円）
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="font-mono">{assignment.startStep}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {assignment.endStep}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(assignment.minSalary)}円
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatCurrency(assignment.maxSalary)}円
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 4. 基本給テーブル（等級×ランクのマトリクス） */}
      {salaryMatrix && sortedAssignments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4" />
              基本給テーブル
              <span className="text-xs text-muted-foreground font-normal ml-2">
                同じ金額 = 同じ号俸を参照（串刺し構造）
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="bg-muted/20">
                    <TableHead className="w-20 text-center font-semibold sticky left-0 bg-muted/20 z-20">ランク</TableHead>
                    {sortedAssignments.map((assignment) => (
                      <TableHead
                        key={assignment.gradeId}
                        className="text-center min-w-[100px] font-semibold"
                      >
                        {assignment.gradeName}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* ランクごとの行（S1からD8の順） */}
                  {calculationResult.ranks.map((rank, rankIndex) => {
                    const zone = getRankZone(rank)
                    const prevRank = rankIndex > 0 ? calculationResult.ranks[rankIndex - 1] : null
                    const isZoneBoundary = prevRank && getRankZone(prevRank) !== zone

                    return (
                      <TableRow
                        key={rank}
                        className={cn(
                          ZONE_BG_COLORS[zone],
                          isZoneBoundary && "border-t-2 border-t-gray-400 dark:border-t-gray-500"
                        )}
                      >
                        <TableCell className={cn(
                          "text-center sticky left-0",
                          ZONE_BG_COLORS[zone]
                        )}>
                          <Badge variant="outline" className={cn("text-xs font-mono", ZONE_TEXT_COLORS[zone])}>
                            {rank}
                          </Badge>
                        </TableCell>
                        {sortedAssignments.map((assignment) => {
                          const gradeMap = salaryMatrix.get(assignment.gradeId)
                          const salary = gradeMap?.get(rank)

                          // この等級がこのランクを持っているか
                          const hasRank = assignment.rankBands.some(rb => rb.rank === zone)

                          if (!hasRank || salary === undefined) {
                            return (
                              <TableCell key={assignment.gradeId} className="text-center text-sm text-muted-foreground">
                                -
                              </TableCell>
                            )
                          }

                          return (
                            <TableCell key={assignment.gradeId} className="text-center text-sm font-mono">
                              {formatCurrency(salary)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
