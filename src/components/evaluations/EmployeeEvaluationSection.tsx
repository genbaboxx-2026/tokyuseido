"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  UserCircle,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GradeRoleData } from "./EvaluationTemplateDialog"

// モーダルを遅延読み込み
const EmployeeEvaluationItemsDialog = dynamic(
  () => import("./EmployeeEvaluationItemsDialog").then((mod) => mod.EmployeeEvaluationItemsDialog),
  { ssr: false }
)
const Employee360EvaluationItemsDialog = dynamic(
  () => import("./Employee360EvaluationItemsDialog").then((mod) => mod.Employee360EvaluationItemsDialog),
  { ssr: false }
)

// 従業員型
export interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  department?: { name: string } | null
  jobType?: { id: string; name: string } | null
  grade?: { id: string; name: string } | null
  gradeId?: string | null
  jobTypeId?: string | null
  has360Evaluation?: boolean
  hasIndividualEvaluation?: boolean
}

// 評価ステータス型
export type EvaluationStatusType = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FEEDBACK_DONE"

interface EmployeeEvaluationSectionProps {
  companyId: string
  evaluationType: "individual" | "360"
}

export function EmployeeEvaluationSection({
  companyId,
  evaluationType,
}: EmployeeEvaluationSectionProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false)
  const [employeeStatuses, setEmployeeStatuses] = useState<Record<string, EvaluationStatusType>>({})
  // 360度評価の評価者設定 (employeeId -> [evaluator1Id, evaluator2Id, ...])
  const [evaluators, setEvaluators] = useState<Record<string, (string | null)[]>>({})
  // 個別評価の評価者設定 (employeeId -> evaluatorId)
  const [individualEvaluators, setIndividualEvaluators] = useState<Record<string, string | null>>({})

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ["employees", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/employees?companyId=${companyId}&limit=100`)
      if (!res.ok) throw new Error("従業員の取得に失敗しました")
      const data = await res.json()
      return data.employees || []
    },
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
    gcTime: 10 * 60 * 1000, // 10分間保持
  })

  const { data: rolesData } = useQuery<GradeRoleData[]>({
    queryKey: ["gradeRoles", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/grades/roles?companyId=${companyId}`)
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // 評価項目のカスタムステータスを取得
  const { data: customStatusMap } = useQuery<Record<string, boolean>>({
    queryKey: ["evaluationCustomStatus", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/evaluation-custom-status?companyId=${companyId}`)
      if (!res.ok) return {}
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: evaluationType === "individual",
  })

  // 満点を取得
  const { data: maxScoresData } = useQuery<{
    maxScores360: Record<string, number>
    maxScoresIndividual: Record<string, number>
    maxScorePerItem: number
  }>({
    queryKey: ["evaluationMaxScores", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/evaluation-max-scores?companyId=${companyId}`)
      if (!res.ok) {
        return { maxScores360: {}, maxScoresIndividual: {}, maxScorePerItem: 5 }
      }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // 評価タイプに応じた満点を取得
  const getMaxScore = (employeeId: string): number => {
    if (evaluationType === "360") {
      return maxScoresData?.maxScores360?.[employeeId] ?? 0
    } else {
      return maxScoresData?.maxScoresIndividual?.[employeeId] ?? 0
    }
  }

  const handleViewItems = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsItemsDialogOpen(true)
  }

  const handleStatusChange = (employeeId: string, newStatus: EvaluationStatusType) => {
    // 楽観的更新: 先にUIを更新
    const previousStatus = employeeStatuses[employeeId]
    setEmployeeStatuses((prev) => ({ ...prev, [employeeId]: newStatus }))

    // バックグラウンドでAPI呼び出し
    fetch(`/api/employees/${employeeId}/evaluation-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {
      // エラー時は元に戻す
      setEmployeeStatuses((prev) => ({ ...prev, [employeeId]: previousStatus || "NOT_STARTED" }))
    })
  }

  const handleDialogStatusChange = (employeeId: string, status: EvaluationStatusType) => {
    setEmployeeStatuses((prev) => ({ ...prev, [employeeId]: status }))
  }

  // 評価者を変更
  const handleEvaluatorChange = (employeeId: string, index: number, evaluatorId: string | null) => {
    setEvaluators((prev) => {
      const current = prev[employeeId] || [null, null, null, null, null]
      const updated = [...current]
      updated[index] = evaluatorId
      return { ...prev, [employeeId]: updated }
    })
  }

  // 評価者の表示名を取得
  const getEmployeeName = (empId: string | null): string => {
    if (!empId) return ""
    const emp = employees?.find((e) => e.id === empId)
    return emp ? `${emp.lastName} ${emp.firstName}` : ""
  }

  // 個別評価の評価者を変更
  const handleIndividualEvaluatorChange = (employeeId: string, evaluatorId: string | null) => {
    setIndividualEvaluators((prev) => ({ ...prev, [employeeId]: evaluatorId }))
  }

  // 個別評価の評価者を一括変更
  const handleBulkIndividualEvaluatorChange = (evaluatorId: string | null) => {
    if (filteredEmployees.length === 0) return
    const newEvaluators: Record<string, string | null> = {}
    filteredEmployees.forEach((emp) => {
      // 評価者は自分以外のみ設定可能
      if (evaluatorId && evaluatorId !== emp.id) {
        newEvaluators[emp.id] = evaluatorId
      } else if (!evaluatorId) {
        newEvaluators[emp.id] = null
      }
    })
    setIndividualEvaluators((prev) => ({ ...prev, ...newEvaluators }))
  }

  // 評価タイプに応じて従業員をフィルタリング
  const filteredEmployees = employees?.filter((emp) => {
    if (evaluationType === "360") {
      return emp.has360Evaluation === true
    } else {
      return emp.hasIndividualEvaluation === true
    }
  }) || []

  const allCompleted = filteredEmployees.length > 0 &&
    filteredEmployees.every((emp) => employeeStatuses[emp.id] === "COMPLETED")

  const handleBulkStatusChange = (completed: boolean) => {
    if (filteredEmployees.length === 0) return

    const newStatus: EvaluationStatusType = completed ? "COMPLETED" : "NOT_STARTED"

    // 楽観的更新: 先にUIを全員分更新
    const previousStatuses = { ...employeeStatuses }
    const newStatuses: Record<string, EvaluationStatusType> = {}
    filteredEmployees.forEach((emp) => {
      newStatuses[emp.id] = newStatus
    })
    setEmployeeStatuses((prev) => ({ ...prev, ...newStatuses }))

    // バックグラウンドでAPI呼び出し
    Promise.all(
      filteredEmployees.map((emp) =>
        fetch(`/api/employees/${emp.id}/evaluation-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        })
      )
    ).catch(() => {
      // エラー時は元に戻す
      setEmployeeStatuses(previousStatuses)
    })
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {evaluationType === "individual" ? (
                <>
                  <UserCircle className="h-5 w-5" />
                  個別評価
                </>
              ) : (
                <>
                  <Users className="h-5 w-5" />
                  360度評価
                </>
              )}
            </CardTitle>
            <CardDescription>
              {evaluationType === "individual"
                ? "上司による従業員の個別評価を行います"
                : "複数評価者による多面評価を行います"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            読み込み中...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{evaluationType === "360" ? "360度評価対象の従業員がいません" : "個別評価対象の従業員がいません"}</p>
            <p className="text-xs mt-1">従業員管理で評価対象にチェックを入れてください</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">氏名</TableHead>
                  <TableHead className="w-[120px]">職種</TableHead>
                  <TableHead className="w-[80px]">等級</TableHead>
                  {evaluationType === "individual" && (
                    <TableHead className="w-[80px] text-center">変更</TableHead>
                  )}
                  {evaluationType === "360" ? (
                    <>
                      <TableHead className="w-[120px]">評価者1</TableHead>
                      <TableHead className="w-[120px]">評価者2</TableHead>
                      <TableHead className="w-[120px]">評価者3</TableHead>
                      <TableHead className="w-[120px]">評価者4</TableHead>
                      <TableHead className="w-[120px]">評価者5</TableHead>
                    </>
                  ) : (
                    <TableHead className="w-[180px]">
                      <div className="flex items-center gap-2">
                        <span>評価者</span>
                        <Select
                          value=""
                          onValueChange={(value) =>
                            handleBulkIndividualEvaluatorChange(value === "none" ? null : value)
                          }
                        >
                          <SelectTrigger className="w-[110px] h-7 text-xs">
                            <SelectValue placeholder="一括選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">クリア</SelectItem>
                            {employees?.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.lastName} {e.firstName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                  )}
                  <TableHead className="text-center w-[80px]">満点</TableHead>
                  <TableHead className="text-center w-[100px]">
                    <div className="flex items-center justify-center gap-2">
                      <span>完了</span>
                      <Checkbox
                        checked={allCompleted ?? false}
                        onCheckedChange={(checked) => handleBulkStatusChange(!!checked)}
                        disabled={filteredEmployees.length === 0}
                        title="全員の完了を一括で切り替え"
                      />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => {
                  const empEvaluators = evaluators[employee.id] || [null, null, null, null, null]
                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleViewItems(employee)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <span className="font-medium">
                            {employee.lastName} {employee.firstName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{employee.jobType?.name ?? "-"}</TableCell>
                      <TableCell>{employee.grade?.name ?? "-"}</TableCell>
                      {evaluationType === "individual" && (
                        <TableCell className="text-center">
                          {customStatusMap?.[employee.id] ? (
                            <span className="text-xs text-amber-600 font-medium">変更有</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                      {evaluationType === "360" ? (
                        <>
                          {[0, 1, 2, 3, 4].map((idx) => (
                            <TableCell key={idx}>
                              <Select
                                value={empEvaluators[idx] || "none"}
                                onValueChange={(value) =>
                                  handleEvaluatorChange(employee.id, idx, value === "none" ? null : value)
                                }
                              >
                                <SelectTrigger className="w-[110px] h-8 text-xs">
                                  <SelectValue placeholder="選択">
                                    {empEvaluators[idx] ? getEmployeeName(empEvaluators[idx]) : "-"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">-</SelectItem>
                                  {employees
                                    ?.filter((e) => e.id !== employee.id)
                                    .map((e) => (
                                      <SelectItem key={e.id} value={e.id}>
                                        {e.lastName} {e.firstName}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          ))}
                        </>
                      ) : (
                        <TableCell>
                          <Select
                            value={individualEvaluators[employee.id] || "none"}
                            onValueChange={(value) =>
                              handleIndividualEvaluatorChange(employee.id, value === "none" ? null : value)
                            }
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue placeholder="選択">
                                {individualEvaluators[employee.id] ? getEmployeeName(individualEvaluators[employee.id]) : "-"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-</SelectItem>
                              {employees
                                ?.filter((e) => e.id !== employee.id)
                                .map((e) => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.lastName} {e.firstName}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <span className="text-sm font-medium tabular-nums">
                          {getMaxScore(employee.id) > 0 ? getMaxScore(employee.id) : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={employeeStatuses[employee.id] === "COMPLETED"}
                            onCheckedChange={(checked) =>
                              handleStatusChange(employee.id, checked ? "COMPLETED" : "NOT_STARTED")
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>

      {evaluationType === "individual" ? (
        <EmployeeEvaluationItemsDialog
          open={isItemsDialogOpen}
          onOpenChange={setIsItemsDialogOpen}
          employee={selectedEmployee}
          rolesData={rolesData}
          companyId={companyId}
        />
      ) : (
        <Employee360EvaluationItemsDialog
          open={isItemsDialogOpen}
          onOpenChange={setIsItemsDialogOpen}
          employee={selectedEmployee}
          companyId={companyId}
          onStatusChange={handleDialogStatusChange}
        />
      )}
    </>
  )
}
