"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ClipboardCheck,
  Loader2,
  Users,
  AlertCircle,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// 評価詳細の型
interface EvaluationDetail {
  id: string
  employeeId: string
  evaluationTemplateId: string
  evaluationType: string
  status: string
  totalScore: number | null
  finalRating: "S" | "A" | "B" | "C" | "D" | null
  evaluatorComment: string | null
  selfComment: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
    grade: { id: string; name: string } | null
    jobType: { id: string; name: string } | null
    department: { id: string; name: string } | null
  }
  templateName: string
  items: {
    id: string
    name: string
    description: string | null
    category: string
    maxScore: number
    weight: number
    sortOrder: number
    selfScore: number | null
    evaluatorScore: number | null
    comment: string | null
    evaluationItemId: string | null
  }[]
}

// 360度評価の型
interface Evaluation360Detail {
  id: string
  employeeId: string
  evaluationType: string
  status: string
  totalScore: number | null
  finalRating: "S" | "A" | "B" | "C" | "D" | null
  selfComment: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
    grade: { id: string; name: string } | null
    jobType: { id: string; name: string } | null
    department: { id: string; name: string } | null
  }
  templateName: string
  items: {
    id: string
    name: string
    description: string | null
    category: string
    maxScore: number
    weight: number
    sortOrder: number
  }[]
  evaluators: {
    id: string
    name: string
    scores: Record<string, number | null>
  }[]
}

// 評価レート設定
const ratingConfig: Record<string, { label: string; color: string }> = {
  S: { label: "S（非常に優秀）", color: "bg-purple-100 text-purple-800" },
  A: { label: "A（優秀）", color: "bg-blue-100 text-blue-800" },
  B: { label: "B（標準）", color: "bg-green-100 text-green-800" },
  C: { label: "C（要改善）", color: "bg-yellow-100 text-yellow-800" },
  D: { label: "D（不十分）", color: "bg-red-100 text-red-800" },
}

