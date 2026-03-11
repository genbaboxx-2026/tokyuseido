"use client"

import { use, useState, useMemo, useCallback, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Table2, Settings, AlertTriangle, Sliders, Wallet } from "lucide-react"

// 重いコンポーネントを遅延読み込み（タブ切り替え時に読み込まれる）
const SalaryTableMatrix = dynamic(
  () => import("@/components/salary-table").then((mod) => mod.SalaryTableMatrix),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
)
const SalaryTablePreview = dynamic(
  () => import("@/components/salary-table").then((mod) => mod.SalaryTablePreview),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
)
const SalaryTableInputPanel = dynamic(
  () => import("@/components/salary-table").then((mod) => mod.SalaryTableInputPanel),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
)
const SalaryTableRealtimePreview = dynamic(
  () => import("@/components/salary-table").then((mod) => mod.SalaryTableRealtimePreview),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
)
const SalaryTableSpreadsheet = dynamic(
  () => import("@/components/salary-table").then((mod) => mod.SalaryTableSpreadsheet),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
)
const SalaryAdjustmentCriteria = dynamic(
  () => import("@/components/salary-table").then((mod) => mod.SalaryAdjustmentCriteria),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
)
const CurrentSalaryTab = dynamic(
  () => import("@/components/salary-table").then((mod) => mod.CurrentSalaryTab),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
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
import type { SalaryTableMatrixRow, SalaryTableChange } from "@/types/salary"

interface SalaryTablePageProps {
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

interface SalaryTableDetailResponse {
  salaryTable: SalaryTableData
  grades: Grade[]
  rows: SalaryTableMatrixRow[]
  company: { id: string; name: string }
}

interface PreviewResponse {
  current: {
    salaryTable: SalaryTableData
    grades: Grade[]
    rows: SalaryTableMatrixRow[]
  }
  preview: {
    salaryTable: SalaryTableData
    grades: Grade[]
    rows: SalaryTableMatrixRow[]
  }
  changes: SalaryTableChange[]
  employeeImpacts: {
    employeeId: string
    employeeName: string
    gradeName: string
    currentBaseSalary: number
    currentStep: number | null
    currentRank: string | null
    newStep: number | null
    newRank: string | null
    tableBaseSalary: number | null
    difference: number
  }[]
  summary: {
    totalChanges: number
    affectedEmployees: number
    totalEmployees: number
  }
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

export default function SalaryTablePage({ params }: SalaryTablePageProps) {
  const { companyId } = use(params)
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<"settings" | "table" | "criteria" | "current-salary">("settings")
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
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

  // 従業員一覧取得（テーブル表示用）
  const { data: employees = [] } = useQuery<{
    id: string
    firstName: string
    lastName: string
    gradeId: string | null
    baseSalary: number | null
  }[]>({
    queryKey: ["employees", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/employees?companyId=${companyId}`)
      if (!res.ok) throw new Error("従業員の取得に失敗しました")
      const data = await res.json()
      return data.employees || data
    },
  })

  const activeSalaryTable = salaryTables?.find((t) => t.isActive)

  // 現基本給一覧取得
  const { data: currentSalaries } = useQuery<{
    employees: {
      employeeId: string
      currentSalary: number | null
    }[]
  }>({
    queryKey: ["current-salaries", activeSalaryTable?.id],
    queryFn: async () => {
      const res = await fetch(`/api/salary-tables/${activeSalaryTable!.id}/current-salaries`)
      if (!res.ok) throw new Error("現基本給の取得に失敗しました")
      return res.json()
    },
    enabled: !!activeSalaryTable?.id,
  })

  // 従業員データと現基本給をマージ（現基本給を優先）
  const employeesWithCurrentSalary = useMemo(() => {
    if (!currentSalaries?.employees) return employees

    const currentSalaryMap = new Map(
      currentSalaries.employees.map((e) => [e.employeeId, e.currentSalary])
    )

    return employees.map((emp) => {
      const currentSalary = currentSalaryMap.get(emp.id)
      return {
        ...emp,
        baseSalary: currentSalary ?? emp.baseSalary,
      }
    })
  }, [employees, currentSalaries])

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

  // 号俸テーブル詳細取得
  const {
    data: tableDetail,
    isLoading: isLoadingDetail,
  } = useQuery<SalaryTableDetailResponse>({
    queryKey: ["salary-table-detail", activeSalaryTable?.id],
    queryFn: async () => {
      const res = await fetch(`/api/salary-tables/${activeSalaryTable!.id}`)
      if (!res.ok) throw new Error("号俸テーブル詳細の取得に失敗しました")
      return res.json()
    },
    enabled: !!activeSalaryTable?.id,
  })

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
      setActiveTab("table")
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
      setPreviewData(null)
      setActiveTab("table")
    },
  })

  // プレビュー取得
  const previewMutation = useMutation({
    mutationFn: async (data: SalaryTableFormData) => {
      const res = await fetch(`/api/salary-tables/${activeSalaryTable!.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "プレビューの取得に失敗しました")
      }
      return res.json() as Promise<PreviewResponse>
    },
    onSuccess: (data) => {
      setPreviewData(data)
      setShowPreviewDialog(true)
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
            <h1 className="text-2xl font-bold">{SALARY_TABLE_UI_TEXT.PAGE_TITLE}</h1>
            <p className="text-muted-foreground">
              号俸テーブルのパラメータを設定し、自動生成します
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mt-4">
          <TabsList>
            <TabsTrigger value="current-salary" disabled={!activeSalaryTable}>
              <Wallet className="mr-2 h-4 w-4" />
              現基本給設定
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              詳細設定
            </TabsTrigger>
            <TabsTrigger value="table" disabled={!activeSalaryTable}>
              <Table2 className="mr-2 h-4 w-4" />
              テーブル
            </TabsTrigger>
            <TabsTrigger value="criteria" disabled={!activeSalaryTable}>
              <Sliders className="mr-2 h-4 w-4" />
              改定基準
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "settings" && (
          <div className="h-full container mx-auto">
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
                    isEditMode={!!activeSalaryTable}
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
        )}

        {activeTab === "table" && (
          <div className="h-full container mx-auto overflow-hidden py-2">
            {!calculationResult ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {SALARY_TABLE_UI_TEXT.NO_DATA}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    等級: {grades.length} |
                    総号俸数: {calculationResult.totalSteps} |
                    号俸帯数: {calculationResult.totalBands} |
                    基本給: ¥{new Intl.NumberFormat("ja-JP").format(calculationResult.baseSalaryMin)} 〜 ¥{new Intl.NumberFormat("ja-JP").format(calculationResult.baseSalaryMax)}
                  </div>
                </div>
                <SalaryTableSpreadsheet
                  calculationResult={calculationResult}
                  grades={grades}
                  employees={employeesWithCurrentSalary}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "criteria" && (
          <div className="h-full container mx-auto overflow-y-auto py-2 pb-6">
            {!calculationResult || !activeSalaryTable ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  号俸テーブルが設定されていません
                </CardContent>
              </Card>
            ) : (
              <SalaryAdjustmentCriteria
                salaryTableId={activeSalaryTable.id}
                calculationResult={calculationResult}
                grades={grades}
                employees={employeesWithCurrentSalary}
                rankStartLetter={formValues.rankStartLetter}
                rankEndLetter={formValues.rankEndLetter}
              />
            )}
          </div>
        )}

        {activeTab === "current-salary" && (
          <div className="h-full container mx-auto overflow-y-auto py-2 pb-6">
            {!activeSalaryTable ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  号俸テーブルが設定されていません
                </CardContent>
              </Card>
            ) : (
              <CurrentSalaryTab salaryTableId={activeSalaryTable.id} />
            )}
          </div>
        )}
      </div>

      {/* プレビューダイアログ */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{SALARY_TABLE_UI_TEXT.PREVIEW_TITLE}</DialogTitle>
            <DialogDescription>
              変更内容を確認してください
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <SalaryTablePreview
              changes={previewData.changes}
              employeeImpacts={previewData.employeeImpacts}
              summary={previewData.summary}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
