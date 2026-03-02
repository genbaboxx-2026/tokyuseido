"use client"

import React, { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  FileText,
  CheckCircle2,
  Users,
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

interface Eval360PreparingTabProps {
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
  isAnonymous: boolean
  evaluationMethod: string
  reviewerCount: number
  categoryCount: number
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

export function Eval360PreparingTab({
  companyId,
  periodId,
  onStatusChange,
}: Eval360PreparingTabProps) {
  const queryClient = useQueryClient()
  const currentTabPhase: Phase360 = "preparing"

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

  // 一括テンプレ生成mutation
  const bulkGenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/bulk-generate-items`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("一括生成に失敗しました")
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

  if (records.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            <FileText className="h-4 w-4 mr-1" />
            一括テンプレ生成
          </Button>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          評価対象者がいません
        </div>
      </div>
    )
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return { label: "下書き", color: "bg-gray-100 text-gray-800" }
      case "preparing_items":
        return { label: "項目準備中", color: "bg-blue-100 text-blue-800" }
      case "preparing_reviewers":
        return { label: "評価者選定中", color: "bg-blue-100 text-blue-800" }
      case "ready":
        return { label: "配布準備完了", color: "bg-green-100 text-green-800" }
      default:
        return { label: status, color: "bg-gray-100 text-gray-800" }
    }
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
              disabled={bulkGenerateMutation.isPending}
            >
              {bulkGenerateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-1" />
              )}
              一括テンプレ生成
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>一括テンプレート生成を実行しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                下書き状態の全被評価者に対して、等級・職種に応じたテンプレートから評価項目を生成します。
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
      </div>

      {/* レコード一覧 */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">被評価者</TableHead>
            <TableHead className="w-[100px]">部署</TableHead>
            <TableHead className="w-[80px]">等級</TableHead>
            <TableHead className="w-[100px]">項目状況</TableHead>
            <TableHead className="w-[100px]">評価者状況</TableHead>
            <TableHead className="w-[80px]">匿名</TableHead>
            <TableHead className="w-[120px]">状態</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const isCompleted = record.currentPhase === "completed"
            const statusInfo = getStatusLabel(record.status)

            return (
              <TableRow
                key={record.id}
                className={isCompleted ? "opacity-50" : ""}
              >
                <TableCell className="font-medium">
                  {record.employee.lastName} {record.employee.firstName}
                </TableCell>
                <TableCell className="text-sm">
                  {record.employee.department?.name || "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {record.employee.grade?.name || "-"}
                </TableCell>
                <TableCell>
                  {record.categoryCount > 0 ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      設定済み
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500">
                      未設定
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {record.reviewerCount > 0 ? (
                    <Badge className="bg-green-100 text-green-800">
                      <Users className="h-3 w-3 mr-1" />
                      {record.reviewerCount}名
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500">
                      未設定
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {record.isAnonymous ? "匿名" : "記名"}
                </TableCell>
                <TableCell>
                  <Badge className={statusInfo.color}>
                    {statusInfo.label}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
