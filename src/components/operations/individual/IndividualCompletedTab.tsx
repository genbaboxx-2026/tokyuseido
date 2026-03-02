"use client"

import React, { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Minus,
  ExternalLink,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"

interface IndividualCompletedTabProps {
  companyId: string
  periodId: string
  onStatusChange?: () => void
}

type Phase = "preparing" | "distributing" | "collected" | "aggregated" | "completed"
type EvaluationStatus = "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"

const statusOptions: { value: EvaluationStatus; label: string }[] = [
  { value: "STARTED", label: "開始" },
  { value: "PREPARING", label: "準備中" },
  { value: "DISTRIBUTED", label: "配布済" },
  { value: "COLLECTED", label: "回収済" },
  { value: "AGGREGATING", label: "集計中" },
  { value: "COMPLETED", label: "完了" },
]

interface EvaluationItem {
  id: string
  selfScore: number | null
  evaluatorScore: number | null
  comment: string | null
  templateItem: {
    id: string
    name: string
    description: string | null
    category: string
    maxScore: number
    weight: number
  } | null
}

interface Evaluator {
  id: string
  firstName: string
  lastName: string
}

interface Evaluation {
  id: string
  employeeId: string
  status: EvaluationStatus
  currentPhase: Phase
  totalScore: number | null
  hasChangesFromMaster: boolean
  employee: {
    id: string
    firstName: string
    lastName: string
    grade: { id: string; name: string } | null
    jobType: { id: string; name: string } | null
    department: { id: string; name: string } | null
  }
  evaluator: Evaluator | null
  evaluatorId: string | null
  itemStats: {
    total: number
    selfScored: number
    managerScored: number
  }
  items: EvaluationItem[]
  updatedAt: string
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  department?: { name: string } | null
}

export function IndividualCompletedTab({
  companyId,
  periodId,
  onStatusChange,
}: IndividualCompletedTabProps) {
  const queryClient = useQueryClient()
  const currentTabPhase: Phase = "completed"
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // 全評価を取得（全タブでキャッシュ共有）
  const { data, isLoading } = useQuery<{ evaluations: Evaluation[] }>({
    queryKey: ["individualEvaluations", companyId, periodId, "all"],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual?includeAll=true`
      )
      if (!res.ok) throw new Error("データの取得に失敗しました")
      return res.json()
    },
    staleTime: 30000,
  })

  // 従業員一覧を取得（評価者選択用）
  const { data: employeesData } = useQuery<{ employees: Employee[] }>({
    queryKey: ["employees", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/employees`)
      if (!res.ok) throw new Error("従業員データの取得に失敗しました")
      return res.json()
    },
    staleTime: 60000,
  })

  const employees = employeesData?.employees ?? []

  // ローカルでソート（アクティブなものを先頭に）
  const evaluations = useMemo(() => {
    const evals = data?.evaluations ?? []
    return [...evals].sort((a, b) => {
      const aActive = a.currentPhase === currentTabPhase
      const bActive = b.currentPhase === currentTabPhase
      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1
      return 0
    })
  }, [data?.evaluations, currentTabPhase])

  // 評価更新mutation（評価者・ステータス）
  const updateEvaluationMutation = useMutation({
    mutationFn: async ({ evaluationId, data }: { evaluationId: string; data: { evaluatorId?: string | null; status?: EvaluationStatus } }) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/${evaluationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )
      if (!res.ok) throw new Error("更新に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["individualEvaluations", companyId, periodId],
      })
      onStatusChange?.()
    },
  })

  const handleRowClick = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation)
    setModalOpen(true)
  }

  const handleEvaluatorChange = (evaluationId: string, evaluatorId: string | null) => {
    updateEvaluationMutation.mutate({
      evaluationId,
      data: { evaluatorId },
    })
  }

  const handleStatusChange = (evaluationId: string, status: EvaluationStatus) => {
    updateEvaluationMutation.mutate({
      evaluationId,
      data: { status },
    })
  }

  // 選択中の評価が更新されたら最新データで置き換え
  const currentEvaluation = useMemo(() => {
    if (!selectedEvaluation) return null
    return evaluations.find(e => e.id === selectedEvaluation.id) || selectedEvaluation
  }, [selectedEvaluation, evaluations])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (evaluations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        評価対象者がいません
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 評価一覧 */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">従業員名</TableHead>
            <TableHead className="w-[80px]">部署</TableHead>
            <TableHead className="w-[60px]">等級</TableHead>
            <TableHead className="w-[80px]">職種</TableHead>
            <TableHead className="w-[120px]">評価者</TableHead>
            <TableHead className="w-[60px]">変更</TableHead>
            <TableHead className="w-[100px]">状態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {evaluations.map((evaluation) => {
            const isCompletedPhase = evaluation.currentPhase === "completed"

            return (
              <TableRow
                key={evaluation.id}
                className={`${!isCompletedPhase ? "opacity-50" : ""}`}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{evaluation.employee.lastName} {evaluation.employee.firstName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleRowClick(evaluation)}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      詳細
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {evaluation.employee.department?.name || "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {evaluation.employee.grade?.name || "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {evaluation.employee.jobType?.name || "-"}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={evaluation.evaluatorId || "none"}
                    onValueChange={(value) => handleEvaluatorChange(evaluation.id, value === "none" ? null : value)}
                    disabled={updateEvaluationMutation.isPending}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未設定</SelectItem>
                      {employees
                        .filter(emp => emp.id !== evaluation.employeeId)
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.lastName} {emp.firstName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {evaluation.itemStats.total === 0 ? (
                    <Minus className="h-4 w-4 text-gray-300" />
                  ) : evaluation.hasChangesFromMaster ? (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      あり
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-400">
                      なし
                    </Badge>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={evaluation.status}
                    onValueChange={(value) => handleStatusChange(evaluation.id, value as EvaluationStatus)}
                    disabled={updateEvaluationMutation.isPending}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* 詳細モーダル */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {currentEvaluation?.employee.lastName} {currentEvaluation?.employee.firstName}
            </DialogTitle>
            <DialogDescription>
              確定済み評価
            </DialogDescription>
          </DialogHeader>
          {currentEvaluation && (
            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-4 pr-4">
                {/* 基本情報 */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">部署</div>
                    <div className="font-medium">
                      {currentEvaluation.employee.department?.name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">等級</div>
                    <div className="font-medium">
                      {currentEvaluation.employee.grade?.name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">職種</div>
                    <div className="font-medium">
                      {currentEvaluation.employee.jobType?.name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">評価者</div>
                    <div className="font-medium">
                      {currentEvaluation.evaluator
                        ? `${currentEvaluation.evaluator.lastName} ${currentEvaluation.evaluator.firstName}`
                        : "-"}
                    </div>
                  </div>
                </div>

                {/* 確定日 */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">確定日</div>
                  <div className="font-medium">
                    {new Date(currentEvaluation.updatedAt).toLocaleDateString("ja-JP")}
                  </div>
                </div>

                {/* 確定バッジ */}
                <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">この評価は確定済みです</span>
                </div>

                {/* スコア情報 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-2">最終評価スコア</div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xl font-bold text-blue-600">
                        {currentEvaluation.items.reduce((sum, item) => sum + (item.selfScore ?? 0), 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">自己合計</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <div className="text-xl font-bold text-amber-600">
                        {currentEvaluation.items.reduce((sum, item) => sum + (item.evaluatorScore ?? 0), 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">上長合計</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-xl font-bold">
                        {Math.abs(
                          currentEvaluation.items.reduce((sum, item) => sum + (item.selfScore ?? 0), 0) -
                          currentEvaluation.items.reduce((sum, item) => sum + (item.evaluatorScore ?? 0), 0)
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">差分</div>
                    </div>
                  </div>
                </div>

                {/* 評価項目一覧 */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium">評価項目一覧</div>
                    <div className="text-xs text-muted-foreground">
                      {currentEvaluation.itemStats.total}件
                    </div>
                  </div>

                  {currentEvaluation.items.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground bg-gray-50 rounded-lg">
                      評価項目がまだ設定されていません
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const itemsByCategory = currentEvaluation.items.reduce((acc, item) => {
                          const category = item.templateItem?.category || "未分類"
                          if (!acc[category]) acc[category] = []
                          acc[category].push(item)
                          return acc
                        }, {} as Record<string, EvaluationItem[]>)

                        return Object.entries(itemsByCategory).map(([category, items]) => (
                          <div key={category} className="border rounded-lg overflow-hidden">
                            <div className="bg-gray-100 px-3 py-2 text-sm font-medium">
                              {category}
                            </div>
                            <div className="divide-y">
                              {items.map((item) => (
                                <div key={item.id} className="px-3 py-3">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">
                                        {item.templateItem?.name || "項目名なし"}
                                      </div>
                                      {item.templateItem?.description && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {item.templateItem.description}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      <div className="text-center">
                                        <div className={`text-sm font-bold ${item.selfScore !== null ? "text-blue-600" : "text-gray-300"}`}>
                                          {item.selfScore ?? "-"}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">自己</div>
                                      </div>
                                      <div className="text-center">
                                        <div className={`text-sm font-bold ${item.evaluatorScore !== null ? "text-amber-600" : "text-gray-300"}`}>
                                          {item.evaluatorScore ?? "-"}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">上長</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
