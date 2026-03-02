"use client"

import React, { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Eval360CompletedTabProps {
  companyId: string
  periodId: string
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
  completedAt: string | null
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

export function Eval360CompletedTab({
  companyId,
  periodId,
}: Eval360CompletedTabProps) {
  const currentTabPhase: Phase360 = "completed"

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        評価対象者がいません
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* レコード一覧 */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">被評価者</TableHead>
            <TableHead className="w-[80px]">等級</TableHead>
            <TableHead className="w-[100px]">職種</TableHead>
            <TableHead className="w-[80px] text-center">回収率</TableHead>
            <TableHead className="w-[100px] text-right">合計平均</TableHead>
            <TableHead className="w-[100px]">確定日</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const isCompletedPhase = record.currentPhase === "completed"
            const completedDate = record.completedAt
              ? new Date(record.completedAt).toLocaleDateString("ja-JP")
              : "-"

            return (
              <TableRow
                key={record.id}
                className={!isCompletedPhase ? "opacity-50" : ""}
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
                  {isCompletedPhase ? `${record.progress}%` : "-"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {isCompletedPhase ? "-" /* 実際のAPIから取得 */ : "-"}
                </TableCell>
                <TableCell>
                  {isCompletedPhase ? (
                    <Badge className="bg-green-100 text-green-800">
                      {completedDate}
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
