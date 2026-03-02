"use client"

import { use, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Settings, Users, List, Grid } from "lucide-react"
import { SalaryTableMatrix, SalaryTableDetailView } from "@/components/salary-table"
import { SALARY_TABLE_UI_TEXT, calculateSalaryTable } from "@/lib/salary-table"
import type { SalaryTableMatrixRow } from "@/types/salary"

interface SalaryTableViewPageProps {
  params: Promise<{ companyId: string }>
}

/**
 * DBから取得したデータ（旧用語）
 */
interface SalaryTableDataFromDB {
  id: string
  companyId: string
  name: string
  baseSalaryMax: number
  baseSalaryMin: number
  rankDivision: number      // DB用語 → stepsPerBand
  increaseRate: number      // DB用語 → bandIncreaseRate
  initialStepDiff: number
  totalRanks: number        // DB用語 → salaryBandCount
  isActive: boolean
}

/**
 * APIから取得したデータ（新用語）
 */
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

interface SalaryTableDetailResponse {
  salaryTable: SalaryTableData
  grades: { id: string; name: string; level: number }[]
  rows: SalaryTableMatrixRow[]
  company: { id: string; name: string }
}

/**
 * DBデータを新用語に変換
 */
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

export default function SalaryTableViewPage({ params }: SalaryTableViewPageProps) {
  const { companyId } = use(params)
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"detail" | "matrix">("detail")

  // 号俸テーブル一覧取得
  const { data: salaryTables, isLoading: isLoadingTables } = useQuery<SalaryTableData[]>({
    queryKey: ["salary-tables", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/salary-tables?companyId=${companyId}`)
      if (!res.ok) throw new Error("号俸テーブルの取得に失敗しました")
      const data: SalaryTableDataFromDB[] = await res.json()
      return data.map(mapDbDataToNewTerms)
    },
  })

  // アクティブな号俸テーブルを取得
  const activeSalaryTable = salaryTables?.find((t) => t.isActive)

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

  // 詳細ビュー用のデータを計算
  const detailViewData = useMemo(() => {
    if (!activeSalaryTable || !tableDetail?.grades || tableDetail.grades.length === 0) return null

    const grades = tableDetail.grades
    const result = calculateSalaryTable(
      {
        baseSalaryMin: activeSalaryTable.baseSalaryMin,
        initialStepDiff: activeSalaryTable.initialStepDiff,
        bandIncreaseRate: activeSalaryTable.bandIncreaseRate,
        stepsPerBand: activeSalaryTable.stepsPerBand,
        salaryBandCount: activeSalaryTable.salaryBandCount,
      },
      grades
    )

    // 等級ごとのレンジをMapに変換
    const gradeRanges = new Map<string, { min: number; max: number; startStep: number; endStep: number }>(
      result.gradeBandAssignments.map(a => [
        a.gradeId,
        { min: a.minSalary, max: a.maxSalary, startStep: a.startStep, endStep: a.endStep }
      ])
    )

    // 旧形式のstepsを生成（salaryLadderから）
    const steps = result.salaryLadder.map(step => ({
      stepNumber: step.stepNumber,
      rank: step.rank,
      baseSalary: step.baseSalary,
      stepDiff: step.stepDiff,
      bandNumber: step.bandNumber,
      isBandBoundary: step.stepNumber % activeSalaryTable.stepsPerBand === 1,
      increaseAmount: step.stepDiff,
      bandIncreaseRate: activeSalaryTable.bandIncreaseRate,
      annualSalary: step.annualSalary,
    })).reverse() // 号俸が高い方から表示

    return {
      steps,
      grades,
      gradeRanges,
      baseSalaryMin: result.baseSalaryMin,
      baseSalaryMax: result.baseSalaryMax,
      totalSteps: result.totalSteps,
      stepsPerBand: activeSalaryTable.stepsPerBand,
    }
  }, [activeSalaryTable, tableDetail?.grades])

  const isLoading = isLoadingTables || isLoadingDetail

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{SALARY_TABLE_UI_TEXT.TABLE_VIEW_TITLE}</h1>
            <p className="text-muted-foreground">
              等級 x ランクのマトリクス表示
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/companies/${companyId}/salary-table`)}
          >
            <Settings className="mr-2 h-4 w-4" />
            設定
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/companies/${companyId}/salary-table/employees`)}
          >
            <Users className="mr-2 h-4 w-4" />
            {SALARY_TABLE_UI_TEXT.EMPLOYEE_MAPPING_TITLE}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[600px] w-full" />
          </CardContent>
        </Card>
      ) : tableDetail && detailViewData ? (
        <>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="detail">
                <List className="mr-2 h-4 w-4" />
                号俸詳細
              </TabsTrigger>
              <TabsTrigger value="matrix">
                <Grid className="mr-2 h-4 w-4" />
                等級×ランク マトリクス
              </TabsTrigger>
            </TabsList>

            <TabsContent value="detail" className="mt-6">
              <SalaryTableDetailView
                steps={detailViewData.steps}
                grades={detailViewData.grades}
                gradeRanges={detailViewData.gradeRanges}
                baseSalaryMin={detailViewData.baseSalaryMin}
                baseSalaryMax={detailViewData.baseSalaryMax}
                totalSteps={detailViewData.totalSteps}
                stepsPerBand={detailViewData.stepsPerBand}
              />
            </TabsContent>

            <TabsContent value="matrix" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{tableDetail.salaryTable.name}</CardTitle>
                  <CardDescription>
                    等級: {tableDetail.grades.length} |
                    号俸数: {tableDetail.rows.length} |
                    基本給: {new Intl.NumberFormat("ja-JP").format(tableDetail.salaryTable.baseSalaryMin)} 〜{" "}
                    {new Intl.NumberFormat("ja-JP").format(tableDetail.salaryTable.baseSalaryMax)}円
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SalaryTableMatrix
                    grades={tableDetail.grades}
                    rows={tableDetail.rows}
                    showAnnualSalary
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{SALARY_TABLE_UI_TEXT.NO_DATA}</p>
            <Button
              className="mt-4"
              onClick={() => router.push(`/companies/${companyId}/salary-table`)}
            >
              号俸テーブルを作成する
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
