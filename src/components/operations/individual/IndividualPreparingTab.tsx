"use client"

import React, { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import {
  Loader2,
  FileText,
  Copy,
  AlertTriangle,
  Minus,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type Phase,
  type EvaluationStatus,
  type Evaluation,
  type Employee,
  type EvaluationItem,
  type ItemFormData,
  statusOptions,
  defaultItemForm,
} from "./IndividualPreparingTypes"

// モーダルを遅延読み込み
const EvaluationDetailModal = dynamic(
  () => import("./EvaluationDetailModal").then((mod) => mod.EvaluationDetailModal),
  { ssr: false }
)
const ItemFormDialog = dynamic(
  () => import("./ItemFormDialog").then((mod) => mod.ItemFormDialog),
  { ssr: false }
)
const DeleteItemDialog = dynamic(
  () => import("./ItemFormDialog").then((mod) => mod.DeleteItemDialog),
  { ssr: false }
)

interface IndividualPreparingTabProps {
  companyId: string
  periodId: string
  onStatusChange: () => void
}

export function IndividualPreparingTab({
  companyId,
  periodId,
  onStatusChange,
}: IndividualPreparingTabProps) {
  const queryClient = useQueryClient()
  const currentTabPhase: Phase = "preparing"
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // 項目編集用の状態
  const [editingItem, setEditingItem] = useState<EvaluationItem | null>(null)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [itemForm, setItemForm] = useState<ItemFormData>(defaultItemForm)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)

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

  // 一括テンプレ生成mutation
  const bulkGenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/bulk-generate-items`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("一括生成に失敗しました")
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["individualEvaluations", companyId, periodId],
      })
      onStatusChange()
      alert(data.message)
    },
  })

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
      onStatusChange()
    },
  })

  // 項目追加mutation
  const addItemMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      if (!selectedEvaluation) throw new Error("評価が選択されていません")
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/${selectedEvaluation.id}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )
      if (!res.ok) throw new Error("項目の追加に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["individualEvaluations", companyId, periodId],
      })
      setItemFormOpen(false)
      setItemForm(defaultItemForm)
    },
  })

  // 項目更新mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: ItemFormData }) => {
      if (!selectedEvaluation) throw new Error("評価が選択されていません")
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/${selectedEvaluation.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )
      if (!res.ok) throw new Error("項目の更新に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["individualEvaluations", companyId, periodId],
      })
      setItemFormOpen(false)
      setEditingItem(null)
      setItemForm(defaultItemForm)
    },
  })

  // 項目削除mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!selectedEvaluation) throw new Error("評価が選択されていません")
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/${selectedEvaluation.id}/items/${itemId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("項目の削除に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["individualEvaluations", companyId, periodId],
      })
      setDeleteItemId(null)
    },
  })

  // 未設定のSTARTED件数を計算
  const noItemCount = evaluations.filter(
    (e) => e.currentPhase === currentTabPhase && e.status === "STARTED" && e.itemStats.total === 0
  ).length

  const handleRowClick = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation)
    setModalOpen(true)
  }

  const handleAddItem = () => {
    setEditingItem(null)
    setItemForm(defaultItemForm)
    setItemFormOpen(true)
  }

  const handleEditItem = (item: EvaluationItem) => {
    setEditingItem(item)
    setItemForm({
      name: item.templateItem?.name || "",
      description: item.templateItem?.description || "",
      category: item.templateItem?.category || "一般",
      maxScore: item.templateItem?.maxScore || 5,
    })
    setItemFormOpen(true)
  }

  const handleSaveItem = () => {
    if (editingItem) {
      updateItemMutation.mutate({ itemId: editingItem.id, data: itemForm })
    } else {
      addItemMutation.mutate(itemForm)
    }
  }

  const handleDeleteItem = (itemId: string) => {
    setDeleteItemId(itemId)
  }

  const confirmDeleteItem = () => {
    if (deleteItemId) {
      deleteItemMutation.mutate(deleteItemId)
    }
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
      {/* 一括操作ボタン */}
      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkGenerateMutation.isPending || noItemCount === 0}
            >
              {bulkGenerateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-1" />
              )}
              一括テンプレ生成
              {noItemCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {noItemCount}
                </Badge>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>一括テンプレート生成を実行しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                下書き状態の{noItemCount}件に対して、等級・職種に応じたテンプレートから評価項目を生成します。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => bulkGenerateMutation.mutate()}>
                実行
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button variant="outline" size="sm" disabled>
          <Copy className="h-4 w-4 mr-1" />
          一括前期コピー
        </Button>
      </div>

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
            const isCompleted = evaluation.currentPhase === "completed"

            return (
              <TableRow
                key={evaluation.id}
                className={`${isCompleted ? "opacity-50" : ""}`}
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
                    disabled={isCompleted || updateEvaluationMutation.isPending}
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
      <EvaluationDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        evaluation={currentEvaluation}
        onAddItem={handleAddItem}
        onEditItem={handleEditItem}
        onDeleteItem={handleDeleteItem}
      />

      {/* 項目編集ダイアログ */}
      <ItemFormDialog
        open={itemFormOpen}
        onOpenChange={setItemFormOpen}
        editingItem={editingItem}
        formData={itemForm}
        onFormChange={setItemForm}
        onSave={handleSaveItem}
        isSaving={addItemMutation.isPending || updateItemMutation.isPending}
      />

      {/* 削除確認ダイアログ */}
      <DeleteItemDialog
        open={!!deleteItemId}
        onOpenChange={() => setDeleteItemId(null)}
        onConfirm={confirmDeleteItem}
        isDeleting={deleteItemMutation.isPending}
      />
    </div>
  )
}
