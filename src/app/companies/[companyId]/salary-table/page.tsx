"use client"

import { use, useState, useMemo, useCallback, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Table2, Settings, Sliders, Wallet, X, AlertTriangle, Wrench } from "lucide-react"

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

  const [activeTab, setActiveTab] = useState<"table" | "criteria">("table")
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<SalaryTableFormData | null>(null)

  // テーブル表示用のフォーム値
  const [formValues, setFormValues] = useState<{
    baseSalaryMin: number
    initialStepDiff: number
    bandIncreaseRate: number
    stepsPerBand: number
    salaryBandCount: number
    rankStartLetter: string
    rankEndLetter: string
  }>({
    baseSalaryMin: SALARY_TABLE_DEFAULTS.baseSalaryMin,
    initialStepDiff: SALARY_TABLE_DEFAULTS.initialStepDiff,
    bandIncreaseRate: SALARY_TABLE_DEFAULTS.bandIncreaseRate,
    stepsPerBand: SALARY_TABLE_DEFAULTS.stepsPerBand,
    salaryBandCount: SALARY_TABLE_DEFAULTS.salaryBandCount,
    rankStartLetter: "S",
    rankEndLetter: "D",
  })

  // モーダル内のフォーム値（独立管理）
  const [modalFormValues, setModalFormValues] = useState<Partial<SalaryTableFormData>>({})
  const [gradeBandOverrides, setGradeBandOverrides] = useState<{ gradeId: string; startBand: number }[]>([])
  const debouncedModalFormValues = useDebounce(modalFormValues, 300)

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

  const { data: grades = [] } = useQuery<Grade[]>({
    queryKey: ["grades", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/grades?companyId=${companyId}`)
      if (!res.ok) throw new Error("等級の取得に失敗しました")
      return res.json()
    },
  })

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

  // メイン画面用の計算
  const calculationResult = useMemo<SalaryTableCalculationResult | null>(() => {
    if (!formValues.baseSalaryMin || !formValues.stepsPerBand || !formValues.salaryBandCount || grades.length === 0) {
      return null
    }
    try {
      return calculateSalaryTable(
        {
          baseSalaryMin: formValues.baseSalaryMin,
          initialStepDiff: formValues.initialStepDiff,
          bandIncreaseRate: formValues.bandIncreaseRate,
          stepsPerBand: formValues.stepsPerBand,
          salaryBandCount: formValues.salaryBandCount,
          rankStartLetter: formValues.rankStartLetter as "S" | "A" | "B" | "C" | "D" | "E" | "F",
          rankEndLetter: formValues.rankEndLetter as "S" | "A" | "B" | "C" | "D" | "E" | "F",
        },
        grades
      )
    } catch {
      return null
    }
  }, [formValues, grades])

  // モーダル内プレビュー用の計算
  const modalCalculationResult = useMemo<SalaryTableCalculationResult | null>(() => {
    if (!debouncedModalFormValues.baseSalaryMin || !debouncedModalFormValues.stepsPerBand || !debouncedModalFormValues.salaryBandCount || grades.length === 0) {
      return null
    }
    try {
      return calculateSalaryTable(
        {
          baseSalaryMin: debouncedModalFormValues.baseSalaryMin || SALARY_TABLE_DEFAULTS.baseSalaryMin,
          initialStepDiff: debouncedModalFormValues.initialStepDiff || SALARY_TABLE_DEFAULTS.initialStepDiff,
          bandIncreaseRate: debouncedModalFormValues.bandIncreaseRate || SALARY_TABLE_DEFAULTS.bandIncreaseRate,
          stepsPerBand: debouncedModalFormValues.stepsPerBand || SALARY_TABLE_DEFAULTS.stepsPerBand,
          salaryBandCount: debouncedModalFormValues.salaryBandCount || SALARY_TABLE_DEFAULTS.salaryBandCount,
          rankStartLetter: (debouncedModalFormValues.rankStartLetter || "S") as "S" | "A" | "B" | "C" | "D" | "E" | "F",
          rankEndLetter: (debouncedModalFormValues.rankEndLetter || "D") as "S" | "A" | "B" | "C" | "D" | "E" | "F",
          gradeBandOverrides: gradeBandOverrides.length > 0 ? gradeBandOverrides : undefined,
          roundingMethod: (debouncedModalFormValues.roundingMethod || "none") as "none" | "ceil" | "floor" | "round",
          roundingUnit: (debouncedModalFormValues.roundingUnit || 1) as 1 | 10 | 100 | 1000 | 10000,
        },
        grades
      )
    } catch {
      return null
    }
  }, [debouncedModalFormValues, grades, gradeBandOverrides])

  const modalCalculatedMax = useMemo(() => {
    if (!modalCalculationResult) return 0
    return modalCalculationResult.baseSalaryMax
  }, [modalCalculationResult])

  const handleOpenSetupModal = useCallback(() => {
    setModalFormValues({
      baseSalaryMin: activeSalaryTable?.baseSalaryMin ?? SALARY_TABLE_DEFAULTS.baseSalaryMin,
      initialStepDiff: activeSalaryTable?.initialStepDiff ?? SALARY_TABLE_DEFAULTS.initialStepDiff,
      bandIncreaseRate: activeSalaryTable?.bandIncreaseRate ?? SALARY_TABLE_DEFAULTS.bandIncreaseRate,
      stepsPerBand: activeSalaryTable?.stepsPerBand ?? SALARY_TABLE_DEFAULTS.stepsPerBand,
      salaryBandCount: activeSalaryTable?.salaryBandCount ?? SALARY_TABLE_DEFAULTS.salaryBandCount,
      rankStartLetter: "S",
      rankEndLetter: "D",
      roundingMethod: "none",
      roundingUnit: 1,
    })
    setGradeBandOverrides([])
    setShowSetupModal(true)
  }, [activeSalaryTable])

  const handleModalValuesChange = useCallback((values: Partial<SalaryTableFormData>) => {
    setModalFormValues(values)
  }, [])

  const handleGradeStartBandChange = useCallback((gradeId: string, startBand: number) => {
    setGradeBandOverrides(prev => {
      const existing = prev.find(o => o.gradeId === gradeId)
      if (existing) {
        return prev.map(o => o.gradeId === gradeId ? { ...o, startBand } : o)
      }
      return [...prev, { gradeId, startBand }]
    })
  }, [])

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
      setShowSetupModal(false)
    },
  })

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
      setShowSetupModal(false)
    },
  })

  const handleSetupSubmit = (data: SalaryTableFormData) => {
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

  const isMutating = createMutation.isPending || updateMutation.isPending
  const isModalCalculating = debouncedModalFormValues !== modalFormValues

  if (!isLoadingTables && !activeSalaryTable) {
    return (
      <div className="h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
        <div className="container mx-auto py-1 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold">{SALARY_TABLE_UI_TEXT.PAGE_TITLE}</h1>
            <p className="text-muted-foreground">
              号俸テーブルの確認と改定基準の管理を行います
            </p>
          </div>
        </div>

        <div className="flex-1 container mx-auto py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">号俸テーブルが設定されていません</p>
              <Button onClick={handleOpenSetupModal}>号俸テーブルを設定する</Button>
            </CardContent>
          </Card>
        </div>

        <SetupModal
          open={showSetupModal}
          onOpenChange={setShowSetupModal}
          activeSalaryTable={activeSalaryTable}
          modalFormValues={modalFormValues}
          modalCalculationResult={modalCalculationResult}
          modalCalculatedMax={modalCalculatedMax}
          isModalCalculating={isModalCalculating}
          isMutating={isMutating}
          grades={grades}
          companyId={companyId}
          onValuesChange={handleModalValuesChange}
          onGradeStartBandChange={handleGradeStartBandChange}
          onSubmit={handleSetupSubmit}
          createError={createMutation.isError ? createMutation.error.message : null}
          updateError={updateMutation.isError ? updateMutation.error.message : null}
          salaryTableId={null}
        />

        <ConfirmDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          onConfirm={handleConfirmUpdate}
          isPending={updateMutation.isPending}
          onCancel={() => { setShowConfirmDialog(false); setPendingFormData(null) }}
        />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
      <div className="container mx-auto py-1 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{SALARY_TABLE_UI_TEXT.PAGE_TITLE}</h1>
            <p className="text-muted-foreground">
              号俸テーブルの確認と改定基準の管理を行います
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleOpenSetupModal}>
            <Settings className="mr-2 h-4 w-4" />
            設定を編集
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mt-4">
          <TabsList>
            <TabsTrigger value="table">
              <Table2 className="mr-2 h-4 w-4" />
              テーブル
            </TabsTrigger>
            <TabsTrigger value="criteria">
              <Sliders className="mr-2 h-4 w-4" />
              改定基準
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden">
        {isLoadingTables ? (
          <div className="h-full container mx-auto py-2">
            <Skeleton className="h-96 w-full" />
          </div>
        ) : (
          <>
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
                    <div className="text-sm text-muted-foreground">
                      等級: {grades.length} |
                      総号俸数: {calculationResult.totalSteps} |
                      号俸帯数: {calculationResult.totalBands} |
                      基本給: ¥{new Intl.NumberFormat("ja-JP").format(calculationResult.baseSalaryMin)} 〜 ¥{new Intl.NumberFormat("ja-JP").format(calculationResult.baseSalaryMax)}
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

          </>
        )}
      </div>

      <SetupModal
        open={showSetupModal}
        onOpenChange={setShowSetupModal}
        activeSalaryTable={activeSalaryTable}
        modalFormValues={modalFormValues}
        modalCalculationResult={modalCalculationResult}
        modalCalculatedMax={modalCalculatedMax}
        isModalCalculating={isModalCalculating}
        isMutating={isMutating}
        grades={grades}
        companyId={companyId}
        onValuesChange={handleModalValuesChange}
        onGradeStartBandChange={handleGradeStartBandChange}
        onSubmit={handleSetupSubmit}
        createError={createMutation.isError ? createMutation.error.message : null}
        updateError={updateMutation.isError ? updateMutation.error.message : null}
        salaryTableId={activeSalaryTable?.id ?? null}
      />

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmUpdate}
        isPending={updateMutation.isPending}
        onCancel={() => { setShowConfirmDialog(false); setPendingFormData(null) }}
      />
    </div>
  )
}

function SetupModal({
  open,
  onOpenChange,
  activeSalaryTable,
  modalFormValues,
  modalCalculationResult,
  modalCalculatedMax,
  isModalCalculating,
  isMutating,
  grades,
  companyId,
  onValuesChange,
  onGradeStartBandChange,
  onSubmit,
  createError,
  updateError,
  salaryTableId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeSalaryTable: SalaryTableData | undefined
  modalFormValues: Partial<SalaryTableFormData>
  modalCalculationResult: SalaryTableCalculationResult | null
  modalCalculatedMax: number
  isModalCalculating: boolean
  isMutating: boolean
  grades: Grade[]
  companyId: string
  onValuesChange: (values: Partial<SalaryTableFormData>) => void
  onGradeStartBandChange: (gradeId: string, startBand: number) => void
  onSubmit: (data: SalaryTableFormData) => void
  createError: string | null
  updateError: string | null
  salaryTableId: string | null
}) {
  const [modalTab, setModalTab] = useState<"current-salary" | "settings">("current-salary")

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b bg-background">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-xl font-bold">
                {activeSalaryTable ? "号俸テーブル設定の編集" : "号俸テーブル設定"}
              </h2>
            </div>
            {salaryTableId && (
              <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as typeof modalTab)}>
                <TabsList>
                  <TabsTrigger value="current-salary">
                    <Wallet className="mr-2 h-4 w-4" />
                    現基本給
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    <Wrench className="mr-2 h-4 w-4" />
                    号俸テーブル設定
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          {modalTab === "settings" && (
            <div className="h-full px-6 py-4">
              <div className="grid lg:grid-cols-[1fr_2fr] gap-6 h-full">
                <div className="overflow-y-auto">
                  <SalaryTableInputPanel
                    companyId={companyId}
                    defaultValues={activeSalaryTable}
                    calculatedMax={modalCalculatedMax}
                    onValuesChange={onValuesChange}
                    onSubmit={onSubmit}
                    isLoading={isMutating}
                    isEditMode={!!activeSalaryTable}
                  />
                </div>

                <div className="overflow-y-auto pb-6">
                  <SalaryTableRealtimePreview
                    calculationResult={modalCalculationResult}
                    grades={grades}
                    onGradeStartBandChange={onGradeStartBandChange}
                    isCalculating={isModalCalculating}
                  />
                </div>
              </div>

              {createError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>エラー</AlertTitle>
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}

              {updateError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>エラー</AlertTitle>
                  <AlertDescription>{updateError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {modalTab === "current-salary" && salaryTableId && (
            <div className="h-full px-6 py-4 overflow-y-auto">
              <CurrentSalaryTab salaryTableId={salaryTableId} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  onCancel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>テーブルの再生成</DialogTitle>
          <DialogDescription>
            {SALARY_TABLE_UI_TEXT.CONFIRM_REGENERATE}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {SALARY_TABLE_UI_TEXT.CANCEL}
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? SALARY_TABLE_UI_TEXT.LOADING : SALARY_TABLE_UI_TEXT.CONFIRM}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
