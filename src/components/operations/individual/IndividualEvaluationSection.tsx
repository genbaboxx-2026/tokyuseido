"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { ClipboardCheck, Loader2, AlertCircle, UserPlus, Check } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { WorkflowStepTabs } from "../WorkflowStepTabs"
import { IndividualPreparingTab } from "./IndividualPreparingTab"
import { IndividualDistributingTab } from "./IndividualDistributingTab"
import { IndividualCollectedTab } from "./IndividualCollectedTab"
import { IndividualAggregatedTab } from "./IndividualAggregatedTab"
import { IndividualCompletedTab } from "./IndividualCompletedTab"

interface IndividualEvaluationSectionProps {
  companyId: string
  periodId: string
}

interface PhaseCounts {
  preparing: number
  distributing: number
  collected: number
  aggregated: number
  completed: number
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  grade?: { name: string } | null
  department?: { name: string } | null
}

export function IndividualEvaluationSection({
  companyId,
  periodId,
}: IndividualEvaluationSectionProps) {
  const [activeTab, setActiveTab] = useState("preparing")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const queryClient = useQueryClient()

  // フェーズカウントを取得
  const { data: phaseCounts, isLoading: isLoadingCounts } = useQuery<PhaseCounts>({
    queryKey: ["individualPhaseCounts", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/phase-counts`
      )
      if (!res.ok) throw new Error("フェーズカウントの取得に失敗しました")
      return res.json()
    },
  })

  // 個別評価対象の従業員一覧を取得（hasIndividualEvaluation=true のみ）
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["employeesIndividualTarget", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/employees?hasIndividualEvaluation=true`)
      if (!res.ok) throw new Error("従業員の取得に失敗しました")
      return res.json()
    },
    enabled: addDialogOpen,
  })

  // 個別評価レコード作成
  const createRecordsMutation = useMutation({
    mutationFn: async (employeeIds: string[]) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeIds }),
        }
      )
      if (!res.ok) throw new Error("レコード作成に失敗しました")
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["individualPhaseCounts", companyId, periodId],
      })
      queryClient.invalidateQueries({
        queryKey: ["individualEvaluations", companyId, periodId],
      })
      setAddDialogOpen(false)
      setSelectedEmployeeIds([])
      alert(data.message)
    },
  })

  const filteredEmployees = employees?.filter((emp) => {
    const fullName = `${emp.lastName}${emp.firstName}`
    return fullName.includes(searchTerm)
  }) || []

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const selectAllEmployees = () => {
    if (filteredEmployees.length === selectedEmployeeIds.length) {
      setSelectedEmployeeIds([])
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((e) => e.id))
    }
  }

  const handleAddEmployees = () => {
    if (selectedEmployeeIds.length > 0) {
      createRecordsMutation.mutate(selectedEmployeeIds)
    }
  }

  const totalCount = phaseCounts
    ? phaseCounts.preparing +
      phaseCounts.distributing +
      phaseCounts.collected +
      phaseCounts.aggregated +
      phaseCounts.completed
    : 0

  const completedCount = phaseCounts?.completed ?? 0

  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  const refreshPhaseCounts = () => {
    queryClient.invalidateQueries({
      queryKey: ["individualPhaseCounts", companyId, periodId],
    })
  }

  // ダイアログの内容をレンダリング
  const renderAddEmployeeDialogContent = () => (
    <DialogContent className="max-w-lg max-h-[80vh]">
      <DialogHeader>
        <DialogTitle>個別評価対象者を選択</DialogTitle>
        <DialogDescription>
          個別評価の対象となる従業員を選択してください。
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <Input
          placeholder="名前で検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllEmployees}
          >
            {filteredEmployees.length === selectedEmployeeIds.length
              ? "全解除"
              : "全選択"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {selectedEmployeeIds.length}名 選択中
          </span>
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-2">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedEmployeeIds.includes(emp.id)
                  ? "bg-blue-50 border-blue-300"
                  : "hover:bg-gray-50"
              }`}
              onClick={() => toggleEmployee(emp.id)}
            >
              <div>
                <p className="font-medium">
                  {emp.lastName} {emp.firstName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {emp.department?.name || "-"} / {emp.grade?.name || "-"}
                </p>
              </div>
              {selectedEmployeeIds.includes(emp.id) && (
                <Check className="h-5 w-5 text-blue-600" />
              )}
            </div>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
          キャンセル
        </Button>
        <Button
          onClick={handleAddEmployees}
          disabled={
            selectedEmployeeIds.length === 0 ||
            createRecordsMutation.isPending
          }
        >
          {createRecordsMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          {selectedEmployeeIds.length}名を追加
        </Button>
      </DialogFooter>
    </DialogContent>
  )

  if (isLoadingCounts) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">個別評価</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">個別評価</CardTitle>
          </div>
          <CardDescription>上司による従業員評価</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="mb-4">評価対象者がいません</p>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-1" />
                  対象者を追加
                </Button>
              </DialogTrigger>
              {renderAddEmployeeDialogContent()}
            </Dialog>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">個別評価</CardTitle>
            <Badge
              variant="outline"
              className={
                completedCount === totalCount
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-gray-100 text-gray-600"
              }
            >
              完了: {completedCount}/{totalCount}
            </Badge>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="h-4 w-4 mr-1" />
                対象者追加
              </Button>
            </DialogTrigger>
            {renderAddEmployeeDialogContent()}
          </Dialog>
        </div>
        <CardDescription>上司による従業員評価</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <WorkflowStepTabs
            steps={[
              { value: "preparing", label: "準備", count: phaseCounts?.preparing ?? 0 },
              { value: "distributing", label: "配布", count: phaseCounts?.distributing ?? 0 },
              { value: "collected", label: "回収", count: phaseCounts?.collected ?? 0 },
              { value: "aggregated", label: "集計", count: phaseCounts?.aggregated ?? 0 },
              { value: "completed", label: "完了", count: phaseCounts?.completed ?? 0 },
            ]}
            activeStep={activeTab}
            onStepChange={handleTabChange}
          />

          <TabsContent value="preparing" className="mt-4">
            <IndividualPreparingTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="distributing" className="mt-4">
            <IndividualDistributingTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="collected" className="mt-4">
            <IndividualCollectedTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="aggregated" className="mt-4">
            <IndividualAggregatedTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <IndividualCompletedTab
              companyId={companyId}
              periodId={periodId}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
