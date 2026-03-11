"use client"

import React from "react"
import { User, Minus, TrendingUp, TrendingDown } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface EvaluationItem {
  id: string
  selfScore: number | null
  evaluatorScore: number | null
  selfComment?: string | null
  evaluatorComment?: string | null
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

interface Evaluation {
  id: string
  employeeId: string
  status: string
  totalScore: number | null
  employee: {
    id: string
    firstName: string
    lastName: string
    grade: { id: string; name: string } | null
    jobType: { id: string; name: string } | null
    department: { id: string; name: string } | null
  }
  evaluator?: {
    id: string
    firstName: string
    lastName: string
  } | null
  items: EvaluationItem[]
}

interface AggregatedDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluation: Evaluation | null
}

export function AggregatedDetailModal({
  open,
  onOpenChange,
  evaluation,
}: AggregatedDetailModalProps) {
  if (!evaluation) return null

  // スコア集計
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
  const diff = selfTotal - evaluatorTotal

  // カテゴリごとにグループ化
  const itemsByCategory = evaluation.items.reduce((acc, item) => {
    const category = item.templateItem?.category || "未分類"
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, EvaluationItem[]>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            {evaluation.employee.lastName} {evaluation.employee.firstName}
          </DialogTitle>
          <DialogDescription>
            集計結果の詳細
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-6 pr-4">
            {/* 基本情報 */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">部署</div>
                <div className="font-medium">
                  {evaluation.employee.department?.name || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">等級</div>
                <div className="font-medium">
                  {evaluation.employee.grade?.name || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">職種</div>
                <div className="font-medium">
                  {evaluation.employee.jobType?.name || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">評価者</div>
                <div className="font-medium">
                  {evaluation.evaluator
                    ? `${evaluation.evaluator.lastName} ${evaluation.evaluator.firstName}`
                    : "-"}
                </div>
              </div>
            </div>

            {/* スコアサマリー */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {selfTotal}
                </div>
                <div className="text-xs text-muted-foreground">自己合計</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {evaluatorTotal}
                </div>
                <div className="text-xs text-muted-foreground">上司合計</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {maxTotal}
                </div>
                <div className="text-xs text-muted-foreground">満点</div>
              </div>
              <div
                className={`rounded-lg p-4 text-center ${
                  diff > 0
                    ? "bg-green-50"
                    : diff < 0
                    ? "bg-red-50"
                    : "bg-gray-50"
                }`}
              >
                <div
                  className={`text-2xl font-bold flex items-center justify-center gap-1 ${
                    diff > 0
                      ? "text-green-600"
                      : diff < 0
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {diff > 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : diff < 0 ? (
                    <TrendingDown className="h-5 w-5" />
                  ) : (
                    <Minus className="h-5 w-5" />
                  )}
                  {diff > 0 ? "+" : ""}
                  {diff}
                </div>
                <div className="text-xs text-muted-foreground">
                  差分（自己 - 上司）
                </div>
              </div>
            </div>

            {/* カテゴリ別項目 */}
            <div className="space-y-4">
              {Object.entries(itemsByCategory).map(([category, items]) => (
                <div key={category} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 font-medium text-sm">
                    {category}
                  </div>
                  <div className="divide-y">
                    {items.map((item) => {
                      const itemDiff =
                        (item.selfScore ?? 0) - (item.evaluatorScore ?? 0)

                      return (
                        <div key={item.id} className="p-4 space-y-3">
                          {/* 項目名・説明 */}
                          <div>
                            <div className="font-medium">
                              {item.templateItem?.name || "項目名なし"}
                            </div>
                            {item.templateItem?.description && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {item.templateItem.description}
                              </div>
                            )}
                          </div>

                          {/* スコア表示 */}
                          <div className="grid grid-cols-4 gap-3">
                            <div className="bg-blue-50 rounded p-2">
                              <div className="text-xs text-muted-foreground mb-1">
                                自己評価
                              </div>
                              <div className="font-bold text-blue-600">
                                {item.selfScore ?? "-"}
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                  / {item.templateItem?.maxScore}
                                </span>
                              </div>
                            </div>
                            <div className="bg-amber-50 rounded p-2">
                              <div className="text-xs text-muted-foreground mb-1">
                                上司評価
                              </div>
                              <div className="font-bold text-amber-600">
                                {item.evaluatorScore ?? "-"}
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                  / {item.templateItem?.maxScore}
                                </span>
                              </div>
                            </div>
                            <div
                              className={`rounded p-2 ${
                                itemDiff > 0
                                  ? "bg-green-50"
                                  : itemDiff < 0
                                  ? "bg-red-50"
                                  : "bg-gray-50"
                              }`}
                            >
                              <div className="text-xs text-muted-foreground mb-1">
                                差分
                              </div>
                              <div
                                className={`font-bold ${
                                  itemDiff > 0
                                    ? "text-green-600"
                                    : itemDiff < 0
                                    ? "text-red-600"
                                    : "text-gray-500"
                                }`}
                              >
                                {itemDiff > 0 ? "+" : ""}
                                {itemDiff}
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="text-xs text-muted-foreground mb-1">
                                満点
                              </div>
                              <div className="font-bold text-gray-600">
                                {item.templateItem?.maxScore ?? "-"}
                              </div>
                            </div>
                          </div>

                          {/* コメント */}
                          {(item.selfComment || item.comment) && (
                            <div className="grid grid-cols-2 gap-3">
                              {item.selfComment && (
                                <div className="bg-blue-50/50 rounded p-2">
                                  <div className="text-xs text-blue-600 mb-1">
                                    自己コメント
                                  </div>
                                  <div className="text-sm">
                                    {item.selfComment}
                                  </div>
                                </div>
                              )}
                              {item.comment && (
                                <div className="bg-amber-50/50 rounded p-2">
                                  <div className="text-xs text-amber-600 mb-1">
                                    上司コメント
                                  </div>
                                  <div className="text-sm">{item.comment}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
