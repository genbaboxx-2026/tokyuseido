"use client"

import React, { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Save, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
  selfCompletedAt?: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
    grade: { id: string; name: string } | null
    jobType: { id: string; name: string } | null
  }
  items: EvaluationItem[]
}

interface EvaluatorPortalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  periodId: string
  evaluatorId: string | null
  evaluations: Evaluation[]
}

interface ItemScore {
  evaluatorScore: number | null
  evaluatorComment: string
}

export function EvaluatorPortalModal({
  open,
  onOpenChange,
  companyId,
  periodId,
  evaluatorId,
  evaluations,
}: EvaluatorPortalModalProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>("")
  const [editedScores, setEditedScores] = useState<
    Record<string, Record<string, ItemScore>>
  >({})

  // 最初のタブを自動選択
  React.useEffect(() => {
    if (evaluations.length > 0 && !activeTab) {
      setActiveTab(evaluations[0].id)
    }
  }, [evaluations, activeTab])

  // モーダルが開いたときにリセット
  React.useEffect(() => {
    if (open) {
      setEditedScores({})
      if (evaluations.length > 0) {
        setActiveTab(evaluations[0].id)
      }
    }
  }, [open, evaluations])

  // 一括保存mutation
  const saveScoresMutation = useMutation({
    mutationFn: async () => {
      const updates = []

      for (const [evaluationId, items] of Object.entries(editedScores)) {
        for (const [itemId, scores] of Object.entries(items)) {
          updates.push({
            evaluationId,
            itemId,
            evaluatorScore: scores.evaluatorScore,
            evaluatorComment: scores.evaluatorComment,
          })
        }
      }

      if (updates.length === 0) return { success: true }

      // 一括更新API呼び出し
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/bulk-update-scores`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        }
      )

      if (!res.ok) throw new Error("保存に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["individualEvaluations", companyId, periodId],
      })
      setEditedScores({})
      onOpenChange(false)
    },
  })

  const handleScoreChange = (
    evaluationId: string,
    itemId: string,
    field: "evaluatorScore" | "evaluatorComment",
    value: number | string | null
  ) => {
    setEditedScores((prev) => {
      const evaluation = evaluations.find((e) => e.id === evaluationId)
      const item = evaluation?.items.find((i) => i.id === itemId)

      const currentEval = prev[evaluationId] || {}
      const currentItem = currentEval[itemId] || {
        evaluatorScore: item?.evaluatorScore ?? null,
        evaluatorComment: item?.comment ?? "",
      }

      return {
        ...prev,
        [evaluationId]: {
          ...currentEval,
          [itemId]: {
            ...currentItem,
            [field]: value,
          },
        },
      }
    })
  }

  const getItemValue = (
    evaluationId: string,
    itemId: string,
    field: "evaluatorScore" | "evaluatorComment",
    originalValue: number | string | null
  ) => {
    const edited = editedScores[evaluationId]?.[itemId]
    if (edited && field in edited) {
      return edited[field]
    }
    return originalValue
  }

  const hasUnsavedChanges = Object.keys(editedScores).length > 0

  const currentEvaluation = evaluations.find((e) => e.id === activeTab)
  const isSelfCompleted = currentEvaluation?.selfCompletedAt !== null

  // カテゴリごとにグループ化
  const itemsByCategory = useMemo(() => {
    if (!currentEvaluation) return {}
    return currentEvaluation.items.reduce((acc, item) => {
      const category = item.templateItem?.category || "未分類"
      if (!acc[category]) acc[category] = []
      acc[category].push(item)
      return acc
    }, {} as Record<string, EvaluationItem[]>)
  }, [currentEvaluation])

  if (evaluations.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>評価者専用ページ</DialogTitle>
          <DialogDescription>
            担当従業員の評価を行います。自己評価が完了した従業員のみ入力できます。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="w-full justify-start">
              {evaluations.map((evaluation) => {
                const completed = evaluation.selfCompletedAt !== null
                return (
                  <TabsTrigger
                    key={evaluation.id}
                    value={evaluation.id}
                    className={`${!completed ? "opacity-50" : ""}`}
                  >
                    {evaluation.employee.lastName} {evaluation.employee.firstName}
                    {completed && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px] px-1 bg-green-100 text-green-700"
                      >
                        入力可
                      </Badge>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </ScrollArea>

          {evaluations.map((evaluation) => {
            const selfCompleted = evaluation.selfCompletedAt !== null

            return (
              <TabsContent key={evaluation.id} value={evaluation.id}>
                {!selfCompleted ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mb-4 text-amber-500" />
                    <p className="text-lg font-medium">
                      自己評価が完了していません
                    </p>
                    <p className="text-sm">
                      この従業員の自己評価が完了するまで上司評価は入力できません。
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[60vh]">
                    <div className="space-y-4 pr-4">
                      {/* 従業員情報 */}
                      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="text-sm text-muted-foreground">等級:</span>
                          <span className="ml-1 font-medium">
                            {evaluation.employee.grade?.name || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">職種:</span>
                          <span className="ml-1 font-medium">
                            {evaluation.employee.jobType?.name || "-"}
                          </span>
                        </div>
                      </div>

                      {/* 評価項目テーブル */}
                      {Object.entries(itemsByCategory).map(([category, items]) => (
                        <div key={category} className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-100 px-4 py-2 font-medium text-sm">
                            {category}
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[200px]">着眼点</TableHead>
                                <TableHead className="w-[120px]">点数定義</TableHead>
                                <TableHead className="w-[80px] text-center">
                                  自己点数
                                </TableHead>
                                <TableHead className="w-[150px]">自己コメント</TableHead>
                                <TableHead className="w-[80px] text-center">
                                  上司点数
                                </TableHead>
                                <TableHead className="w-[150px]">上司コメント</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="align-top">
                                    <div className="font-medium text-sm">
                                      {item.templateItem?.name || "項目名なし"}
                                    </div>
                                    {item.templateItem?.description && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {item.templateItem.description}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground align-top">
                                    S:{item.templateItem?.maxScore}/A:
                                    {Math.floor((item.templateItem?.maxScore || 5) * 0.8)}
                                    /B:{Math.floor((item.templateItem?.maxScore || 5) * 0.6)}
                                    /C:{Math.floor((item.templateItem?.maxScore || 5) * 0.4)}
                                  </TableCell>
                                  <TableCell className="text-center align-top">
                                    <div className="text-blue-600 font-bold">
                                      {item.selfScore ?? "-"}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground align-top">
                                    {item.selfComment || "-"}
                                  </TableCell>
                                  <TableCell className="align-top">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={item.templateItem?.maxScore || 5}
                                      className="w-16 h-8 text-center"
                                      value={
                                        getItemValue(
                                          evaluation.id,
                                          item.id,
                                          "evaluatorScore",
                                          item.evaluatorScore
                                        ) ?? ""
                                      }
                                      onChange={(e) => {
                                        const value = e.target.value
                                          ? parseInt(e.target.value)
                                          : null
                                        handleScoreChange(
                                          evaluation.id,
                                          item.id,
                                          "evaluatorScore",
                                          value
                                        )
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="align-top">
                                    <Textarea
                                      className="h-16 text-xs resize-none"
                                      placeholder="コメント..."
                                      value={
                                        getItemValue(
                                          evaluation.id,
                                          item.id,
                                          "evaluatorComment",
                                          item.comment
                                        ) as string || ""
                                      }
                                      onChange={(e) =>
                                        handleScoreChange(
                                          evaluation.id,
                                          item.id,
                                          "evaluatorComment",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            )
          })}
        </Tabs>

        {/* 保存ボタン */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={() => saveScoresMutation.mutate()}
            disabled={!hasUnsavedChanges || saveScoresMutation.isPending}
          >
            {saveScoresMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
