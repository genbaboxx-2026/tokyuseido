"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EvaluationScoreInput, ScoreBadge, RatingBadge } from "./EvaluationScoreInput"
import { EVALUATION_UI_TEXT } from "@/lib/evaluation/constants"

interface EvaluationItem {
  id: string
  name: string
  description?: string | null
  category: string
  weight?: number | null
}

interface EvaluationScore {
  id?: string
  evaluationItemId: string
  selfScore?: number | null
  evaluatorScore?: number | null
  comment?: string | null
  evaluationItem?: EvaluationItem
}

interface IndividualEvaluationFormProps {
  evaluationId: string
  items: EvaluationItem[]
  scores: EvaluationScore[]
  isSelfEvaluation?: boolean
  isReadOnly?: boolean
  onSubmit: (scores: EvaluationScore[]) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

export function IndividualEvaluationForm({
  items,
  scores: initialScores,
  isSelfEvaluation = false,
  isReadOnly = false,
  onSubmit,
  onCancel,
  isLoading = false,
}: IndividualEvaluationFormProps) {
  const [scores, setScores] = useState<Map<string, EvaluationScore>>(new Map())

  // 初期スコアをセット
  useEffect(() => {
    const scoreMap = new Map<string, EvaluationScore>()

    // 既存のスコアをマップに追加
    for (const score of initialScores) {
      scoreMap.set(score.evaluationItemId, score)
    }

    // 項目にスコアがない場合は空のスコアを追加
    for (const item of items) {
      if (!scoreMap.has(item.id)) {
        scoreMap.set(item.id, {
          evaluationItemId: item.id,
          selfScore: null,
          evaluatorScore: null,
          comment: null,
        })
      }
    }

    setScores(scoreMap)
  }, [initialScores, items])

  const updateScore = (itemId: string, field: "selfScore" | "evaluatorScore", value: number) => {
    setScores((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(itemId) ?? {
        evaluationItemId: itemId,
        selfScore: null,
        evaluatorScore: null,
        comment: null,
      }
      newMap.set(itemId, { ...existing, [field]: value })
      return newMap
    })
  }

  const updateComment = (itemId: string, comment: string) => {
    setScores((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(itemId) ?? {
        evaluationItemId: itemId,
        selfScore: null,
        evaluatorScore: null,
        comment: null,
      }
      newMap.set(itemId, { ...existing, comment })
      return newMap
    })
  }

  const handleSubmit = async () => {
    await onSubmit(Array.from(scores.values()))
  }

  // カテゴリでグループ化
  const groupedItems = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = []
      }
      acc[item.category].push(item)
      return acc
    },
    {} as Record<string, EvaluationItem[]>
  )

  return (
    <div className="space-y-6">
      {Object.entries(groupedItems).map(([category, categoryItems]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {categoryItems.map((item, index) => {
              const score = scores.get(item.id)
              return (
                <div key={item.id}>
                  {index > 0 && <Separator className="mb-4" />}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium">{item.name}</h4>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {/* 自己評価 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          {EVALUATION_UI_TEXT.SELF_EVALUATION}
                        </label>
                        {isSelfEvaluation && !isReadOnly ? (
                          <EvaluationScoreInput
                            value={score?.selfScore}
                            onChange={(value) => updateScore(item.id, "selfScore", value)}
                            size="sm"
                            showLabels={false}
                          />
                        ) : (
                          <div className="flex items-center h-10">
                            <ScoreBadge score={score?.selfScore} />
                          </div>
                        )}
                      </div>

                      {/* 上司評価 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          {EVALUATION_UI_TEXT.SUPERVISOR_EVALUATION}
                        </label>
                        {!isSelfEvaluation && !isReadOnly ? (
                          <EvaluationScoreInput
                            value={score?.evaluatorScore}
                            onChange={(value) => updateScore(item.id, "evaluatorScore", value)}
                            size="sm"
                            showLabels={false}
                            comment={score?.comment}
                            onCommentChange={(comment) => updateComment(item.id, comment)}
                            showComment
                          />
                        ) : (
                          <div className="flex items-center h-10">
                            <ScoreBadge score={score?.evaluatorScore} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 読み取り専用時のコメント表示 */}
                    {isReadOnly && score?.comment && (
                      <div className="bg-muted p-3 rounded-md">
                        <p className="text-sm">
                          <span className="font-medium">{EVALUATION_UI_TEXT.COMMENT}: </span>
                          {score.comment}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      {!isReadOnly && (
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              {EVALUATION_UI_TEXT.CANCEL}
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? EVALUATION_UI_TEXT.LOADING : EVALUATION_UI_TEXT.SAVE}
          </Button>
        </div>
      )}
    </div>
  )
}

// 評価結果サマリー表示
interface EvaluationSummaryDisplayProps {
  totalScore?: number | null
  averageScore?: number | null
  selfAverageScore?: number | null
  finalRating?: "S" | "A" | "B" | "C" | "D" | null
  completionRate?: number
}

export function EvaluationSummaryDisplay({
  totalScore,
  averageScore,
  selfAverageScore,
  finalRating,
  completionRate,
}: EvaluationSummaryDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{EVALUATION_UI_TEXT.RESULT}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{EVALUATION_UI_TEXT.FINAL_RATING}</p>
            <div className="mt-1">
              <RatingBadge rating={finalRating} size="lg" />
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">{EVALUATION_UI_TEXT.AVERAGE_SCORE}</p>
            <p className="text-2xl font-bold mt-1">
              {averageScore !== null && averageScore !== undefined
                ? averageScore.toFixed(2)
                : "-"}
            </p>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">{EVALUATION_UI_TEXT.SELF_EVALUATION}</p>
            <p className="text-2xl font-bold mt-1">
              {selfAverageScore !== null && selfAverageScore !== undefined
                ? selfAverageScore.toFixed(2)
                : "-"}
            </p>
          </div>

          {completionRate !== undefined && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">入力進捗</p>
              <p className="text-2xl font-bold mt-1">{completionRate}%</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
