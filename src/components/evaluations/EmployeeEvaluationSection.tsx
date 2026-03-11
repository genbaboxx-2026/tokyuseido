"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
  Save,
  Loader2,
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
  evaluator360Ids?: string[]
  individualEvaluatorId?: string | null
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
  const queryClient = useQueryClient()
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false)
  const [employeeStatuses, setEmployeeStatuses] = useState<Record<string, EvaluationStatusType>>({})
  // 360度評価の評価者設定 (employeeId -> [evaluator1Id, evaluator2Id, ...])
  const [evaluators, setEvaluators] = useState<Record<string, (string | null)[]>>({})
  // 360度評価の初期評価者設定（変更検知用）
  const [initialEvaluators, setInitialEvaluators] = useState<Record<string, (string | null)[]>>({})
  // 360度評価者の保存中フラグ
  const [isSaving360Evaluators, setIsSaving360Evaluators] = useState(false)
  // 個別評価の評価者設定 (employeeId -> evaluatorId)
  const [individualEvaluators, setIndividualEvaluators] = useState<Record<string, string | null>>({})
  // 個別評価の初期評価者設定（変更検知用）
  const [initialIndividualEvaluators, setInitialIndividualEvaluators] = useState<Record<string, string | null>>({})
  // 個別評価者の保存中フラグ
  const [isSavingIndividualEvaluators, setIsSavingIndividualEvaluators] = useState(false)
  // リアルタイムプレビュー用のスコア（モーダル編集中）
  const [previewScores, setPreviewScores] = useState<Record<string, number>>({})

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
    _debug?: unknown
  }>({
    queryKey: ["evaluationMaxScores", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/evaluation-max-scores?companyId=${companyId}`)
      if (!res.ok) {
        return { maxScores360: {}, maxScoresIndividual: {}, maxScorePerItem: 5 }
      }
      const data = await res.json()
      return data
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // 評価タイプに応じた満点を取得（プレビュースコアがあればそちらを優先）
  const getMaxScore = (employeeId: string): number => {
    // プレビュースコアがあればそちらを使用（リアルタイム更新）
    if (previewScores[employeeId] !== undefined) {
      return previewScores[employeeId]
    }
    if (evaluationType === "360") {
      return maxScoresData?.maxScores360?.[employeeId] ?? 0
    } else {
      return maxScoresData?.maxScoresIndividual?.[employeeId] ?? 0
    }
  }

  // モーダルからのスコア変更を受け取る（リアルタイム更新）
  const handleScoreChange = useCallback((employeeId: string, totalScore: number) => {
    setPreviewScores((prev) => ({ ...prev, [employeeId]: totalScore }))
  }, [])

  // モーダルが閉じたときにプレビュースコアをクリアしてキャッシュを更新
  const handleDialogClose = useCallback((open: boolean) => {
    setIsItemsDialogOpen(open)
    if (!open) {
      // モーダルが閉じたらプレビュースコアをクリア
      setPreviewScores({})
      // キャッシュを更新して最新データを取得
      queryClient.invalidateQueries({ queryKey: ["evaluationMaxScores", companyId] })
    }
  }, [companyId, queryClient])

  // 評価ステータスをDBから取得
  const { data: dbStatuses } = useQuery<Array<{ employeeId: string; status: string }>>({
    queryKey: ["evaluationStatuses", companyId, evaluationType],
    queryFn: async () => {
      const type = evaluationType === "360" ? "360" : "individual"
      const res = await fetch(`/api/employees/evaluation-statuses?companyId=${companyId}&type=${type}`)
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 30 * 1000, // 30秒キャッシュ
    gcTime: 60 * 1000,
  })

  // DBから取得したステータスをローカルステートに同期
  useEffect(() => {
    if (dbStatuses && dbStatuses.length > 0) {
      const statusMap: Record<string, EvaluationStatusType> = {}
      dbStatuses.forEach((item) => {
        statusMap[item.employeeId] = item.status as EvaluationStatusType
      })
      setEmployeeStatuses((prev) => ({ ...prev, ...statusMap }))
    }
  }, [dbStatuses])

  // 従業員データから360度評価者を同期（DBが常に最新）
  useEffect(() => {
    if (employees && employees.length > 0 && evaluationType === "360") {
      const dbEvaluators: Record<string, (string | null)[]> = {}
      employees.forEach((emp) => {
        // DBから取得した評価者IDを5枠の配列に変換
        const evaluatorSlots: (string | null)[] = [null, null, null, null, null]
        if (emp.evaluator360Ids && emp.evaluator360Ids.length > 0) {
          emp.evaluator360Ids.forEach((id, idx) => {
            if (idx < 5) {
              evaluatorSlots[idx] = id
            }
          })
        }
        dbEvaluators[emp.id] = evaluatorSlots
      })
      setEvaluators(dbEvaluators)
      setInitialEvaluators(JSON.parse(JSON.stringify(dbEvaluators)))
    }
  }, [employees, evaluationType])

  // 従業員データから個別評価の評価者を同期（DBが常に最新）
  useEffect(() => {
    if (employees && employees.length > 0 && evaluationType === "individual") {
      const dbIndividualEvaluators: Record<string, string | null> = {}
      employees.forEach((emp) => {
        dbIndividualEvaluators[emp.id] = emp.individualEvaluatorId ?? null
      })
      setIndividualEvaluators(dbIndividualEvaluators)
      setInitialIndividualEvaluators(dbIndividualEvaluators)
    }
  }, [employees, evaluationType])

  const handleViewItems = (employee: Employee) => {
    setSelectedEmployee(employee)
    setIsItemsDialogOpen(true)
  }

  const handleStatusChange = (employeeId: string, newStatus: EvaluationStatusType) => {
    // 楽観的更新: 先にUIを更新
    const previousStatus = employeeStatuses[employeeId]
    setEmployeeStatuses((prev) => ({ ...prev, [employeeId]: newStatus }))

    // 評価タイプに応じて適切なAPIエンドポイントを呼び出す
    const apiUrl = evaluationType === "360"
      ? `/api/employees/${employeeId}/evaluation-360-status`
      : `/api/employees/${employeeId}/evaluation-items`

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
      .then((res) => {
        if (res.ok) {
          // 成功したらキャッシュを無効化（親コンポーネントのタブ表示更新のため）
          queryClient.invalidateQueries({ queryKey: ["evaluationStatuses", companyId] })
        }
      })
      .catch(() => {
        // エラー時は元に戻す
        setEmployeeStatuses((prev) => ({ ...prev, [employeeId]: previousStatus || "NOT_STARTED" }))
      })
  }

  const handleDialogStatusChange = (employeeId: string, status: EvaluationStatusType) => {
    setEmployeeStatuses((prev) => ({ ...prev, [employeeId]: status }))
  }

  // 評価者をDBに保存（360度評価）
  const saveEvaluatorsToDb = useCallback(async (employeeId: string, evaluatorIds: (string | null)[]) => {
    // nullを除いた有効なIDのみを保存
    const validIds = evaluatorIds.filter((id): id is string => id !== null)
    try {
      await fetch(`/api/employees/${employeeId}/evaluators-360`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluatorIds: validIds }),
      })
    } catch (error) {
      console.error("評価者の保存に失敗しました:", error)
    }
  }, [])

  // 個別評価の評価者をDBに保存
  const saveIndividualEvaluatorToDb = useCallback(async (employeeId: string, evaluatorId: string | null) => {
    const res = await fetch(`/api/employees/${employeeId}/evaluator-individual`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evaluatorId }),
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error("個別評価の評価者保存エラー:", { status: res.status, error: errorData })
      throw new Error(errorData.error || `保存に失敗しました (${res.status})`)
    }
    return res.json()
  }, [])

  // 評価者を変更（ローカル状態のみ更新、保存はボタンで）
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

  // 評価者が重複しているかチェック
  const isEvaluatorDuplicated = (employeeId: string, index: number): boolean => {
    const empEvaluators = evaluators[employeeId] || [null, null, null, null, null]
    const currentValue = empEvaluators[index]
    if (!currentValue) return false
    // 同じ行の他のセルに同じ評価者がいるかチェック
    return empEvaluators.some((ev, idx) => idx !== index && ev === currentValue)
  }

  // 各従業員が評価者として選ばれている回数をカウント
  const getEvaluatorCount = (employeeId: string): number => {
    let count = 0
    Object.values(evaluators).forEach((empEvaluators) => {
      empEvaluators.forEach((ev) => {
        if (ev === employeeId) count++
      })
    })
    return count
  }

  // 個別評価の評価者を変更（ローカル状態のみ更新、保存はボタンで）
  const handleIndividualEvaluatorChange = (employeeId: string, evaluatorId: string | null) => {
    setIndividualEvaluators((prev) => ({ ...prev, [employeeId]: evaluatorId }))
  }

  // 個別評価の評価者を一括変更（ローカル状態のみ更新）
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

  // 360度評価の評価者に変更があるか確認
  const hasUnsaved360Evaluators = useMemo(() => {
    if (evaluationType !== "360") return false
    return Object.keys(evaluators).some((empId) => {
      const current = evaluators[empId] || []
      const initial = initialEvaluators[empId] || []
      return JSON.stringify(current) !== JSON.stringify(initial)
    })
  }, [evaluators, initialEvaluators, evaluationType])

  // 個別評価の評価者に変更があるか確認
  const hasUnsavedIndividualEvaluators = useMemo(() => {
    if (evaluationType !== "individual") return false
    return Object.keys(individualEvaluators).some(
      (empId) => individualEvaluators[empId] !== initialIndividualEvaluators[empId]
    )
  }, [individualEvaluators, initialIndividualEvaluators, evaluationType])

  // 360度評価の評価者を一括保存
  const handleSave360Evaluators = async () => {
    setIsSaving360Evaluators(true)
    try {
      // 変更があった評価者のみ保存
      const changedEntries = Object.entries(evaluators).filter(([empId, evIds]) => {
        const initial = initialEvaluators[empId] || []
        return JSON.stringify(evIds) !== JSON.stringify(initial)
      })

      if (changedEntries.length === 0) {
        alert("変更がありません")
        return
      }

      await Promise.all(
        changedEntries.map(([empId, evIds]) => saveEvaluatorsToDb(empId, evIds))
      )

      // 保存成功後、初期値を更新
      setInitialEvaluators(JSON.parse(JSON.stringify(evaluators)))

      // 従業員データを再取得
      queryClient.invalidateQueries({ queryKey: ["employees", companyId] })

      alert("評価者を保存しました")
    } catch (error) {
      console.error("評価者保存エラー:", error)
      alert("評価者の保存に失敗しました")
    } finally {
      setIsSaving360Evaluators(false)
    }
  }

  // 個別評価の評価者を一括保存
  const handleSaveIndividualEvaluators = async () => {
    setIsSavingIndividualEvaluators(true)
    try {
      // 変更があった評価者のみ保存
      const changedEntries = Object.entries(individualEvaluators).filter(
        ([empId, evId]) => evId !== initialIndividualEvaluators[empId]
      )

      if (changedEntries.length === 0) {
        alert("変更がありません")
        return
      }

      await Promise.all(
        changedEntries.map(([empId, evId]) => saveIndividualEvaluatorToDb(empId, evId))
      )

      // 保存成功後、初期値を更新
      setInitialIndividualEvaluators({ ...individualEvaluators })

      // 従業員データを再取得
      queryClient.invalidateQueries({ queryKey: ["employees", companyId] })

      alert("評価者を保存しました")
    } catch (error) {
      console.error("評価者保存エラー:", error)
      alert("評価者の保存に失敗しました")
    } finally {
      setIsSavingIndividualEvaluators(false)
    }
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

    // 評価タイプに応じて適切なAPIエンドポイントを呼び出す
    const getApiUrl = (empId: string) => evaluationType === "360"
      ? `/api/employees/${empId}/evaluation-360-status`
      : `/api/employees/${empId}/evaluation-items`

    // バックグラウンドでAPI呼び出し
    Promise.all(
      filteredEmployees.map((emp) =>
        fetch(getApiUrl(emp.id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        })
      )
    )
      .then(() => {
        // 成功したらキャッシュを無効化（親コンポーネントのタブ表示更新のため）
        queryClient.invalidateQueries({ queryKey: ["evaluationStatuses", companyId] })
      })
      .catch(() => {
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
          {evaluationType === "360" && (
            <Button
              onClick={handleSave360Evaluators}
              disabled={!hasUnsaved360Evaluators || isSaving360Evaluators}
              variant={hasUnsaved360Evaluators ? "default" : "outline"}
              className={hasUnsaved360Evaluators ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              {isSaving360Evaluators ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving360Evaluators ? "保存中..." : hasUnsaved360Evaluators ? "評価者を保存" : "変更なし"}
            </Button>
          )}
          {evaluationType === "individual" && (
            <Button
              onClick={handleSaveIndividualEvaluators}
              disabled={!hasUnsavedIndividualEvaluators || isSavingIndividualEvaluators}
              variant={hasUnsavedIndividualEvaluators ? "default" : "outline"}
              className={hasUnsavedIndividualEvaluators ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              {isSavingIndividualEvaluators ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSavingIndividualEvaluators ? "保存中..." : hasUnsavedIndividualEvaluators ? "評価者を保存" : "変更なし"}
            </Button>
          )}
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
                            {evaluationType === "360" && (
                              <span className="text-muted-foreground font-normal ml-1">
                                ({getEvaluatorCount(employee.id)})
                              </span>
                            )}
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
                          {[0, 1, 2, 3, 4].map((idx) => {
                            const isDuplicated = isEvaluatorDuplicated(employee.id, idx)
                            return (
                              <TableCell key={idx}>
                                <Select
                                  value={empEvaluators[idx] || "none"}
                                  onValueChange={(value) =>
                                    handleEvaluatorChange(employee.id, idx, value === "none" ? null : value)
                                  }
                                >
                                  <SelectTrigger
                                    className={`w-[110px] h-8 text-xs ${
                                      isDuplicated ? "border-red-500 border-2 bg-red-50" : ""
                                    }`}
                                  >
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
                            )
                          })}
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
          onOpenChange={handleDialogClose}
          employee={selectedEmployee}
          rolesData={rolesData}
          companyId={companyId}
          onScoreChange={handleScoreChange}
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
