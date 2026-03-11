"use client"

import React, { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  CheckCircle2,
  Pencil,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface IndividualCompletedTabProps {
  companyId: string
  periodId: string
  onStatusChange?: () => void
  onPhaseChange?: (phase: string) => void
}

type Phase = "preparing" | "distributing" | "collected" | "aggregated" | "completed"
type EvaluationStatus = "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"

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
    individualEvaluatorId: string | null
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

export function IndividualCompletedTab({
  companyId,
  periodId,
  onStatusChange,
  onPhaseChange,
}: IndividualCompletedTabProps) {
  const queryClient = useQueryClient()
  const currentTabPhase: Phase = "completed"
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [revertAlertOpen, setRevertAlertOpen] = useState(false)
  const [revertTarget, setRevertTarget] = useState<string | null>(null)

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

  // 完了フェーズの評価のみフィルタ
  const completedEvaluations = useMemo(() => {
    const evals = data?.evaluations ?? []
    return evals.filter((e) => e.currentPhase === currentTabPhase)
  }, [data?.evaluations, currentTabPhase])

  // 全体の評価数（完了画面に来ているかどうかの判定用）
  const totalEvaluations = data?.evaluations ?? []
  const allCompleted = totalEvaluations.length > 0 &&
    totalEvaluations.every((e) => e.currentPhase === "completed")

  // フェーズ戻しmutation
  const revertPhaseMutation = useMutation({
    mutationFn: async (targetPhase: string) => {
      // ステータスマッピング
      const statusMap: Record<string, EvaluationStatus> = {
        preparing: "PREPARING",
        distributing: "DISTRIBUTED",
        aggregated: "AGGREGATING",
      }

      const targetStatus = statusMap[targetPhase]
      if (!targetStatus) throw new Error("無効なフェーズです")

      // 全完了評価のステータスを更新
      const promises = completedEvaluations.map((e) =>
        fetch(
          `/api/companies/${companyId}/operations/${periodId}/individual/${e.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: targetStatus }),
          }
        )
      )

      await Promise.all(promises)
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["individualEvaluations", companyId, periodId],
      })
      queryClient.invalidateQueries({
        queryKey: ["individualPhaseCounts", companyId, periodId],
      })
      onStatusChange?.()
      if (revertTarget && onPhaseChange) {
        onPhaseChange(revertTarget)
      }
      setRevertAlertOpen(false)
      setRevertTarget(null)
    },
  })

  const handleRowClick = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation)
    setModalOpen(true)
  }

  const handleRevertToPhase = (phase: string) => {
    setRevertTarget(phase)
    setRevertAlertOpen(true)
  }

  const confirmRevert = () => {
    if (revertTarget) {
      revertPhaseMutation.mutate(revertTarget)
    }
  }

  // スコア計算ヘルパー
  const calculateScores = (evaluation: Evaluation) => {
    const selfTotal = evaluation.items.reduce(
      (sum, item) => sum + (item.selfScore ?? 0),
      0
    )
    const evaluatorTotal = evaluation.items.reduce(
      (sum, item) => sum + (item.evaluatorScore ?? 0),
      0
    )
    const maxTotal = evaluation.items.reduce(
      (sum, item) => sum + (item.templateItem?.maxScore ?? 0),
      0
    )
    return { selfTotal, evaluatorTotal, maxTotal }
  }

  // 選択中の評価が更新されたら最新データで置き換え
  const currentEvaluation = useMemo(() => {
    if (!selectedEvaluation) return null
    return completedEvaluations.find((e) => e.id === selectedEvaluation.id) || selectedEvaluation
  }, [selectedEvaluation, completedEvaluations])

  const phaseLabels: Record<string, string> = {
    preparing: "準備",
    distributing: "配布・回収",
    aggregated: "集計",
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (completedEvaluations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        完了した評価がありません
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 完了メッセージ（全員完了時のみ表示） */}
      {allCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-green-800 mb-2">
            個別評価が完了しました
          </h2>
          <p className="text-green-700 text-sm">
            全{completedEvaluations.length}名の評価が確定されました
          </p>
        </div>
      )}

      {/* 編集ボタン（全員完了時のみ表示） */}
      {allCompleted && (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={revertPhaseMutation.isPending}>
                {revertPhaseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4 mr-2" />
                )}
                編集する
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleRevertToPhase("preparing")}>
                準備フェーズに戻す
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRevertToPhase("distributing")}>
                配布・回収フェーズに戻す
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRevertToPhase("aggregated")}>
                集計フェーズに戻す
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* 評価一覧（読み取り専用） */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">被評価者名</TableHead>
            <TableHead className="w-[80px]">等級</TableHead>
            <TableHead className="w-[100px]">職種</TableHead>
            <TableHead className="w-[100px] text-right">自己合計</TableHead>
            <TableHead className="w-[100px] text-right">上司合計</TableHead>
            <TableHead className="w-[80px] text-right">満点</TableHead>
            <TableHead className="w-[100px]">確定日</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {completedEvaluations.map((evaluation) => {
            const { selfTotal, evaluatorTotal, maxTotal } = calculateScores(evaluation)

            return (
              <TableRow
                key={evaluation.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleRowClick(evaluation)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>{evaluation.employee.lastName} {evaluation.employee.firstName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {evaluation.employee.grade?.name || "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {evaluation.employee.jobType?.name || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-bold text-blue-600">{selfTotal}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-bold text-amber-600">{evaluatorTotal}</span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {maxTotal}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(evaluation.updatedAt).toLocaleDateString("ja-JP")}
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
            <DialogDescription>確定済み評価</DialogDescription>
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
                        {currentEvaluation.items.reduce(
                          (sum, item) => sum + (item.selfScore ?? 0),
                          0
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">自己合計</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <div className="text-xl font-bold text-amber-600">
                        {currentEvaluation.items.reduce(
                          (sum, item) => sum + (item.evaluatorScore ?? 0),
                          0
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">上長合計</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-xl font-bold">
                        {Math.abs(
                          currentEvaluation.items.reduce(
                            (sum, item) => sum + (item.selfScore ?? 0),
                            0
                          ) -
                            currentEvaluation.items.reduce(
                              (sum, item) => sum + (item.evaluatorScore ?? 0),
                              0
                            )
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
                        const itemsByCategory = currentEvaluation.items.reduce(
                          (acc, item) => {
                            const category = item.templateItem?.category || "未分類"
                            if (!acc[category]) acc[category] = []
                            acc[category].push(item)
                            return acc
                          },
                          {} as Record<string, EvaluationItem[]>
                        )

                        return Object.entries(itemsByCategory).map(
                          ([category, items]) => (
                            <div
                              key={category}
                              className="border rounded-lg overflow-hidden"
                            >
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
                                          <div
                                            className={`text-sm font-bold ${
                                              item.selfScore !== null
                                                ? "text-blue-600"
                                                : "text-gray-300"
                                            }`}
                                          >
                                            {item.selfScore ?? "-"}
                                          </div>
                                          <div className="text-[10px] text-muted-foreground">
                                            自己
                                          </div>
                                        </div>
                                        <div className="text-center">
                                          <div
                                            className={`text-sm font-bold ${
                                              item.evaluatorScore !== null
                                                ? "text-amber-600"
                                                : "text-gray-300"
                                            }`}
                                          >
                                            {item.evaluatorScore ?? "-"}
                                          </div>
                                          <div className="text-[10px] text-muted-foreground">
                                            上長
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* フェーズ戻し確認ダイアログ */}
      <AlertDialog open={revertAlertOpen} onOpenChange={setRevertAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>フェーズを戻しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              全{completedEvaluations.length}件の評価を「{revertTarget ? phaseLabels[revertTarget] : ""}」フェーズに戻します。
              この操作により、評価を再編集できるようになります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevert}>
              フェーズを戻す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
