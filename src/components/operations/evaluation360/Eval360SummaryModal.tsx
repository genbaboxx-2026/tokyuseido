"use client"

import React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, X, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Evaluation360Summary } from "./Evaluation360Types"

interface Eval360SummaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  periodId: string
  employeeId: string
  employeeName: string
  employeeGrade?: string
  employeeJobType?: string
  status: "aggregated" | "completed"
  onComplete?: () => void
}

// パーセンテージに応じた背景色を取得
function getPercentageColor(percentage: number): string {
  if (percentage >= 80) return "bg-green-100 text-green-800"
  if (percentage >= 50) return "bg-emerald-50 text-emerald-700"
  return "bg-red-50 text-red-700"
}

export function Eval360SummaryModal({
  open,
  onOpenChange,
  companyId,
  periodId,
  employeeId,
  employeeName,
  employeeGrade,
  employeeJobType,
  status,
  onComplete,
}: Eval360SummaryModalProps) {
  const queryClient = useQueryClient()

  // サマリーデータを取得
  const { data, isLoading, error } = useQuery<{
    record: { id: string; status: string; isAnonymous: boolean }
    employee: { id: string; firstName: string; lastName: string }
    summary: { totalAvgScore: number; totalMaxScore: number; percentage: number; reviewerCount: number }
    reviewerSummaries: Array<{ label: string; totalScore: number; maxPossibleScore: number; percentage: number }>
    categories: Array<{
      id: string
      name: string
      sortOrder: number
      items: Array<{
        id: string
        content: string
        maxScore: number
        scores: Array<{ label: string; score: number }>
        avgScore: number
        stdDev: number
        percentage: number
      }>
      avgScore: number
      maxScore: number
      percentage: number
    }>
    highlights: {
      high: Array<{ itemId: string; content: string; category: string; avgScore: number; maxScore: number; percentage: number }>
      low: Array<{ itemId: string; content: string; category: string; avgScore: number; maxScore: number; percentage: number }>
      highVariance: Array<{ itemId: string; content: string; category: string; stdDev: number }>
    }
    comments: Array<{ label: string; comment: string }>
  }>({
    queryKey: ["360Summary", companyId, periodId, employeeId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/summary`
      )
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "データの取得に失敗しました")
      }
      return res.json()
    },
    enabled: open,
  })

  // 個別確定mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/complete`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("確定に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["360Records", companyId, periodId],
      })
      queryClient.invalidateQueries({
        queryKey: ["360PhaseCounts", companyId, periodId],
      })
      queryClient.invalidateQueries({
        queryKey: ["360AggregationSummary", companyId, periodId],
      })
      onComplete?.()
      onOpenChange(false)
    },
  })

  // 評価者ラベルの配列を取得
  const reviewerLabels = data?.reviewerSummaries.map((r) => r.label) || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-semibold">
                {employeeName} の評価詳細
              </DialogTitle>
              <div className="flex gap-2">
                {employeeGrade && (
                  <Badge variant="outline" className="text-xs">
                    {employeeGrade}
                  </Badge>
                )}
                {employeeJobType && (
                  <Badge variant="outline" className="text-xs">
                    {employeeJobType}
                  </Badge>
                )}
                <Badge
                  className={
                    status === "completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-purple-100 text-purple-800"
                  }
                >
                  {status === "completed" ? "完了" : "集計済み"}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="px-6 py-4 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-500">
                {error instanceof Error ? error.message : "データの取得に失敗しました"}
              </div>
            ) : data ? (
              <>
                {/* サマリーカード */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-muted-foreground">評価者数</div>
                    <div className="text-2xl font-bold">{data.summary.reviewerCount}名</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-muted-foreground">合計平均点</div>
                    <div className="text-2xl font-bold">
                      {data.summary.totalAvgScore}
                      <span className="text-sm text-muted-foreground">
                        /{data.summary.totalMaxScore}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-muted-foreground">達成率</div>
                    <div className="text-2xl font-bold">{data.summary.percentage}%</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-muted-foreground">匿名設定</div>
                    <div className="text-2xl font-bold">
                      {data.record.isAnonymous ? "有効" : "無効"}
                    </div>
                  </div>
                </div>

                {/* 評価詳細テーブル */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-[120px] sticky left-0 bg-gray-50 z-10">
                            カテゴリ
                          </TableHead>
                          <TableHead className="w-[40px] text-center">No</TableHead>
                          <TableHead className="min-w-[200px]">項目</TableHead>
                          <TableHead className="w-[60px] text-center">満点</TableHead>
                          {reviewerLabels.map((label) => (
                            <TableHead key={label} className="w-[80px] text-center">
                              {label}
                            </TableHead>
                          ))}
                          <TableHead className="w-[80px] text-center bg-blue-50">
                            平均
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.categories.map((category) => (
                          <React.Fragment key={category.id}>
                            {category.items.map((item, itemIndex) => (
                              <TableRow key={item.id}>
                                {itemIndex === 0 && (
                                  <TableCell
                                    rowSpan={category.items.length}
                                    className="font-medium bg-gray-50 sticky left-0 z-10 border-r"
                                  >
                                    {category.name}
                                  </TableCell>
                                )}
                                <TableCell className="text-center text-sm text-muted-foreground">
                                  {itemIndex + 1}
                                </TableCell>
                                <TableCell className="text-sm">{item.content}</TableCell>
                                <TableCell className="text-center text-sm">
                                  {item.maxScore}
                                </TableCell>
                                {reviewerLabels.map((label) => {
                                  const scoreData = item.scores.find(
                                    (s) => s.label === label
                                  )
                                  return (
                                    <TableCell key={label} className="text-center">
                                      {scoreData?.score ?? "-"}
                                    </TableCell>
                                  )
                                })}
                                <TableCell
                                  className={`text-center font-medium ${getPercentageColor(
                                    item.percentage
                                  )}`}
                                >
                                  {item.avgScore}
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* カテゴリ小計行 */}
                            <TableRow className="bg-gray-100 font-medium">
                              <TableCell
                                colSpan={3}
                                className="text-right sticky left-0 z-10 bg-gray-100"
                              >
                                {category.name} 小計
                              </TableCell>
                              <TableCell className="text-center">
                                {category.maxScore}
                              </TableCell>
                              {reviewerLabels.map((label) => {
                                const reviewerScore = category.items.reduce(
                                  (sum, item) => {
                                    const score = item.scores.find(
                                      (s) => s.label === label
                                    )
                                    return sum + (score?.score ?? 0)
                                  },
                                  0
                                )
                                return (
                                  <TableCell key={label} className="text-center">
                                    {reviewerScore}
                                  </TableCell>
                                )
                              })}
                              <TableCell
                                className={`text-center ${getPercentageColor(
                                  category.percentage
                                )}`}
                              >
                                {category.avgScore}
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))}
                        {/* 合計行 */}
                        <TableRow className="bg-blue-100 font-bold">
                          <TableCell
                            colSpan={3}
                            className="text-right sticky left-0 z-10 bg-blue-100"
                          >
                            合計
                          </TableCell>
                          <TableCell className="text-center">
                            {data.summary.totalMaxScore}
                          </TableCell>
                          {data.reviewerSummaries.map((reviewer) => (
                            <TableCell key={reviewer.label} className="text-center">
                              {reviewer.totalScore}
                            </TableCell>
                          ))}
                          <TableCell
                            className={`text-center ${getPercentageColor(
                              data.summary.percentage
                            )}`}
                          >
                            {data.summary.totalAvgScore}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* コメントセクション */}
                {data.comments.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">評価コメント</h3>
                    <div className="space-y-3">
                      {data.comments.map((comment, index) => (
                        <div
                          key={index}
                          className="p-4 bg-gray-50 rounded-lg border"
                        >
                          <div className="text-sm font-medium text-muted-foreground mb-2">
                            {comment.label}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {comment.comment}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ハイライトセクション */}
                {(data.highlights.high.length > 0 ||
                  data.highlights.low.length > 0 ||
                  data.highlights.highVariance.length > 0) && (
                  <div className="grid grid-cols-3 gap-4">
                    {data.highlights.high.length > 0 && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-sm text-green-800 mb-2">
                          高評価項目（90%以上）
                        </h4>
                        <ul className="text-sm space-y-1">
                          {data.highlights.high.slice(0, 5).map((item) => (
                            <li key={item.itemId} className="text-green-700">
                              {item.content} ({item.percentage}%)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.highlights.low.length > 0 && (
                      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <h4 className="font-semibold text-sm text-red-800 mb-2">
                          低評価項目（60%以下）
                        </h4>
                        <ul className="text-sm space-y-1">
                          {data.highlights.low.slice(0, 5).map((item) => (
                            <li key={item.itemId} className="text-red-700">
                              {item.content} ({item.percentage}%)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.highlights.highVariance.length > 0 && (
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <h4 className="font-semibold text-sm text-yellow-800 mb-2">
                          評価のばらつき（標準偏差1.0以上）
                        </h4>
                        <ul className="text-sm space-y-1">
                          {data.highlights.highVariance.slice(0, 5).map((item) => (
                            <li key={item.itemId} className="text-yellow-700">
                              {item.content} (σ={item.stdDev})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </ScrollArea>

        {/* フッター */}
        <div className="px-6 py-4 border-t flex justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
          {status === "aggregated" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={completeMutation.isPending}
                >
                  {completeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  この対象者を確定する
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>評価を確定しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    {employeeName} の360度評価を確定します。確定後は編集できません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => completeMutation.mutate()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    確定する
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
