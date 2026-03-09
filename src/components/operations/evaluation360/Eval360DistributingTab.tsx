"use client"

import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  Send,
  Bell,
  Mail,
  MailCheck,
  Clock,
  CheckCircle,
  AlertCircle,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Eval360DistributingTabProps {
  companyId: string
  periodId: string
  onStatusChange: () => void
}

interface ReviewerLoadItem {
  employeeId: string
  employeeName: string
  email: string | null
  department: string | null
  grade: string | null
  assignedCount: number
  submittedCount: number
  pendingCount: number
  loadLevel: "green" | "yellow" | "red"
  emailSentAt: string | null
  hasAccessToken: boolean
}

export function Eval360DistributingTab({
  companyId,
  periodId,
  onStatusChange,
}: Eval360DistributingTabProps) {
  const [activeSubTab, setActiveSubTab] = useState("evaluators")
  const queryClient = useQueryClient()

  // 評価者一覧を取得（評価者軸で表示）
  const { data: reviewerLoadData, isLoading } = useQuery<{ reviewers: ReviewerLoadItem[] }>({
    queryKey: ["reviewerLoad", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/reviewer-load`
      )
      if (!res.ok) throw new Error("評価者一覧の取得に失敗しました")
      return res.json()
    },
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
      queryClient.invalidateQueries({
        queryKey: ["reviewerLoad", companyId, periodId],
      })
      onStatusChange()
      alert(data.message)
    },
  })

  // 一括リマインダーmutation
  const bulkRemindMutation = useMutation({
    mutationFn: async (reviewerIds?: string[]) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/bulk-remind`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewerIds }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "リマインダー送信に失敗しました")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["reviewerLoad", companyId, periodId],
      })
      if (data.emailsSent > 0) {
        alert(`${data.emailsSent}名にリマインダーを送信しました`)
      } else {
        alert("リマインダーの送信対象がありませんでした")
      }
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const reviewers = reviewerLoadData?.reviewers ?? []

  // 未提出の評価者
  const pendingReviewers = reviewers.filter((r) => r.pendingCount > 0)

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="evaluators">評価者一覧</TabsTrigger>
          <TabsTrigger value="load">負荷状況</TabsTrigger>
        </TabsList>

        {/* 評価者一覧サブタブ（評価者軸） */}
        <TabsContent value="evaluators" className="mt-4">
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkRemindMutation.isPending || pendingReviewers.length === 0}
                  >
                    {bulkRemindMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4 mr-1" />
                    )}
                    未提出者に一括通知 ({pendingReviewers.length}名)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>リマインダーを送信しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      評価が未完了の{pendingReviewers.length}名にリマインダーメールを送信します。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={() => bulkRemindMutation.mutate(undefined)}>
                      送信する
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {reviewers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                評価者がいません
              </div>
            ) : (
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">評価者</TableHead>
                      <TableHead className="w-[100px]">部署</TableHead>
                      <TableHead className="w-[80px]">等級</TableHead>
                      <TableHead className="w-[80px] text-center">メール</TableHead>
                      <TableHead className="w-[100px] text-center">被評価者数</TableHead>
                      <TableHead className="w-[200px]">回収進捗</TableHead>
                      <TableHead className="w-[80px] text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewers.map((reviewer) => {
                      const progress = reviewer.assignedCount > 0
                        ? Math.round((reviewer.submittedCount / reviewer.assignedCount) * 100)
                        : 0
                      const isComplete = reviewer.pendingCount === 0

                      return (
                        <TableRow
                          key={reviewer.employeeId}
                          className={isComplete ? "bg-green-50/50" : ""}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {isComplete ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : reviewer.pendingCount > 0 ? (
                                <Clock className="h-4 w-4 text-amber-500" />
                              ) : null}
                              {reviewer.employeeName}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {reviewer.department || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {reviewer.grade || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Tooltip>
                              <TooltipTrigger>
                                {reviewer.emailSentAt ? (
                                  <MailCheck className="h-4 w-4 mx-auto text-green-500" />
                                ) : reviewer.email ? (
                                  <Mail className="h-4 w-4 mx-auto text-slate-400" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 mx-auto text-red-500" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {reviewer.emailSentAt ? (
                                  <p>送信済み: {new Date(reviewer.emailSentAt).toLocaleString("ja-JP")}</p>
                                ) : reviewer.email ? (
                                  <p>未送信: {reviewer.email}</p>
                                ) : (
                                  <p>メールアドレス未設定</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-center">
                            {reviewer.assignedCount}名
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={progress} className="h-2 flex-1" />
                              <span className="text-xs w-16 text-right">
                                {reviewer.submittedCount}/{reviewer.assignedCount} ({progress}%)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {!isComplete && reviewer.email && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => bulkRemindMutation.mutate([reviewer.employeeId])}
                                disabled={bulkRemindMutation.isPending}
                              >
                                <Bell className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            )}
          </div>
        </TabsContent>

        {/* 負荷状況サブタブ */}
        <TabsContent value="load" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reviewers.length > 0 ? (
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
                {reviewers.map((reviewer) => {
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
