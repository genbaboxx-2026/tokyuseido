"use client"

import React, { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, CheckCircle2 } from "lucide-react"
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Eval360SummaryModal } from "./Eval360SummaryModal"

interface Eval360AggregatedTabProps {
  companyId: string
  periodId: string
  onStatusChange: () => void
}

interface AggregationRecord {
  id: string
  employeeId: string
  employee: {
    id: string
    firstName: string
    lastName: string
    grade: { id: string; name: string } | null
    jobType: { id: string; name: string } | null
    department: { id: string; name: string } | null
  }
  status: "aggregated" | "completed"
  isAnonymous: boolean
  collectionRate: string
  reviewerScores: Array<{ label: string; totalScore: number }>
  averageScore: number
  maxScore: number
  percentage: number
  completedAt: string | null
}

export function Eval360AggregatedTab({
  companyId,
  periodId,
  onStatusChange,
}: Eval360AggregatedTabProps) {
  const queryClient = useQueryClient()
  const [selectedEmployee, setSelectedEmployee] = useState<{
    employeeId: string
    name: string
    grade?: string
    jobType?: string
    status: "aggregated" | "completed"
  } | null>(null)

  // 集計テーブル用データを取得
  const { data, isLoading } = useQuery<{ records: AggregationRecord[] }>({
    queryKey: ["360AggregationSummary", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/aggregation-summary`
      )
      if (!res.ok) throw new Error("データの取得に失敗しました")
      return res.json()
    },
    staleTime: 30000,
  })

  // 全レコードから最大の評価者数を取得（テーブルヘッダー用）
  const maxReviewerCount = useMemo(() => {
    if (!data?.records) return 0
    return Math.max(...data.records.map((r) => r.reviewerScores.length), 0)
  }, [data?.records])

  // 集計済みのレコード数
  const aggregatedRecords = useMemo(() => {
    return data?.records?.filter((r) => r.status === "aggregated") || []
  }, [data?.records])

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
        queryKey: ["360AggregationSummary", companyId, periodId],
      })
      queryClient.invalidateQueries({
        queryKey: ["360Records", companyId, periodId],
      })
      queryClient.invalidateQueries({
        queryKey: ["360PhaseCounts", companyId, periodId],
      })
      onStatusChange()
      alert(data.message)
    },
  })

  const handleEmployeeClick = (record: AggregationRecord) => {
    setSelectedEmployee({
      employeeId: record.employeeId,
      name: `${record.employee.lastName} ${record.employee.firstName}`,
      grade: record.employee.grade?.name,
      jobType: record.employee.jobType?.name,
      status: record.status,
    })
  }

  const handleModalComplete = () => {
    queryClient.invalidateQueries({
      queryKey: ["360AggregationSummary", companyId, periodId],
    })
    onStatusChange()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const records = data?.records ?? []

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
          集計対象の評価者がいません
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
              disabled={bulkCompleteMutation.isPending || aggregatedRecords.length === 0}
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
                {aggregatedRecords.length}件の評価を確定します。確定後は編集できません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => bulkCompleteMutation.mutate()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                一括確定
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <span className="text-sm text-muted-foreground self-center">
          集計済み: {aggregatedRecords.length}件
        </span>
      </div>

      {/* レコード一覧（横スクロール対応） */}
      <ScrollArea className="w-full whitespace-nowrap rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px] sticky left-0 bg-white z-10">
                被評価者
              </TableHead>
              <TableHead className="w-[80px]">等級</TableHead>
              <TableHead className="w-[100px]">職種</TableHead>
              <TableHead className="w-[80px] text-center">回収率</TableHead>
              {Array.from({ length: maxReviewerCount }, (_, i) => (
                <TableHead key={i} className="w-[80px] text-center">
                  評価者{String.fromCharCode(65 + i)}
                </TableHead>
              ))}
              <TableHead className="w-[100px] text-center bg-blue-50">
                合計平均
              </TableHead>
              <TableHead className="w-[100px]">状態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => {
              const isCompleted = record.status === "completed"
              const isAggregated = record.status === "aggregated"

              return (
                <TableRow
                  key={record.id}
                  className={isCompleted ? "opacity-50" : ""}
                >
                  <TableCell className="font-medium sticky left-0 bg-white z-10">
                    <button
                      onClick={() => handleEmployeeClick(record)}
                      className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                    >
                      {record.employee.lastName} {record.employee.firstName}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm">
                    {record.employee.grade?.name || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {record.employee.jobType?.name || "-"}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {record.collectionRate}
                  </TableCell>
                  {Array.from({ length: maxReviewerCount }, (_, i) => {
                    const score = record.reviewerScores[i]
                    return (
                      <TableCell key={i} className="text-center">
                        {score ? score.totalScore : "-"}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-center font-medium bg-blue-50">
                    {record.averageScore}
                  </TableCell>
                  <TableCell>
                    {isAggregated ? (
                      <Badge className="bg-purple-100 text-purple-800">
                        集計済み
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">
                        完了
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* 詳細モーダル */}
      {selectedEmployee && (
        <Eval360SummaryModal
          open={!!selectedEmployee}
          onOpenChange={(open) => !open && setSelectedEmployee(null)}
          companyId={companyId}
          periodId={periodId}
          employeeId={selectedEmployee.employeeId}
          employeeName={selectedEmployee.name}
          employeeGrade={selectedEmployee.grade}
          employeeJobType={selectedEmployee.jobType}
          status={selectedEmployee.status}
          onComplete={handleModalComplete}
        />
      )}
    </div>
  )
}
