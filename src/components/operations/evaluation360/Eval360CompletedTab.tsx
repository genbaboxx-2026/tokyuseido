"use client"

import React, { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, CheckCircle2, Edit3, ChevronDown } from "lucide-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Eval360SummaryModal } from "./Eval360SummaryModal"

interface Eval360CompletedTabProps {
  companyId: string
  periodId: string
  periodName?: string
  onPhaseChange?: (phase: string) => void
}

type Phase360 = "preparing" | "distributing" | "aggregated" | "completed"

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

const phaseLabels: Record<string, string> = {
  preparing: "準備フェーズ",
  distributing: "配布・回収フェーズ",
  aggregated: "集計フェーズ",
}

export function Eval360CompletedTab({
  companyId,
  periodId,
  periodName,
  onPhaseChange,
}: Eval360CompletedTabProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<{
    employeeId: string
    name: string
    grade?: string
    jobType?: string
    status: "aggregated" | "completed"
  } | null>(null)

  // 集計テーブル用データを取得（完了分のみ表示）
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

  // 完了レコードのみフィルタ
  const completedRecords = useMemo(() => {
    return data?.records?.filter((r) => r.status === "completed") || []
  }, [data?.records])

  // 全レコードから最大の評価者数を取得（テーブルヘッダー用）
  const maxReviewerCount = useMemo(() => {
    if (!completedRecords.length) return 0
    return Math.max(...completedRecords.map((r) => r.reviewerScores.length), 0)
  }, [completedRecords])

  const handleEmployeeClick = (record: AggregationRecord) => {
    setSelectedEmployee({
      employeeId: record.employeeId,
      name: `${record.employee.lastName} ${record.employee.firstName}`,
      grade: record.employee.grade?.name,
      jobType: record.employee.jobType?.name,
      status: record.status,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 完了件数がない場合
  if (completedRecords.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        完了した評価はありません
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 完了メッセージ */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div className="flex-grow">
            <h3 className="text-lg font-semibold text-emerald-800 mb-2">
              360度評価が完了しました
            </h3>
            <p className="text-emerald-700">
              {periodName ? `${periodName} の` : ""}360度評価が正式に完了しました。
              評価結果は各担当者に共有されます。
            </p>
            <p className="text-sm text-emerald-600 mt-2">
              完了件数: {completedRecords.length}件
            </p>
          </div>
          {onPhaseChange && (
            <div className="flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Edit3 className="h-4 w-4" />
                    編集する
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onPhaseChange("preparing")}>
                    {phaseLabels.preparing}に戻る
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPhaseChange("distributing")}>
                    {phaseLabels.distributing}に戻る
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPhaseChange("aggregated")}>
                    {phaseLabels.aggregated}に戻る
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
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
              <TableHead className="w-[120px]">確定日</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {completedRecords.map((record) => {
              const completedDate = record.completedAt
                ? new Date(record.completedAt).toLocaleDateString("ja-JP")
                : "-"

              return (
                <TableRow key={record.id}>
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
                    <Badge className="bg-green-100 text-green-800">
                      {completedDate}
                    </Badge>
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
        />
      )}
    </div>
  )
}
