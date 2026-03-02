"use client"

import React, { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  Send,
  Bell,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

interface Eval360DistributingTabProps {
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

interface ReviewerLoadItem {
  employeeId: string
  employeeName: string
  department: string | null
  assignedCount: number
  submittedCount: number
  pendingCount: number
  loadLevel: "green" | "yellow" | "red"
}

export function Eval360DistributingTab({
  companyId,
  periodId,
  onStatusChange,
}: Eval360DistributingTabProps) {
  const [activeSubTab, setActiveSubTab] = useState("subjects")
  const queryClient = useQueryClient()
  const currentTabPhase: Phase360 = "distributing"

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

  // 評価者負荷一覧を取得
  const { data: reviewerLoadData, isLoading: isLoadingLoad } = useQuery<{ reviewers: ReviewerLoadItem[] }>({
    queryKey: ["reviewerLoad", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/reviewer-load`
      )
      if (!res.ok) throw new Error("評価者負荷の取得に失敗しました")
      return res.json()
    },
    enabled: activeSubTab === "reviewers",
  })

  // 一括配布mutation
  const bulkDistributeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/bulk-distribute`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("一括配布に失敗しました")
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

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="subjects">被評価者一覧</TabsTrigger>
          <TabsTrigger value="reviewers">評価者負荷一覧</TabsTrigger>
        </TabsList>

        {/* 被評価者一覧サブタブ */}
        <TabsContent value="subjects" className="mt-4">
          <div className="space-y-4">
            {/* 一括操作ボタン */}
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={bulkDistributeMutation.isPending}
                  >
                    {bulkDistributeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-1" />
                    )}
                    準備完了者を一括配布
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>一括配布を実行しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      配布準備完了状態の全被評価者に対して評価を配布します。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={() => bulkDistributeMutation.mutate()}>
                      一括配布
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-1" />
                未提出者に一括通知
              </Button>
            </div>

            {records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                評価対象者がいません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">被評価者</TableHead>
                    <TableHead className="w-[80px]">等級</TableHead>
                    <TableHead className="w-[100px]">職種</TableHead>
                    <TableHead className="w-[80px] text-center">評価者数</TableHead>
                    <TableHead className="w-[200px]">回収進捗</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const isCompleted = record.currentPhase === "completed"
                    const isDistributing = record.currentPhase === "distributing"

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
                          {isDistributing ? `${record.reviewerCount}名` : "-"}
                        </TableCell>
                        <TableCell>
                          {isDistributing ? (
                            <div className="flex items-center gap-2">
                              <Progress value={record.progress} className="h-2 flex-1" />
                              <span className="text-xs w-16 text-right">
                                {record.submittedCount}/{record.reviewerCount} ({record.progress}%)
                              </span>
                            </div>
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
            )}
          </div>
        </TabsContent>

        {/* 評価者負荷一覧サブタブ */}
        <TabsContent value="reviewers" className="mt-4">
          {isLoadingLoad ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reviewerLoadData && reviewerLoadData.reviewers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">評価者名</TableHead>
                  <TableHead className="w-[120px]">部署</TableHead>
                  <TableHead className="w-[100px] text-center">担当人数</TableHead>
                  <TableHead className="w-[100px] text-center">提出済み</TableHead>
                  <TableHead className="w-[100px] text-center">未提出</TableHead>
                  <TableHead className="w-[120px] text-center">負荷状況</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewerLoadData.reviewers.map((reviewer) => {
                  const loadColors = {
                    green: "bg-green-100 text-green-800",
                    yellow: "bg-yellow-100 text-yellow-800",
                    red: "bg-red-100 text-red-800",
                  }
                  const loadLabels = {
                    green: "適正",
                    yellow: "やや多い",
                    red: "過負荷",
                  }

                  return (
                    <TableRow key={reviewer.employeeId}>
                      <TableCell className="font-medium">
                        {reviewer.employeeName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {reviewer.department || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {reviewer.assignedCount}件
                      </TableCell>
                      <TableCell className="text-center text-emerald-600 font-medium">
                        {reviewer.submittedCount}件
                      </TableCell>
                      <TableCell className="text-center text-amber-600 font-medium">
                        {reviewer.pendingCount}件
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={loadColors[reviewer.loadLevel]}>
                          {loadLabels[reviewer.loadLevel]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              評価者がいません
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
