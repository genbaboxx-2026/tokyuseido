"use client"

import { useMemo, useState, useCallback, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, RotateCcw, ChevronLeft, ChevronRight, ArrowUpDown, Calculator, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SalaryTableCalculationResult } from "@/lib/salary-table/generator"
import { getRankLettersInRange } from "@/lib/salary-table/generator"

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
  employees?: Employee[]
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
  employees = [],
  rankStartLetter = "S",
  rankEndLetter = "D",
  onGradeBandChange,
}: SalaryAdjustmentCriteriaProps) {
  const queryClient = useQueryClient()
  const totalBands = calculationResult.bands.length
  const bandsPerGrade = calculationResult.bandsPerGrade
  const stepsPerBand = calculationResult.stepsPerBand

  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>("")

  // 昇順/降順の切り替え（true=降順: 大きい号俸帯が上）
  const [isDescending, setIsDescending] = useState(true)

  // ローカル編集中のルール（保存前の変更を保持）
  const [localRules, setLocalRules] = useState<AdjustmentRule[]>([])
  const [hasLocalChanges, setHasLocalChanges] = useState(false)

  // 等級別の開始号俸帯オーバーライド（ローカルstate）
  const [gradeBandOverrides, setGradeBandOverrides] = useState<Map<string, number>>(new Map())

  // シミュレーション用state
  const [simulationYears, setSimulationYears] = useState<number>(5)
  const [simulationRating, setSimulationRating] = useState<string>("B")
  const [selectedEmployeeForDetail, setSelectedEmployeeForDetail] = useState<string | null>(null)

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
  const { data: serverRules = [], isLoading: isLoadingRules } = useQuery<AdjustmentRule[]>({
    queryKey: ["adjustmentRules", salaryTableId],
    queryFn: async () => {
      const res = await fetch(`/api/salary-tables/${salaryTableId}/adjustment-rules`)
      if (!res.ok) throw new Error("改定ルールの取得に失敗しました")
      return res.json()
    },
  })

  // サーバーからのルールをローカルステートに同期（ローカル変更がない場合のみ）
  const serverRulesJson = JSON.stringify(serverRules)
  useEffect(() => {
    if (!hasLocalChanges) {
      setLocalRules(serverRules)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverRulesJson])

  // ページ離脱時の警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasLocalChanges) {
        e.preventDefault()
        e.returnValue = ""
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasLocalChanges])

  // ルールをマップに変換（ローカルルールを使用）
  const rulesMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const rule of localRules) {
      const key = `${rule.currentBand}-${rule.isTransition}-${rule.targetBand}`
      map.set(key, rule.adjustmentValue)
    }
    return map
  }, [localRules])

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
    onSuccess: async () => {
      setHasLocalChanges(false)
      await queryClient.invalidateQueries({ queryKey: ["adjustmentRules", salaryTableId] })
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
    onSuccess: async () => {
      setHasLocalChanges(false)
      setLocalRules([])
      await queryClient.invalidateQueries({ queryKey: ["adjustmentRules", salaryTableId] })
    },
  })

  // 保存処理
  const handleSave = useCallback(() => {
    updateRulesMutation.mutate(localRules)
  }, [localRules, updateRulesMutation])

  // 値を取得
  const getValue = useCallback((currentBand: number, isTransition: boolean, targetBand: number) => {
    const key = `${currentBand}-${isTransition}-${targetBand}`
    if (rulesMap.has(key)) {
      return rulesMap.get(key)!
    }
    return calculateDefaultValue(currentBand, isTransition, targetBand)
  }, [rulesMap])

  // 評価ランク（S〜D等）から目標号俸帯を取得（従業員の等級のマッピングに基づく）
  const getTargetBandFromRating = useCallback((gradeId: string, rating: string) => {
    const bandMapping = getGradeBandMapping(gradeId)
    // マッピングからランク文字に対応する号俸帯を検索
    for (const [bandNum, rankLetter] of bandMapping.entries()) {
      if (rankLetter === rating) {
        return bandNum
      }
    }
    // 見つからない場合はデフォルトとして中央の号俸帯を返す
    const startBand = getGradeStartBand(gradeId)
    return startBand + Math.floor(rankLetters.length / 2)
  }, [getGradeBandMapping, getGradeStartBand, rankLetters])

  // 号俸から号俸帯番号とT行かどうかを取得
  const getStepBandInfo = useCallback((stepNumber: number) => {
    const bandNumber = Math.ceil(stepNumber / stepsPerBand)
    const positionInBand = ((stepNumber - 1) % stepsPerBand) + 1
    const isTransition = positionInBand === stepsPerBand
    return { bandNumber, isTransition, positionInBand }
  }, [stepsPerBand])

  // 号俸番号から基本給を取得
  const getSalaryForStep = useCallback((stepNumber: number) => {
    const step = calculationResult.salaryLadder.find(s => s.stepNumber === stepNumber)
    return step?.baseSalary ?? 0
  }, [calculationResult.salaryLadder])

  // 号俸が指定した等級の範囲内かどうかを判定
  const isStepInGradeRange = useCallback((stepNumber: number, gradeId: string): boolean => {
    const assignment = calculationResult.gradeBandAssignments.find(a => a.gradeId === gradeId)
    if (!assignment) return false
    return stepNumber >= assignment.startStep && stepNumber <= assignment.endStep
  }, [calculationResult.gradeBandAssignments])

  // 号俸から該当する等級を取得（現在の等級を優先、範囲外の場合は適切な等級を返す）
  const getGradeForStep = useCallback((stepNumber: number, currentGradeId?: string): Grade | null => {
    // 現在の等級が指定されていて、その範囲内にある場合は現在の等級を維持
    if (currentGradeId && isStepInGradeRange(stepNumber, currentGradeId)) {
      return grades.find(g => g.id === currentGradeId) || null
    }

    // 範囲外の場合は、該当する等級の中で最も適切なものを返す
    const matchingAssignments = calculationResult.gradeBandAssignments
      .filter(assignment => stepNumber >= assignment.startStep && stepNumber <= assignment.endStep)
    
    if (matchingAssignments.length === 0) return null

    // 現在の等級より上の等級を優先（昇格シミュレーション）
    if (currentGradeId) {
      const currentGrade = grades.find(g => g.id === currentGradeId)
      if (currentGrade) {
        const higherGrades = matchingAssignments
          .map(a => grades.find(g => g.id === a.gradeId))
          .filter((g): g is Grade => g !== undefined && g.level > currentGrade.level)
          .sort((a, b) => a.level - b.level) // 最も近い上位等級
        
        if (higherGrades.length > 0) return higherGrades[0]
      }
    }

    // デフォルトは最も高い等級
    const matchingGrades = matchingAssignments
      .map(assignment => grades.find(g => g.id === assignment.gradeId))
      .filter((g): g is Grade => g !== undefined)
      .sort((a, b) => b.level - a.level)
    
    return matchingGrades[0] || null
  }, [calculationResult.gradeBandAssignments, grades, isStepInGradeRange])

  // 等級のS1号俸帯（開始号俸帯）に達しているかを判定し、次の等級を取得
  const getNextHigherGrade = useCallback((gradeId: string): Grade | null => {
    const currentGrade = grades.find(g => g.id === gradeId)
    if (!currentGrade) return null
    
    // 現在の等級より上位の等級を検索（levelが高い方が上位）
    const higherGrades = grades
      .filter(g => g.level > currentGrade.level)
      .sort((a, b) => a.level - b.level) // 最も近い上位等級
    
    return higherGrades[0] || null
  }, [grades])

  // 現在の号俸が等級のS1（最上位の号俸帯、つまり開始号俸帯）に達しているかを判定
  const isAtGradeS1Band = useCallback((stepNumber: number, gradeId: string): boolean => {
    const { bandNumber } = getStepBandInfo(stepNumber)
    const gradeStartBand = getGradeStartBand(gradeId)
    return bandNumber === gradeStartBand
  }, [getStepBandInfo, getGradeStartBand])

  // 単一従業員のシミュレーションを計算する関数
  const calculateEmployeeSimulation = useCallback((employee: Employee) => {
    if (!employee.baseSalary || !employee.gradeId) return null

    const employeeGrade = grades.find(g => g.id === employee.gradeId)
    if (!employeeGrade) return null

    // 現在の号俸を検索（現基本給以上で最も近い号俸）
    const currentStep = calculationResult.salaryLadder
      .filter(s => s.baseSalary >= employee.baseSalary!)
      .sort((a, b) => a.baseSalary - b.baseSalary)[0]

    if (!currentStep) return null

    const currentStepNumber = currentStep.stepNumber
    const currentSalary = currentStep.baseSalary

    // シミュレーション：年数分の評価を適用
    let simulatedStep = currentStepNumber
    let currentGradeId = employee.gradeId!
    const yearlyDetails: { year: number; currentStep: number; stepChange: number; newStep: number; gradeName: string; promoted: boolean }[] = []

    for (let year = 1; year <= simulationYears; year++) {
      let promoted = false
      let stepChange: number
      let actualGradeId = currentGradeId
      
      // まず現在の等級で評価を計算
      const { bandNumber, isTransition } = getStepBandInfo(simulatedStep)
      const targetBand = getTargetBandFromRating(currentGradeId, simulationRating)
      stepChange = getValue(bandNumber, isTransition, targetBand)
      
      // S評価なのに変化が0以下の場合は昇格して再計算
      if (simulationRating === "S" && stepChange <= 0) {
        const nextGrade = getNextHigherGrade(currentGradeId)
        if (nextGrade) {
          actualGradeId = nextGrade.id
          currentGradeId = nextGrade.id
          promoted = true
          // 昇格後の等級でS評価を再計算
          const newTargetBand = getTargetBandFromRating(actualGradeId, simulationRating)
          stepChange = getValue(bandNumber, isTransition, newTargetBand)
        }
      }
      
      // マイナスの昇給もそのまま適用（降給あり）
      
      const newStep = Math.max(1, Math.min(calculationResult.totalSteps, simulatedStep + stepChange))
      const gradeName = grades.find(g => g.id === actualGradeId)?.name || ""
      
      yearlyDetails.push({
        year,
        currentStep: simulatedStep,
        stepChange,
        newStep,
        gradeName,
        promoted,
      })
      
      simulatedStep = newStep
    }

    const finalStep = simulatedStep
    const finalSalary = getSalaryForStep(finalStep)
    const totalStepChange = finalStep - currentStepNumber
    const salaryChange = finalSalary - currentSalary
    const finalGrade = grades.find(g => g.id === currentGradeId)

    return {
      employee,
      currentGrade: employeeGrade,
      currentStep: currentStepNumber,
      currentSalary,
      finalGrade: finalGrade || employeeGrade,
      finalStep,
      yearlyDetails,
      finalSalary,
      totalStepChange,
      salaryChange,
    }
  }, [grades, calculationResult, simulationYears, simulationRating, getValue, getStepBandInfo, getTargetBandFromRating, getSalaryForStep, isAtGradeS1Band, getNextHigherGrade])

  // 全従業員のシミュレーション結果
  const allEmployeeSimulations = useMemo(() => {
    return employees
      .filter(emp => emp.baseSalary && emp.gradeId)
      .map(emp => calculateEmployeeSimulation(emp))
      .filter((result): result is NonNullable<typeof result> => result !== null)
      .sort((a, b) => b.currentGrade.level - a.currentGrade.level || a.employee.lastName.localeCompare(b.employee.lastName))
  }, [employees, calculateEmployeeSimulation])

  // 統計情報
  const statistics = useMemo(() => {
    if (allEmployeeSimulations.length === 0) return null

    const totalCurrentSalary = allEmployeeSimulations.reduce((sum, s) => sum + s.currentSalary, 0)
    const totalFinalSalary = allEmployeeSimulations.reduce((sum, s) => sum + s.finalSalary, 0)
    const avgCurrentSalary = totalCurrentSalary / allEmployeeSimulations.length
    const avgFinalSalary = totalFinalSalary / allEmployeeSimulations.length
    const avgSalaryChange = avgFinalSalary - avgCurrentSalary
    const totalSalaryChange = totalFinalSalary - totalCurrentSalary

    return {
      count: allEmployeeSimulations.length,
      avgCurrentSalary: Math.round(avgCurrentSalary),
      avgFinalSalary: Math.round(avgFinalSalary),
      avgSalaryChange: Math.round(avgSalaryChange),
      totalCurrentSalary,
      totalFinalSalary,
      totalSalaryChange,
    }
  }, [allEmployeeSimulations])

  // セルの編集開始
  const handleCellClick = (currentBand: number, isTransition: boolean, targetBand: number) => {
    const key = `${currentBand}-${isTransition}-${targetBand}`
    const currentValue = getValue(currentBand, isTransition, targetBand)
    setEditingCell(key)
    setEditValue(currentValue.toString())
  }

  // 編集値の確定（ローカルステートを更新、サーバーには保存しない）
  const handleEditConfirm = (currentBand: number, isTransition: boolean, targetBand: number) => {
    const newValue = parseInt(editValue)
    if (isNaN(newValue)) {
      setEditingCell(null)
      return
    }

    const defaultValue = calculateDefaultValue(currentBand, isTransition, targetBand)
    const newRules = localRules.filter(
      r => !(r.currentBand === currentBand && r.isTransition === isTransition && r.targetBand === targetBand)
    )

    if (newValue !== defaultValue) {
      newRules.push({ currentBand, isTransition, targetBand, adjustmentValue: newValue })
    }

    setLocalRules(newRules)
    setHasLocalChanges(true)
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
  const isSaving = updateRulesMutation.isPending

  // 列幅を固定（大きめに設定）
  const firstColWidth = "w-[140px] min-w-[140px]"
  const bandColWidth = "w-[56px] min-w-[56px]"

  // 評価ランクのオプションをランク文字リストから生成
  const ratingOptions = useMemo(() => {
    return rankLetters.map((letter, index) => {
      let suffix = ""
      if (index === 0) suffix = " (最高評価)"
      else if (index === rankLetters.length - 1) suffix = " (最低評価)"
      else if (index === Math.floor(rankLetters.length / 2)) suffix = " (標準)"
      return { value: letter, label: `${letter}${suffix}` }
    })
  }, [rankLetters])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP").format(value)
  }

  return (
    <div className="space-y-4">
      {/* シミュレーションカード */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            全従業員 給与シミュレーション
          </CardTitle>
          <CardDescription>
            評価ランクと年数を指定して、全従業員の将来の給与をシミュレーションします
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 条件設定 */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs">評価ランク</Label>
                <Select value={simulationRating} onValueChange={setSimulationRating}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ratingOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">シミュレーション年数</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={simulationYears}
                    onChange={(e) => setSimulationYears(Math.max(1, Math.min(30, Number(e.target.value))))}
                    className="w-20 h-9"
                  />
                  <span className="text-sm text-muted-foreground">年間</span>
                </div>
              </div>

              {statistics && (
                <div className="flex-1 flex flex-wrap gap-4 justify-end">
                  <div className="bg-muted px-3 py-2 rounded-lg text-sm">
                    <span className="text-muted-foreground">対象人数: </span>
                    <span className="font-medium">{statistics.count}名</span>
                  </div>
                  <div className="bg-muted px-3 py-2 rounded-lg text-sm">
                    <span className="text-muted-foreground">現在の平均基本給: </span>
                    <span className="font-mono">¥{formatCurrency(statistics.avgCurrentSalary)}</span>
                  </div>
                  <div className="bg-primary/10 px-3 py-2 rounded-lg text-sm border border-primary/20">
                    <span className="text-muted-foreground">{simulationYears}年後の平均基本給: </span>
                    <span className="font-mono font-medium">¥{formatCurrency(statistics.avgFinalSalary)}</span>
                    <span className={cn(
                      "ml-2 font-mono",
                      statistics.avgSalaryChange > 0 ? "text-emerald-600" : statistics.avgSalaryChange < 0 ? "text-red-600" : ""
                    )}>
                      ({statistics.avgSalaryChange > 0 ? "+" : ""}¥{formatCurrency(statistics.avgSalaryChange)})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 従業員一覧テーブル */}
            {allEmployeeSimulations.length > 0 ? (
              <div className="overflow-auto max-h-[400px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="border-b">
                      <th className="text-left px-3 py-2 font-medium">従業員</th>
                      <th className="text-center px-3 py-2 font-medium">現在等級</th>
                      <th className="text-right px-3 py-2 font-medium">現在号俸</th>
                      <th className="text-right px-3 py-2 font-medium">現在基本給</th>
                      <th className="text-center px-3 py-2 font-medium">{simulationYears}年後等級</th>
                      <th className="text-right px-3 py-2 font-medium">{simulationYears}年後号俸</th>
                      <th className="text-right px-3 py-2 font-medium">{simulationYears}年後基本給</th>
                      <th className="text-right px-3 py-2 font-medium">変化額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allEmployeeSimulations.map((sim) => (
                      <tr 
                        key={sim.employee.id} 
                        className={cn(
                          "border-b hover:bg-muted/50 cursor-pointer",
                          selectedEmployeeForDetail === sim.employee.id && "bg-primary/10"
                        )}
                        onClick={() => setSelectedEmployeeForDetail(
                          selectedEmployeeForDetail === sim.employee.id ? null : sim.employee.id
                        )}
                      >
                        <td className="px-3 py-2">
                          {sim.employee.lastName} {sim.employee.firstName}
                        </td>
                        <td className="text-center px-3 py-2">{sim.currentGrade.name}</td>
                        <td className="text-right px-3 py-2 font-mono">{sim.currentStep}</td>
                        <td className="text-right px-3 py-2 font-mono">¥{formatCurrency(sim.currentSalary)}</td>
                        <td className="text-center px-3 py-2">
                          <span className={sim.finalGrade.id !== sim.currentGrade.id ? "text-primary font-medium" : ""}>
                            {sim.finalGrade.name}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2 font-mono">{sim.finalStep}</td>
                        <td className="text-right px-3 py-2 font-mono">¥{formatCurrency(sim.finalSalary)}</td>
                        <td className={cn(
                          "text-right px-3 py-2 font-mono",
                          sim.salaryChange > 0 ? "text-emerald-600" : sim.salaryChange < 0 ? "text-red-600" : ""
                        )}>
                          {sim.salaryChange > 0 ? "+" : ""}¥{formatCurrency(sim.salaryChange)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {statistics && (
                    <tfoot className="sticky bottom-0 bg-muted font-medium">
                      <tr className="border-t-2">
                        <td className="px-3 py-2">合計 / 平均</td>
                        <td className="text-center px-3 py-2">-</td>
                        <td className="text-right px-3 py-2">-</td>
                        <td className="text-right px-3 py-2 font-mono">¥{formatCurrency(statistics.totalCurrentSalary)}</td>
                        <td className="text-center px-3 py-2">-</td>
                        <td className="text-right px-3 py-2">-</td>
                        <td className="text-right px-3 py-2 font-mono">¥{formatCurrency(statistics.totalFinalSalary)}</td>
                        <td className={cn(
                          "text-right px-3 py-2 font-mono",
                          statistics.totalSalaryChange > 0 ? "text-emerald-600" : statistics.totalSalaryChange < 0 ? "text-red-600" : ""
                        )}>
                          {statistics.totalSalaryChange > 0 ? "+" : ""}¥{formatCurrency(statistics.totalSalaryChange)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg text-center">
                シミュレーション対象の従業員がいません
              </div>
            )}

            {/* 選択した従業員の年度別詳細 */}
            {selectedEmployeeForDetail && (() => {
              const selectedSim = allEmployeeSimulations.find(s => s.employee.id === selectedEmployeeForDetail)
              if (!selectedSim || !selectedSim.yearlyDetails) return null
              
              return (
                <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                  <div className="font-medium mb-3">
                    {selectedSim.employee.lastName} {selectedSim.employee.firstName} の年度別推移
                    （{selectedSim.currentGrade.name} 号俸{selectedSim.currentStep} → {selectedSim.finalGrade.name} 号俸{selectedSim.finalStep}）
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted">
                          <th className="px-2 py-1 text-left">年</th>
                          <th className="px-2 py-1 text-center">号俸</th>
                          <th className="px-2 py-1 text-center">等級</th>
                          <th className="px-2 py-1 text-center">評価</th>
                          <th className="px-2 py-1 text-center">変化</th>
                          <th className="px-2 py-1 text-center">新号俸</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSim.yearlyDetails.map((detail) => (
                          <tr key={detail.year} className={cn("border-b", detail.promoted && "bg-primary/10")}>
                            <td className="px-2 py-1">{detail.year}年目</td>
                            <td className="px-2 py-1 text-center font-mono">{detail.currentStep}</td>
                            <td className={cn("px-2 py-1 text-center", detail.promoted && "text-primary font-medium")}>
                              {detail.gradeName}
                              {detail.promoted && " ↑昇格"}
                            </td>
                            <td className="px-2 py-1 text-center">{simulationRating}</td>
                            <td className={cn(
                              "px-2 py-1 text-center font-mono",
                              detail.stepChange > 0 ? "text-emerald-600" : detail.stepChange < 0 ? "text-red-600" : ""
                            )}>
                              {detail.stepChange > 0 ? "+" : ""}{detail.stepChange}
                            </td>
                            <td className="px-2 py-1 text-center font-mono">{detail.newStep}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
          </div>
        </CardContent>
      </Card>

      {/* 等級別号俸改定基準 */}
      <Card>
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            等級別号俸改定基準
            {hasLocalChanges && (
              <span className="text-xs font-normal text-amber-600 dark:text-amber-400">
                (未保存の変更があります)
              </span>
            )}
          </CardTitle>
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
            disabled={isLoading || localRules.length === 0}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            デフォルトに戻す
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasLocalChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-3 w-3 mr-1" />
                保存
              </>
            )}
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
    </div>
  )
}
