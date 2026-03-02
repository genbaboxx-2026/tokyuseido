"use client"

import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type EvaluationItem, type ScoreData } from "./IndividualEvaluationTypes"

interface EvaluationItemsFormProps {
  items: EvaluationItem[]
  scores: Record<string, ScoreData>
  onScoreChange: (itemId: string, field: "selfScore" | "evaluatorScore", value: number | null) => void
  mode: "self" | "evaluator" | "both"
  readOnly?: boolean
}

export function EvaluationItemsForm({
  items,
  scores,
  onScoreChange,
  mode,
  readOnly = false,
}: EvaluationItemsFormProps) {
  // カテゴリ別にグループ化
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, EvaluationItem[]>)

  return (
    <div className="space-y-6">
      {Object.entries(groupedItems).map(([category, categoryItems]) => (
        <div key={category} className="space-y-3">
          <h3 className="font-semibold text-sm border-b pb-1 text-gray-700">{category}</h3>
          <div className="space-y-4">
            {categoryItems.map((item) => (
              <div key={item.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    最大{item.maxScore}点 / 重み{item.weight}
                  </span>
                </div>
                <div className={`grid gap-4 ${mode === "both" ? "grid-cols-2" : "grid-cols-1"}`}>
                  {(mode === "self" || mode === "both") && (
                    <div>
                      <Label className="text-xs">自己評価</Label>
                      {readOnly ? (
                        <div className="mt-1 h-10 flex items-center">
                          <Badge variant="outline" className="text-base">
                            {scores[item.id]?.selfScore !== null ? `${scores[item.id]?.selfScore}点` : "未入力"}
                          </Badge>
                        </div>
                      ) : (
                        <Select
                          value={
                            scores[item.id]?.selfScore !== null && scores[item.id]?.selfScore !== undefined
                              ? scores[item.id]?.selfScore?.toString()
                              : undefined
                          }
                          onValueChange={(v) => onScoreChange(item.id, "selfScore", parseInt(v))}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="選択..." />
                          </SelectTrigger>
                          <SelectContent>
                            {[...Array(item.maxScore + 1)].map((_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i}点
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                  {(mode === "evaluator" || mode === "both") && (
                    <div>
                      <Label className="text-xs">上司評価</Label>
                      {readOnly ? (
                        <div className="mt-1 h-10 flex items-center">
                          <Badge variant="outline" className="text-base">
                            {scores[item.id]?.evaluatorScore !== null ? `${scores[item.id]?.evaluatorScore}点` : "未入力"}
                          </Badge>
                        </div>
                      ) : (
                        <Select
                          value={
                            scores[item.id]?.evaluatorScore !== null && scores[item.id]?.evaluatorScore !== undefined
                              ? scores[item.id]?.evaluatorScore?.toString()
                              : undefined
                          }
                          onValueChange={(v) => onScoreChange(item.id, "evaluatorScore", parseInt(v))}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="選択..." />
                          </SelectTrigger>
                          <SelectContent>
                            {[...Array(item.maxScore + 1)].map((_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i}点
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
