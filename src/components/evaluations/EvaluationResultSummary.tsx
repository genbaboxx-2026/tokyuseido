"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RatingBadge, ScoreBadge } from "./EvaluationScoreInput"
import { EVALUATION_UI_TEXT } from "@/lib/evaluation/constants"

interface CategoryScore {
  category: string
  averageScore: number | null
  itemCount: number
}

interface EvaluatorScore {
  evaluatorName: string
  averageScore: number | null
  order?: number
  scores: Array<{
    itemName?: string
    evaluationItemId?: string
    score: number
    comment?: string | null
  }>
}

interface EvaluationResultSummaryProps {
  employeeName: string
  periodName: string
  totalScore?: number | null
  averageScore?: number | null
  selfAverageScore?: number | null
  finalRating?: "S" | "A" | "B" | "C" | "D" | null
  categoryScores?: CategoryScore[]
  evaluatorScores?: EvaluatorScore[]
  feedback?: string | null
}

export function EvaluationResultSummary({
  employeeName,
  periodName,
  totalScore,
  averageScore,
  selfAverageScore,
  finalRating,
  categoryScores = [],
  evaluatorScores = [],
  feedback,
}: EvaluationResultSummaryProps) {
  return (
    <div className="space-y-6">
      {/* ヘッダー情報 */}
      <Card>
        <CardHeader>
          <CardTitle>{EVALUATION_UI_TEXT.RESULT}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">{EVALUATION_UI_TEXT.EVALUATEE}</p>
              <p className="font-medium">{employeeName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{EVALUATION_UI_TEXT.EVALUATION_PERIODS}</p>
              <p className="font-medium">{periodName}</p>
            </div>
          </div>

          {/* スコアサマリー */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{EVALUATION_UI_TEXT.FINAL_RATING}</p>
              <div className="mt-2">
                <RatingBadge rating={finalRating} size="lg" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">{EVALUATION_UI_TEXT.AVERAGE_SCORE}</p>
              <p className="text-3xl font-bold mt-1">
                {averageScore !== null && averageScore !== undefined
                  ? averageScore.toFixed(2)
                  : "-"}
              </p>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">{EVALUATION_UI_TEXT.SELF_EVALUATION}</p>
              <p className="text-3xl font-bold mt-1">
                {selfAverageScore !== null && selfAverageScore !== undefined
                  ? selfAverageScore.toFixed(2)
                  : "-"}
              </p>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">{EVALUATION_UI_TEXT.TOTAL_SCORE}</p>
              <p className="text-3xl font-bold mt-1">
                {totalScore !== null && totalScore !== undefined
                  ? totalScore.toFixed(1)
                  : "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* カテゴリ別スコア */}
      {categoryScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{EVALUATION_UI_TEXT.CATEGORY}別スコア</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{EVALUATION_UI_TEXT.CATEGORY}</TableHead>
                  <TableHead className="text-center">項目数</TableHead>
                  <TableHead className="text-center">{EVALUATION_UI_TEXT.AVERAGE_SCORE}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryScores.map((category) => (
                  <TableRow key={category.category}>
                    <TableCell className="font-medium">{category.category}</TableCell>
                    <TableCell className="text-center">{category.itemCount}</TableCell>
                    <TableCell className="text-center">
                      {category.averageScore !== null
                        ? category.averageScore.toFixed(2)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 評価者別スコア（360度評価用） */}
      {evaluatorScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{EVALUATION_UI_TEXT.EVALUATOR}別スコア</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{EVALUATION_UI_TEXT.EVALUATOR}</TableHead>
                  <TableHead className="text-center">{EVALUATION_UI_TEXT.AVERAGE_SCORE}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluatorScores.map((evaluator, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{evaluator.evaluatorName}</TableCell>
                    <TableCell className="text-center">
                      {evaluator.averageScore !== null
                        ? evaluator.averageScore.toFixed(2)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* フィードバック */}
      {feedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{EVALUATION_UI_TEXT.FEEDBACK}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{feedback}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// 360度評価結果の詳細表示
interface Evaluation360ResultDetailProps {
  items: Array<{
    id: string
    name: string
    category: string
  }>
  evaluatorScores: Array<{
    evaluatorName: string
    order: number
    scores: Array<{
      evaluationItemId: string
      score: number
      comment?: string | null
    }>
  }>
}

export function Evaluation360ResultDetail({
  items,
  evaluatorScores,
}: Evaluation360ResultDetailProps) {
  // カテゴリでグループ化
  const groupedItems = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = []
      }
      acc[item.category].push(item)
      return acc
    },
    {} as Record<string, typeof items>
  )

  // 項目ごとの平均点を計算
  const getAverageForItem = (itemId: string): number | null => {
    const scores = evaluatorScores
      .flatMap((e) => e.scores)
      .filter((s) => s.evaluationItemId === itemId)
      .map((s) => s.score)

    if (scores.length === 0) return null
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedItems).map(([category, categoryItems]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{EVALUATION_UI_TEXT.EVALUATION_ITEMS}</TableHead>
                  {evaluatorScores.map((evaluator) => (
                    <TableHead key={evaluator.order} className="text-center">
                      {evaluator.evaluatorName}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">平均</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    {evaluatorScores.map((evaluator) => {
                      const score = evaluator.scores.find(
                        (s) => s.evaluationItemId === item.id
                      )
                      return (
                        <TableCell key={evaluator.order} className="text-center">
                          <ScoreBadge score={score?.score} size="sm" />
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center font-medium">
                      {getAverageForItem(item.id)?.toFixed(1) ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