interface EvaluationModalProps {
  evaluationId: string
  evaluationType: "individual" | "360"
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function EvaluationModal({
  evaluationId,
  evaluationType,
  isOpen,
  onClose,
  onSaved,
}: EvaluationModalProps) {
  // 個別評価用の状態
  const [scores, setScores] = useState<Record<string, { selfScore: number | null; evaluatorScore: number | null; comment: string }>>({})
  const [evaluatorComment, setEvaluatorComment] = useState("")
  const [selfComment, setSelfComment] = useState("")
  const [finalRating, setFinalRating] = useState<"S" | "A" | "B" | "C" | "D" | null>(null)

  // 360度評価用の状態
  const [evaluators360, setEvaluators360] = useState<{
    id: string
    name: string
    scores: Record<string, number | null>
  }[]>([])

  const queryClient = useQueryClient()

  // 個別評価詳細を取得
  const { data: evaluation, isLoading: isLoadingIndividual, error: errorIndividual } = useQuery<EvaluationDetail>({
    queryKey: ["evaluationDetail", evaluationId],
    queryFn: async () => {
      const res = await fetch(`/api/employee-evaluations/${evaluationId}`)
      if (!res.ok) throw new Error("評価の取得に失敗しました")
      return res.json()
    },
    enabled: isOpen && !!evaluationId && evaluationType === "individual",
  })

  // 360度評価詳細を取得
  const { data: evaluation360, isLoading: isLoading360, error: error360 } = useQuery<Evaluation360Detail>({
    queryKey: ["evaluation360Detail", evaluationId],
    queryFn: async () => {
      const res = await fetch(`/api/evaluation-360/${evaluationId}`)
      if (!res.ok) throw new Error("評価の取得に失敗しました")
      return res.json()
    },
    enabled: isOpen && !!evaluationId && evaluationType === "360",
  })

  const isLoading = evaluationType === "individual" ? isLoadingIndividual : isLoading360
  const error = evaluationType === "individual" ? errorIndividual : error360

  // 個別評価: データ読み込み時に初期値を設定
  if (evaluationType === "individual" && evaluation && Object.keys(scores).length === 0 && evaluation.items.length > 0) {
    const initialScores: Record<string, { selfScore: number | null; evaluatorScore: number | null; comment: string }> = {}
    evaluation.items.forEach((item) => {
      initialScores[item.id] = {
        selfScore: item.selfScore,
        evaluatorScore: item.evaluatorScore,
        comment: item.comment || "",
      }
    })
    setScores(initialScores)
    setEvaluatorComment(evaluation.evaluatorComment || "")
    setSelfComment(evaluation.selfComment || "")
    setFinalRating(evaluation.finalRating)
  }

  // 360度評価: データ読み込み時に初期値を設定
  if (evaluationType === "360" && evaluation360 && evaluators360.length === 0 && evaluation360.evaluators.length > 0) {
    setEvaluators360(evaluation360.evaluators)
    setSelfComment(evaluation360.selfComment || "")
    setFinalRating(evaluation360.finalRating)
  }

  // 保存mutation（個別評価用）
  const saveIndividualMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(scores).map(([templateItemId, score]) => ({
        templateItemId,
        selfScore: score.selfScore,
        evaluatorScore: score.evaluatorScore,
        comment: score.comment || null,
      }))

      const res = await fetch(`/api/employee-evaluations/${evaluationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          evaluatorComment: evaluatorComment || null,
          selfComment: selfComment || null,
          finalRating,
        }),
      })
      if (!res.ok) throw new Error("保存に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluationDetail", evaluationId] })
      onSaved()
      onClose()
    },
    onError: () => {
      alert("評価の保存に失敗しました")
    },
  })

  // 保存mutation（360度評価用）
  const save360Mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/evaluation-360/${evaluationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluators: evaluators360,
          selfComment: selfComment || null,
          finalRating,
        }),
      })
      if (!res.ok) throw new Error("保存に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Detail", evaluationId] })
      onSaved()
      onClose()
    },
    onError: () => {
      alert("評価の保存に失敗しました")
    },
  })

  const saveMutation = evaluationType === "individual" ? saveIndividualMutation : save360Mutation

  // 個別評価: スコア変更ハンドラ
  const handleScoreChange = (itemId: string, field: "selfScore" | "evaluatorScore", value: number | null) => {
    setScores((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }))
  }

  // 360度評価: 評価者スコア変更ハンドラ
  const handle360ScoreChange = (evaluatorId: string, itemId: string, value: number | null) => {
    setEvaluators360((prev) =>
      prev.map((evaluator) =>
        evaluator.id === evaluatorId
          ? { ...evaluator, scores: { ...evaluator.scores, [itemId]: value } }
          : evaluator
      )
    )
  }

  // 360度評価: 評価者名変更ハンドラ
  const handle360NameChange = (evaluatorId: string, name: string) => {
    setEvaluators360((prev) =>
      prev.map((evaluator) =>
        evaluator.id === evaluatorId ? { ...evaluator, name } : evaluator
      )
    )
  }

  const handleCommentChange = (itemId: string, value: string) => {
    setScores((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        comment: value,
      },
    }))
  }

  // カテゴリ別に項目をグループ化（個別評価用）
  const groupedItems = evaluation?.items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, typeof evaluation.items>)

  // カテゴリ別に項目をグループ化（360度評価用）
  const groupedItems360 = evaluation360?.items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, typeof evaluation360.items>)

  // 表示用のデータを統一
  const displayEmployee = evaluationType === "individual" ? evaluation?.employee : evaluation360?.employee
  const displayTotalScore = evaluationType === "individual" ? evaluation?.totalScore : evaluation360?.totalScore

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {evaluationType === "individual" ? (
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
            ) : (
              <Users className="h-5 w-5 text-purple-600" />
            )}
            {evaluationType === "individual" ? "個別評価" : "360度評価"}
            {displayEmployee && (
              <span className="text-muted-foreground font-normal">
                - {displayEmployee.lastName} {displayEmployee.firstName}
              </span>
            )}
          </DialogTitle>
          {displayEmployee && (
            <DialogDescription>
              {displayEmployee.department?.name || ""} / {displayEmployee.grade?.name || ""} / {displayEmployee.jobType?.name || ""}
            </DialogDescription>
          )}
          {!displayEmployee && <DialogDescription>評価内容を読み込み中...</DialogDescription>}
        </DialogHeader>

        {displayEmployee && (
          <div className="flex gap-2 -mt-2 mb-2">
            {displayEmployee.department && (
              <Badge variant="outline">{displayEmployee.department.name}</Badge>
            )}
            {displayEmployee.grade && (
              <Badge variant="outline">{displayEmployee.grade.name}</Badge>
            )}
            {displayEmployee.jobType && (
              <Badge variant="outline">{displayEmployee.jobType.name}</Badge>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-8 text-destructive">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>評価の取得に失敗しました</p>
          </div>
        )}

        {/* 個別評価のコンテンツ */}
        {evaluationType === "individual" && evaluation && !isLoading && (
          <div className="space-y-6">
            {/* 評価項目 */}
            {groupedItems && Object.entries(groupedItems).map(([category, items]) => (
              <div key={category} className="space-y-3">
                <h3 className="font-semibold text-sm border-b pb-1">{category}</h3>
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          最大{item.maxScore}点 / 重み{item.weight}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">自己評価</Label>
                          <Select
                            value={scores[item.id]?.selfScore !== null && scores[item.id]?.selfScore !== undefined ? scores[item.id]?.selfScore?.toString() : undefined}
                            onValueChange={(v) => handleScoreChange(item.id, "selfScore", parseInt(v))}
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
                        </div>
                        <div>
                          <Label className="text-xs">評価者評価</Label>
                          <Select
                            value={scores[item.id]?.evaluatorScore !== null && scores[item.id]?.evaluatorScore !== undefined ? scores[item.id]?.evaluatorScore?.toString() : undefined}
                            onValueChange={(v) => handleScoreChange(item.id, "evaluatorScore", parseInt(v))}
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
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">コメント</Label>
                        <Textarea
                          className="mt-1 text-sm"
                          rows={2}
                          placeholder="コメントを入力..."
                          value={scores[item.id]?.comment || ""}
                          onChange={(e) => handleCommentChange(item.id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* 総合コメント */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm">総合コメント</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>自己評価コメント</Label>
                  <Textarea
                    className="mt-1"
                    rows={3}
                    placeholder="自己評価のコメントを入力..."
                    value={selfComment}
                    onChange={(e) => setSelfComment(e.target.value)}
                  />
                </div>
                <div>
                  <Label>評価者コメント</Label>
                  <Textarea
                    className="mt-1"
                    rows={3}
                    placeholder="評価者としてのコメントを入力..."
                    value={evaluatorComment}
                    onChange={(e) => setEvaluatorComment(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 最終評価 */}
            <div className="space-y-2 border-t pt-4">
              <Label>最終評価レート</Label>
              <Select
                value={finalRating || undefined}
                onValueChange={(v) => setFinalRating(v as "S" | "A" | "B" | "C" | "D")}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="評価を選択..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ratingConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {evaluation.totalScore !== null && (
                <p className="text-sm text-muted-foreground">
                  現在の合計スコア: {evaluation.totalScore.toFixed(2)}点
                </p>
              )}
            </div>
          </div>
        )}

        {/* 360度評価のコンテンツ */}
        {evaluationType === "360" && evaluation360 && !isLoading && (
          <div className="space-y-6">
            {/* 評価者名の編集 */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm border-b pb-1">評価者設定</h3>
              <div className="grid grid-cols-4 gap-4">
                {evaluators360.map((evaluator, idx) => (
                  <div key={evaluator.id}>
                    <Label className="text-xs">評価者{idx + 1}</Label>
                    <Input
                      className="mt-1"
                      value={evaluator.name}
                      onChange={(e) => handle360NameChange(evaluator.id, e.target.value)}
                      placeholder={`評価者${idx + 1}の名前`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 評価項目テーブル */}
            {groupedItems360 && Object.entries(groupedItems360).map(([category, items]) => (
              <div key={category} className="space-y-3">
                <h3 className="font-semibold text-sm border-b pb-1">{category}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left p-2 border text-sm font-medium w-1/3">評価項目</th>
                        {evaluators360.map((evaluator) => (
                          <th key={evaluator.id} className="text-center p-2 border text-sm font-medium w-[15%]">
                            {evaluator.name}
                          </th>
                        ))}
                        <th className="text-center p-2 border text-sm font-medium w-[10%]">平均</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        // この項目の平均スコアを計算
                        const itemScores = evaluators360
                          .map((e) => e.scores[item.id])
                          .filter((s): s is number => s !== null && s !== undefined)
                        const avgScore = itemScores.length > 0
                          ? (itemScores.reduce((a, b) => a + b, 0) / itemScores.length).toFixed(1)
                          : "-"

                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-2 border">
                              <p className="font-medium text-sm">{item.name}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                最大{item.maxScore}点 / 重み{item.weight}
                              </p>
                            </td>
                            {evaluators360.map((evaluator) => (
                              <td key={evaluator.id} className="p-2 border text-center">
                                <Select
                                  value={evaluator.scores[item.id] !== null && evaluator.scores[item.id] !== undefined
                                    ? evaluator.scores[item.id]!.toString()
                                    : undefined}
                                  onValueChange={(v) => handle360ScoreChange(evaluator.id, item.id, parseInt(v))}
                                >
                                  <SelectTrigger className="w-20 mx-auto">
                                    <SelectValue placeholder="-" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[...Array(item.maxScore + 1)].map((_, i) => (
                                      <SelectItem key={i} value={i.toString()}>
                                        {i}点
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            ))}
                            <td className="p-2 border text-center font-medium">
                              {avgScore}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* 自己コメント */}
            <div className="space-y-2 border-t pt-4">
              <Label>自己評価コメント</Label>
              <Textarea
                rows={3}
                placeholder="自己評価のコメントを入力..."
                value={selfComment}
                onChange={(e) => setSelfComment(e.target.value)}
              />
            </div>

            {/* 最終評価 */}
            <div className="space-y-2 border-t pt-4">
              <Label>最終評価レート</Label>
              <Select
                value={finalRating || undefined}
                onValueChange={(v) => setFinalRating(v as "S" | "A" | "B" | "C" | "D")}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="評価を選択..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ratingConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {displayTotalScore !== null && displayTotalScore !== undefined && (
                <p className="text-sm text-muted-foreground">
                  現在の平均スコア: {displayTotalScore.toFixed(2)}点
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                保存
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
