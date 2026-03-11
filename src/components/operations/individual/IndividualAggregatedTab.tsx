"use client"

import React, { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import {
  Loader2,
  CheckCircle2,
} from "lucide-react"
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
const AggregationSummaryModal = dynamic(
  () => import("./AggregationSummaryModal").then((mod) => mod.AggregationSummaryModal),
  { ssr: false }
)

interface IndividualAggregatedTabProps {
  companyId: string
  periodId: string
  onStatusChange: () => void
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
}

export function IndividualAggregatedTab({
  companyId,
  periodId,
  onStatusChange,
}: IndividualAggregatedTabProps) {
  const queryClient = useQueryClient()
  const currentTabPhase: Phase = "aggregated"
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [summaryEvaluationId, setSummaryEvaluationId] = useState<string | null>(null)

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

  // 集計フェーズの評価のみフィルタ
  const activeEvaluations = evaluations.filter((e) => e.currentPhase === currentTabPhase)

  // 一括確定mutation
  const bulkCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/bulk-complete`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("一括確定に失敗しました")
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

  const handleRowClick = (evaluation: Evaluation) => {
    // AggregationSummaryModalを開く
    setSummaryEvaluationId(evaluation.id)
    setSummaryModalOpen(true)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const activeCount = activeEvaluations.length

  return (
    <div className="space-y-4">
      {/* 一括操作ボタン */}
      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={bulkCompleteMutation.isPending || activeCount === 0}
            >
              {bulkCompleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              全員を一括確定
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>一括確定を実行しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                {activeCount}件の評価を確定します。確定後は編集できません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => bulkCompleteMutation.mutate()}>
                一括確定
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {activeEvaluations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          集計対象の評価がありません
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">被評価者名</TableHead>
              <TableHead className="w-[80px]">等級</TableHead>
              <TableHead className="w-[100px]">職種</TableHead>
              <TableHead className="w-[100px] text-right">自己合計</TableHead>
              <TableHead className="w-[100px] text-right">上司合計</TableHead>
              <TableHead className="w-[80px] text-right">満点</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeEvaluations.map((evaluation) => {
              const { selfTotal, evaluatorTotal, maxTotal } = calculateScores(evaluation)

              return (
                <TableRow
                  key={evaluation.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(evaluation)}
                >
                  <TableCell className="font-medium">
                    <span className="text-blue-600 hover:underline cursor-pointer">
                      {evaluation.employee.lastName} {evaluation.employee.firstName}
                    </span>
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
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {/* 集計サマリーモーダル */}
      <AggregationSummaryModal
        open={summaryModalOpen}
        onOpenChange={setSummaryModalOpen}
        companyId={companyId}
        periodId={periodId}
        evaluationId={summaryEvaluationId}
      />
    </div>
  )
}
