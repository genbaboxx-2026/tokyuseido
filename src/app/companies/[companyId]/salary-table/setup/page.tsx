"use client"

import { use, useState, useMemo, useCallback, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, AlertTriangle } from "lucide-react"

// 重いコンポーネントを遅延読み込み
const SalaryTableInputPanel = dynamic(
  () => import("@/components/salary-table").then((mod) => mod.SalaryTableInputPanel),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
)
const SalaryTableRealtimePreview = dynamic(
  () => import("@/components/salary-table").then((mod) => mod.SalaryTableRealtimePreview),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
)
import {
  SALARY_TABLE_UI_TEXT,
  SALARY_TABLE_DEFAULTS,
  type SalaryTableFormData,
} from "@/lib/salary-table"
import {
  calculateSalaryTable,
  type SalaryTableCalculationResult,
} from "@/lib/salary-table/generator"

interface SalaryTableSetupPageProps {
  params: Promise<{ companyId: string }>
}

interface SalaryTableDataFromDB {
  id: string
  companyId: string
  name: string
  baseSalaryMax: number
  baseSalaryMin: number
  rankDivision: number
  increaseRate: number
  initialStepDiff: number
  totalRanks: number
  isActive: boolean
}

interface SalaryTableData {
  id: string
  companyId: string
  name: string
  baseSalaryMax: number
  baseSalaryMin: number
  stepsPerBand: number
  bandIncreaseRate: number
  initialStepDiff: number
  salaryBandCount: number
  isActive: boolean
}

interface Grade {
  id: string
  name: string
  level: number
}

