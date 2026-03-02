"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Users, Loader2, AlertCircle, UserPlus, Check } from "lucide-react"
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
import { WorkflowStepTabs } from "../WorkflowStepTabs"
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
import { Eval360PreparingTab } from "./Eval360PreparingTab"
import { Eval360DistributingTab } from "./Eval360DistributingTab"
import { Eval360AggregatedTab } from "./Eval360AggregatedTab"
import { Eval360CompletedTab } from "./Eval360CompletedTab"

interface Evaluation360SectionProps {
  companyId: string
  periodId: string
}

interface PhaseCounts {
  preparing: number
  distributing: number
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

export function Evaluation360Section({
  companyId,
  periodId,
}: Evaluation360SectionProps) {
  const [activeTab, setActiveTab] = useState("preparing")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const queryClient = useQueryClient()

  // フェーズカウントを取得
  const { data: phaseCounts, isLoading: isLoadingCounts } = useQuery<PhaseCounts>({
    queryKey: ["360PhaseCounts", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/phase-counts`
      )
      if (!res.ok) throw new Error("フェーズカウントの取得に失敗しました")
      return res.json()
    },
  })

  // 従業員一覧を取得
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["employees", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/employees`)
      if (!res.ok) throw new Error("従業員の取得に失敗しました")
      return res.json()
    },
    enabled: addDialogOpen,
  })

  // 360度評価レコード作成
  const createRecordsMutation = useMutation({
    mutationFn: async (employeeIds: string[]) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360`,
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
        queryKey: ["360PhaseCounts", companyId, periodId],
      })
      queryClient.invalidateQueries({
        queryKey: ["360Records", companyId, periodId],
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
      phaseCounts.aggregated +
      phaseCounts.completed
    : 0

  const completedCount = phaseCounts?.completed ?? 0

  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  const refreshPhaseCounts = () => {
    queryClient.invalidateQueries({
      queryKey: ["360PhaseCounts", companyId, periodId],
    })
  }

  if (isLoadingCounts) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">360度評価</CardTitle>
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

  // Add Employee Dialog Component (reusable)
  const AddEmployeeDialog = ({ buttonVariant = "default" }: { buttonVariant?: "default" | "outline" }) => (
    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonVariant === "outline" ? "sm" : "default"}>
          <UserPlus className="h-4 w-4 mr-1" />
          対象者{buttonVariant === "outline" ? "追加" : "を追加"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>360度評価対象者を選択</DialogTitle>
          <DialogDescription>
            360度評価の対象となる従業員を選択してください。
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
    </Dialog>
  )

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">360度評価</CardTitle>
          </div>
          <CardDescription>複数評価者による多面評価</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="mb-4">評価対象者がいません</p>
            <AddEmployeeDialog />
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
            <Users className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">360度評価</CardTitle>
            <Badge
              variant="outline"
              className={
                completedCount === totalCount
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-gray-100 text-gray-600"
              }
            >
              確定: {completedCount}/{totalCount}
            </Badge>
          </div>
          <AddEmployeeDialog buttonVariant="outline" />
        </div>
        <CardDescription>複数評価者による多面評価</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <WorkflowStepTabs
            steps={[
              { value: "preparing", label: "準備", count: phaseCounts?.preparing ?? 0 },
              { value: "distributing", label: "配布・回収", count: phaseCounts?.distributing ?? 0 },
              { value: "aggregated", label: "集計", count: phaseCounts?.aggregated ?? 0 },
              { value: "completed", label: "完了", count: phaseCounts?.completed ?? 0 },
            ]}
            activeStep={activeTab}
            onStepChange={handleTabChange}
          />

          <TabsContent value="preparing" className="mt-4">
            <Eval360PreparingTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="distributing" className="mt-4">
            <Eval360DistributingTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="aggregated" className="mt-4">
            <Eval360AggregatedTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <Eval360CompletedTab
              companyId={companyId}
              periodId={periodId}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
