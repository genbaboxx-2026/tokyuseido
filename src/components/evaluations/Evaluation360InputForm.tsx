"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EvaluationScoreInput } from "./EvaluationScoreInput"
import { EVALUATION_UI_TEXT } from "@/lib/evaluation/constants"

interface EvaluationItem {
  id: string
  name: string
  description?: string | null
  category: string
}

interface Score {
  evaluatorAssignmentId: string
  evaluationItemId: string
  score: number
  comment?: string | null
}

interface Evaluation360InputFormProps {
  evaluation360Id: string
  evaluatorAssignmentId: string
  items: EvaluationItem[]
  existingScores?: Array<{
    evaluationItemId: string
    score: number
    comment?: string | null
  }>
  isReadOnly?: boolean
  onSubmit: (scores: Score[]) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

export function Evaluation360InputForm({
  evaluatorAssignmentId,
  items,
  existingScores = [],
  isReadOnly = false,
  onSubmit,
  onCancel,
  isLoading = false,
}: Evaluation360InputFormProps) {
  const [scores, setScores] = useState<Map<string, { score: number | null; comment: string | null }>>(
    new Map()
  )

  // 初期スコアをセット
  useEffect(() => {
    const scoreMap = new Map<string, { score: number | null; comment: string | null }>()

    // 既存のスコアをマップに追加
    for (const score of existingScores) {
      scoreMap.set(score.evaluationItemId, {
        score: score.score,
        comment: score.comment ?? null,
      })
    }

    // 項目にスコアがない場合は空のスコアを追加
    for (const item of items) {
      if (!scoreMap.has(item.id)) {
        scoreMap.set(item.id, { score: null, comment: null })
      }
    }

    setScores(scoreMap)
  }, [existingScores, items])

  const updateScore = (itemId: string, score: number) => {
    setScores((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(itemId) ?? { score: null, comment: null }
      newMap.set(itemId, { ...existing, score })
      return newMap
    })
  }

  const updateComment = (itemId: string, comment: string) => {
    setScores((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(itemId) ?? { score: null, comment: null }
      newMap.set(itemId, { ...existing, comment })
      return newMap
    })
  }

  const handleSubmit = async () => {
    const scoresData: Score[] = []

    for (const [itemId, data] of scores.entries()) {
      if (data.score !== null) {
        scoresData.push({
          evaluatorAssignmentId,
          evaluationItemId: itemId,
          score: data.score,
          comment: data.comment,
        })
      }
    }

    await onSubmit(scoresData)
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

  // 入力完了数をカウント
  const completedCount = Array.from(scores.values()).filter((s) => s.score !== null).length
  const totalCount = items.length
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="space-y-6">
      {/* 進捗表示 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">入力進捗</p>
              <p className="text-2xl font-bold">
                {completedCount} / {totalCount} 項目
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{completionRate}%</p>
            </div>
          </div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </CardContent>
      </Card>

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

                    <EvaluationScoreInput
                      value={score?.score}
                      onChange={(value) => updateScore(item.id, value)}
                      disabled={isReadOnly}
                      showLabels
                      comment={score?.comment}
                      onCommentChange={(comment) => updateComment(item.id, comment)}
                      showComment={!isReadOnly}
                    />
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
          <Button onClick={handleSubmit} disabled={isLoading || completedCount === 0}>
            {isLoading ? EVALUATION_UI_TEXT.LOADING : EVALUATION_UI_TEXT.SUBMIT}
          </Button>
        </div>
      )}
    </div>
  )
}