function mapDbDataToNewTerms(dbData: SalaryTableDataFromDB): SalaryTableData {
  return {
    id: dbData.id,
    companyId: dbData.companyId,
    name: dbData.name,
    baseSalaryMax: dbData.baseSalaryMax,
    baseSalaryMin: dbData.baseSalaryMin,
    stepsPerBand: dbData.rankDivision,
    bandIncreaseRate: dbData.increaseRate,
    initialStepDiff: dbData.initialStepDiff,
    salaryBandCount: dbData.totalRanks,
    isActive: dbData.isActive,
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function SalaryTableSetupPage({ params }: SalaryTableSetupPageProps) {
  const { companyId } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<SalaryTableFormData | null>(null)

  // フォームの現在値
  const [formValues, setFormValues] = useState<Partial<SalaryTableFormData>>({
    baseSalaryMin: SALARY_TABLE_DEFAULTS.baseSalaryMin,
    initialStepDiff: SALARY_TABLE_DEFAULTS.initialStepDiff,
    bandIncreaseRate: SALARY_TABLE_DEFAULTS.bandIncreaseRate,
    stepsPerBand: SALARY_TABLE_DEFAULTS.stepsPerBand,
    salaryBandCount: SALARY_TABLE_DEFAULTS.salaryBandCount,
    rankStartLetter: "S",
    rankEndLetter: "D",
    roundingMethod: "none",
    roundingUnit: 1,
  })

  // 等級別開始号俸帯のオーバーライド
  const [gradeBandOverrides, setGradeBandOverrides] = useState<{ gradeId: string; startBand: number }[]>([])

  // デバウンス（300ms）
  const debouncedFormValues = useDebounce(formValues, 300)

  // 号俸テーブル一覧取得
  const {
    data: salaryTables,
    isLoading: isLoadingTables,
  } = useQuery<SalaryTableData[]>({
    queryKey: ["salary-tables", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/salary-tables?companyId=${companyId}`)
      if (!res.ok) throw new Error("号俸テーブルの取得に失敗しました")
      const data: SalaryTableDataFromDB[] = await res.json()
      return data.map(mapDbDataToNewTerms)
    },
  })

  // 等級一覧取得
  const { data: grades = [] } = useQuery<Grade[]>({
    queryKey: ["grades", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/grades?companyId=${companyId}`)
      if (!res.ok) throw new Error("等級の取得に失敗しました")
      return res.json()
    },
  })

  const activeSalaryTable = salaryTables?.find((t) => t.isActive)
  const isEditMode = !!activeSalaryTable

  // アクティブなテーブルのパラメータを反映
  useEffect(() => {
    if (activeSalaryTable) {
      setFormValues({
        baseSalaryMin: activeSalaryTable.baseSalaryMin,
        initialStepDiff: activeSalaryTable.initialStepDiff,
        bandIncreaseRate: activeSalaryTable.bandIncreaseRate,
        stepsPerBand: activeSalaryTable.stepsPerBand,
        salaryBandCount: activeSalaryTable.salaryBandCount,
        rankStartLetter: "S",
        rankEndLetter: "D",
      })
    }
  }, [activeSalaryTable])

  // リアルタイムプレビュー計算
  const calculationResult = useMemo<SalaryTableCalculationResult | null>(() => {
    if (!debouncedFormValues.baseSalaryMin || !debouncedFormValues.stepsPerBand || !debouncedFormValues.salaryBandCount || grades.length === 0) {
      return null
    }

    try {
      const result = calculateSalaryTable(
        {
          baseSalaryMin: debouncedFormValues.baseSalaryMin || SALARY_TABLE_DEFAULTS.baseSalaryMin,
          initialStepDiff: debouncedFormValues.initialStepDiff || SALARY_TABLE_DEFAULTS.initialStepDiff,
          bandIncreaseRate: debouncedFormValues.bandIncreaseRate || SALARY_TABLE_DEFAULTS.bandIncreaseRate,
          stepsPerBand: debouncedFormValues.stepsPerBand || SALARY_TABLE_DEFAULTS.stepsPerBand,
          salaryBandCount: debouncedFormValues.salaryBandCount || SALARY_TABLE_DEFAULTS.salaryBandCount,
          rankStartLetter: (debouncedFormValues.rankStartLetter || "S") as "S" | "A" | "B" | "C" | "D" | "E" | "F",
          rankEndLetter: (debouncedFormValues.rankEndLetter || "D") as "S" | "A" | "B" | "C" | "D" | "E" | "F",
          gradeBandOverrides: gradeBandOverrides.length > 0 ? gradeBandOverrides : undefined,
          roundingMethod: (debouncedFormValues.roundingMethod || "none") as "none" | "ceil" | "floor" | "round",
          roundingUnit: (debouncedFormValues.roundingUnit || 1) as 1 | 10 | 100 | 1000 | 10000,
        },
        grades
      )

      return result
    } catch (error) {
      console.error("計算エラー:", error)
      return null
    }
  }, [debouncedFormValues, grades, gradeBandOverrides])

  // フォーム値変更ハンドラー
  const handleValuesChange = useCallback((values: Partial<SalaryTableFormData>) => {
    setFormValues(values)
  }, [])

  // 等級別開始号俸帯変更ハンドラー
  const handleGradeStartBandChange = useCallback((gradeId: string, startBand: number) => {
    setGradeBandOverrides(prev => {
      const existing = prev.find(o => o.gradeId === gradeId)
      if (existing) {
        return prev.map(o =>
          o.gradeId === gradeId ? { ...o, startBand } : o
        )
      } else {
        return [...prev, { gradeId, startBand }]
      }
    })
  }, [])

  // 号俸テーブル作成
  const createMutation = useMutation({
    mutationFn: async (data: SalaryTableFormData) => {
      const res = await fetch("/api/salary-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "号俸テーブルの作成に失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-tables", companyId] })
      router.push(`/companies/${companyId}/salary-table`)
    },
  })

  // 号俸テーブル更新
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SalaryTableFormData }) => {
      const res = await fetch(`/api/salary-tables/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "号俸テーブルの更新に失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-tables", companyId] })
      queryClient.invalidateQueries({ queryKey: ["salary-table-detail"] })
      setShowConfirmDialog(false)
      setPendingFormData(null)
      router.push(`/companies/${companyId}/salary-table`)
    },
  })

  const handleSubmit = (data: SalaryTableFormData) => {
    if (activeSalaryTable) {
      setPendingFormData(data)
      setShowConfirmDialog(true)
    } else {
      createMutation.mutate(data)
    }
  }

  const handleConfirmUpdate = () => {
    if (pendingFormData && activeSalaryTable) {
      updateMutation.mutate({ id: activeSalaryTable.id, data: pendingFormData })
    }
  }

  const isLoading = isLoadingTables || createMutation.isPending || updateMutation.isPending
  const isCalculating = debouncedFormValues !== formValues

  // 計算されたMAX（号俸列の最上位）
  const calculatedMax = useMemo(() => {
    if (!calculationResult) return 0
    return calculationResult.baseSalaryMax
  }, [calculationResult])

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
      <div className="container mx-auto py-1 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href={`/companies/${companyId}/salary-table`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  戻る
                </Button>
              </Link>
            </div>
            <h1 className="text-2xl font-bold">
              {isEditMode ? "号俸テーブル設定の編集" : "号俸テーブル設定"}
            </h1>
            <p className="text-muted-foreground">
              号俸テーブルのパラメータを設定し、自動生成します
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full container mx-auto py-2">
          {isLoadingTables ? (
            <div className="grid lg:grid-cols-[1fr_2fr] gap-6 h-full">
              <Skeleton className="h-full w-full" />
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_2fr] gap-6 h-full">
              {/* 左カラム: 入力パネル（固定） */}
              <div className="overflow-hidden">
                <SalaryTableInputPanel
                  companyId={companyId}
                  defaultValues={activeSalaryTable}
                  calculatedMax={calculatedMax}
                  onValuesChange={handleValuesChange}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  isEditMode={isEditMode}
                />
              </div>

              {/* 右カラム: リアルタイムプレビュー（スクロール可能） */}
              <div className="overflow-y-auto pb-6">
                <SalaryTableRealtimePreview
                  calculationResult={calculationResult}
                  grades={grades}
                  onGradeStartBandChange={handleGradeStartBandChange}
                  isCalculating={isCalculating}
                />
              </div>
            </div>
          )}

          {createMutation.isError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>{createMutation.error.message}</AlertDescription>
            </Alert>
          )}

          {updateMutation.isError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>{updateMutation.error.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* 更新確認ダイアログ */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>テーブルの再生成</DialogTitle>
            <DialogDescription>
              {SALARY_TABLE_UI_TEXT.CONFIRM_REGENERATE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false)
                setPendingFormData(null)
              }}
            >
              {SALARY_TABLE_UI_TEXT.CANCEL}
            </Button>
            <Button onClick={handleConfirmUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? SALARY_TABLE_UI_TEXT.LOADING : SALARY_TABLE_UI_TEXT.CONFIRM}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
