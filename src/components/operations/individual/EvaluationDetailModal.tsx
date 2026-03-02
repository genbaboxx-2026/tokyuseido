"use client"

import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Evaluation, EvaluationItem } from "./IndividualPreparingTypes"

interface EvaluationDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluation: Evaluation | null
  onAddItem: () => void
  onEditItem: (item: EvaluationItem) => void
  onDeleteItem: (itemId: string) => void
}

export function EvaluationDetailModal({
  open,
  onOpenChange,
  evaluation,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: EvaluationDetailModalProps) {
  if (!evaluation) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {evaluation.employee.lastName} {evaluation.employee.firstName}
          </DialogTitle>
          <DialogDescription>
            個別評価の詳細情報
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-4 pr-4">
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

            {/* テンプレート情報 */}
            {evaluation.template && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-muted-foreground">テンプレート</div>
                <div className="font-medium">{evaluation.template.name}</div>
              </div>
            )}

            {/* 評価項目一覧 */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium">評価項目一覧</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {evaluation.itemStats.total}件
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAddItem}
                    disabled={evaluation.currentPhase === "completed"}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    追加
                  </Button>
                </div>
              </div>

              {evaluation.items.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground bg-gray-50 rounded-lg">
                  <p>評価項目がまだ設定されていません</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={onAddItem}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    項目を追加
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <EvaluationItemsList
                    items={evaluation.items}
                    isCompleted={evaluation.currentPhase === "completed"}
                    onEditItem={onEditItem}
                    onDeleteItem={onDeleteItem}
                  />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// 評価項目リストコンポーネント
function EvaluationItemsList({
  items,
  isCompleted,
  onEditItem,
  onDeleteItem,
}: {
  items: EvaluationItem[]
  isCompleted: boolean
  onEditItem: (item: EvaluationItem) => void
  onDeleteItem: (itemId: string) => void
}) {
  // カテゴリごとにグループ化
  const itemsByCategory = items.reduce((acc, item) => {
    const category = item.templateItem?.category || "未分類"
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, EvaluationItem[]>)

  return (
    <>
      {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
        <div key={category} className="border rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-3 py-2 text-sm font-medium">
            {category}
          </div>
          <div className="divide-y">
            {categoryItems.map((item) => (
              <div key={item.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {item.templateItem?.name || "項目名なし"}
                    </div>
                    {item.templateItem?.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.templateItem.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex gap-2">
                      <div className="text-center">
                        <div className={`text-sm font-bold ${item.selfScore !== null ? "text-blue-600" : "text-gray-300"}`}>
                          {item.selfScore ?? "-"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">自己</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-bold ${item.evaluatorScore !== null ? "text-amber-600" : "text-gray-300"}`}>
                          {item.evaluatorScore ?? "-"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">上長</div>
                      </div>
                    </div>
                    {!isCompleted && (
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditItem(item)
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteItem(item.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
