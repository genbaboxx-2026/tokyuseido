"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, BarChart2, User, ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AggregationSummaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  periodId: string
  evaluationId: string | null
}

interface CategoryItem {
  id: string
  itemName: string
  description: string | null
  maxScore: number
  weight: number
  selfScore: number | null
  evaluatorScore: number | null
  averageScore: number | null
  comment: string | null
}

interface Category {
  name: string
  sortOrder: number
  items: CategoryItem[]
  selfTotal: number
  evaluatorTotal: number
  averageTotal: number
  maxTotal: number
  selfPercentage: number
  evaluatorPercentage: number
  averagePercentage: number
}

interface SummaryData {
  evaluation: {
    id: string
    status: string
    selfComment: string | null
    evaluatorComment: string | null
    selfCompletedAt: string | null
    evaluatorCompletedAt: string | null
  }
  employee: {
    id: string
    firstName: string
    lastName: string
    department: string | null
    grade: string | null
    jobType: string | null
  }
  evaluator: {
    id: string
    firstName: string
    lastName: string
  } | null
  categories: Category[]
  summary: {
    totalItems: number
    totalSelfScore: number
    totalEvaluatorScore: number
    totalAverageScore: number
    totalMaxScore: number
    selfPercentage: number
    evaluatorPercentage: number
    averagePercentage: number
  }
}

export function AggregationSummaryModal({
  open,
  onOpenChange,
  companyId,
  periodId,
  evaluationId,
}: AggregationSummaryModalProps) {
  const { data, isLoading, error } = useQuery<SummaryData>({
    queryKey: ["aggregationSummary", companyId, periodId, evaluationId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/aggregation-summary?evaluationId=${evaluationId}`
      )
      if (!res.ok) throw new Error("データの取得に失敗しました")
      return res.json()
    },
    enabled: open && !!evaluationId,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-purple-600" />
            集計詳細
          </DialogTitle>
          <DialogDescription>評価結果の詳細</DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-red-500">
            データの取得に失敗しました
          </div>
        )}

        {data && (
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-6 pr-4">
              {/* 基本情報 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">対象者</span>
                  </div>
                  <div className="font-bold text-lg">
                    {data.employee.lastName} {data.employee.firstName}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {data.employee.department || "-"} / {data.employee.grade || "-"} / {data.employee.jobType || "-"}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">評価者</span>
                  </div>
                  <div className="font-bold text-lg">
                    {data.evaluator
                      ? `${data.evaluator.lastName} ${data.evaluator.firstName}`
                      : "-"}
                  </div>
                </div>
              </div>

              {/* 総合スコア */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-3">総合スコア</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {data.summary.selfPercentage}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      自己評価 ({data.summary.totalSelfScore}/{data.summary.totalMaxScore})
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      {data.summary.evaluatorPercentage}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      上長評価 ({data.summary.totalEvaluatorScore}/{data.summary.totalMaxScore})
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {data.summary.averagePercentage}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      平均 ({data.summary.totalAverageScore}/{data.summary.totalMaxScore})
                    </div>
                  </div>
                </div>
              </div>

              {/* カテゴリ別スコア */}
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">カテゴリ別スコア</div>
                {data.categories.map((category) => (
                  <div key={category.name} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4" />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-blue-600">自己: {category.selfPercentage}%</span>
                        <span className="text-amber-600">上長: {category.evaluatorPercentage}%</span>
                        <span className="text-purple-600 font-medium">平均: {category.averagePercentage}%</span>
                      </div>
                    </div>
                    <div className="divide-y">
                      {category.items.map((item) => (
                        <div key={item.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{item.itemName}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {item.description}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-4 shrink-0 text-sm">
                              <div className="text-center w-12">
                                <div className="font-bold text-blue-600">
                                  {item.selfScore ?? "-"}
                                </div>
                                <div className="text-[10px] text-muted-foreground">自己</div>
                              </div>
                              <div className="text-center w-12">
                                <div className="font-bold text-amber-600">
                                  {item.evaluatorScore ?? "-"}
                                </div>
                                <div className="text-[10px] text-muted-foreground">上長</div>
                              </div>
                              <div className="text-center w-12">
                                <div className="font-bold text-purple-600">
                                  {item.averageScore ?? "-"}
                                </div>
                                <div className="text-[10px] text-muted-foreground">平均</div>
                              </div>
                              <div className="text-center w-12">
                                <div className="font-medium text-gray-500">{item.maxScore}</div>
                                <div className="text-[10px] text-muted-foreground">満点</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* コメント */}
              {(data.evaluation.selfComment || data.evaluation.evaluatorComment) && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">コメント</div>
                  {data.evaluation.selfComment && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs text-blue-600 mb-1">自己評価コメント</div>
                      <div className="text-sm">{data.evaluation.selfComment}</div>
                    </div>
                  )}
                  {data.evaluation.evaluatorComment && (
                    <div className="bg-amber-50 rounded-lg p-3">
                      <div className="text-xs text-amber-600 mb-1">評価者コメント</div>
                      <div className="text-sm">{data.evaluation.evaluatorComment}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
