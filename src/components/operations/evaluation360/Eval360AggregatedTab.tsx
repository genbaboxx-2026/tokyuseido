"use client"

import React, { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  CheckCircle2,
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

interface Eval360AggregatedTabProps {
  companyId: string
  periodId: string
  onStatusChange: () => void
}

type Phase360 = "preparing" | "distributing" | "aggregated" | "completed"

interface Record360 {
  id: string
  employeeId: string
  status: string
  currentPhase: Phase360
  reviewerCount: number
  submittedCount: number
  progress: number
  employee: {
    id: string
    firstName: string
    lastName: string
    grade: { name: string } | null
    jobType: { name: string } | null
    department: { name: string } | null
  }
}

// ステータスの日本語表示
const status360Labels: Record<string, string> = {
  draft: "下書き",
  preparing_items: "項目準備中",
  preparing_reviewers: "評価者選定中",
  ready: "配布準備完了",
  distributing: "配布中",
  collecting: "回収中",
  aggregated: "集計済み",
  completed: "完了",
}

export function Eval360AggregatedTab({
  companyId,
  periodId,
  onStatusChange,
}: Eval360AggregatedTabProps) {
  const queryClient = useQueryClient()
  const currentTabPhase: Phase360 = "aggregated"

  // 全レコードを取得（全タブでキャッシュ共有）
  const { data, isLoading } = useQuery<{ records: Record360[] }>({
    queryKey: ["360Records", companyId, periodId, "all"],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360?includeAll=true`
      )
      if (!res.ok) throw new Error("データの取得に失敗しました")
      return res.json()
    },
    staleTime: 30000,
  })

  // ローカルでソート（アクティブなものを先頭に）
  const records = useMemo(() => {
    const recs = data?.records ?? []
    return [...recs].sort((a, b) => {
      const aActive = a.currentPhase === currentTabPhase
      const bActive = b.currentPhase === currentTabPhase
      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1
      return 0
    })
  }, [data?.records, currentTabPhase])

  // 一括確定mutation
  const bulkCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/bulk-complete`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("一括確定に失敗しました")
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["360Records", companyId, periodId],
      })
      onStatusChange()
      alert(data.message)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const activeCount = records.filter(r => r.currentPhase === currentTabPhase).length

  if (records.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            全員を一括確定
          </Button>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          評価対象者がいません
        </div>
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

      {/* レコード一覧 */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">被評価者</TableHead>
            <TableHead className="w-[80px]">等級</TableHead>
            <TableHead className="w-[100px]">職種</TableHead>
            <TableHead className="w-[80px] text-center">回収率</TableHead>
            <TableHead className="w-[100px] text-right">合計平均</TableHead>
            <TableHead className="w-[100px]">状態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const isCompleted = record.currentPhase === "completed"
            const isAggregated = record.currentPhase === "aggregated"

            return (
              <TableRow
                key={record.id}
                className={isCompleted ? "opacity-50" : ""}
              >
                <TableCell className="font-medium">
                  {record.employee.lastName} {record.employee.firstName}
                </TableCell>
                <TableCell className="text-sm">
                  {record.employee.grade?.name || "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {record.employee.jobType?.name || "-"}
                </TableCell>
                <TableCell className="text-center">
                  {isAggregated ? `${record.progress}%` : "-"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {isAggregated ? "-" /* 実際のAPIから取得 */ : "-"}
                </TableCell>
                <TableCell>
                  {isAggregated ? (
                    <Badge className="bg-purple-100 text-purple-800">
                      集計済み
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500">
                      {status360Labels[record.status] || record.status}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
