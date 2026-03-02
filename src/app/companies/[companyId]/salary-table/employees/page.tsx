"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Settings, Table2 } from "lucide-react"
import { EmployeeMappingTable } from "@/components/salary-table"
import { SALARY_TABLE_UI_TEXT } from "@/lib/salary-table"
import type { EmployeeSalaryMatch } from "@/types/salary"

interface EmployeesPageProps {
  params: Promise<{ companyId: string }>
}

interface SalaryTableData {
  id: string
  name: string
  isActive: boolean
}

interface EmployeeMappingResponse {
  matches: EmployeeSalaryMatch[]
  summary: {
    total: number
    exactMatch: number
    approximate: number
    outOfRange: number
    gradeMismatch: number
    notAssigned: number
  }
  salaryTable: {
    id: string
    name: string
  }
}

export default function EmployeeMappingPage({ params }: EmployeesPageProps) {
  const { companyId } = use(params)
  const router = useRouter()

  // 号俸テーブル一覧取得
  const { data: salaryTables, isLoading: isLoadingTables } = useQuery<SalaryTableData[]>({
    queryKey: ["salary-tables", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/salary-tables?companyId=${companyId}`)
      if (!res.ok) throw new Error("号俸テーブルの取得に失敗しました")
      return res.json()
    },
  })

  // アクティブな号俸テーブルを取得
  const activeSalaryTable = salaryTables?.find((t) => t.isActive)

  // 従業員当てはめデータ取得
  const {
    data: mappingData,
    isLoading: isLoadingMapping,
  } = useQuery<EmployeeMappingResponse>({
    queryKey: ["salary-table-employees", activeSalaryTable?.id],
    queryFn: async () => {
      const res = await fetch(`/api/salary-tables/${activeSalaryTable!.id}/employees`)
      if (!res.ok) throw new Error("従業員当てはめデータの取得に失敗しました")
      return res.json()
    },
    enabled: !!activeSalaryTable?.id,
  })

  const isLoading = isLoadingTables || isLoadingMapping

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{SALARY_TABLE_UI_TEXT.EMPLOYEE_MAPPING_TITLE}</h1>
            <p className="text-muted-foreground">
              従業員の等級・給与と号俸テーブルの照合結果
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
            onClick={() => router.push(`/companies/${companyId}/salary-table/view`)}
          >
            <Table2 className="mr-2 h-4 w-4" />
            {SALARY_TABLE_UI_TEXT.TABLE_VIEW_TITLE}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-[400px] w-full" />
            </CardContent>
          </Card>
        </div>
      ) : mappingData ? (
        <EmployeeMappingTable
          matches={mappingData.matches}
          summary={mappingData.summary}
          salaryTableName={mappingData.salaryTable.name}
        />
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
