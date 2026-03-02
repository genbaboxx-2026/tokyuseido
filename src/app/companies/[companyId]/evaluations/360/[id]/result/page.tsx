"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import {
  EvaluationResultSummary,
  Evaluation360ResultDetail,
} from "@/components/evaluations/EvaluationResultSummary"
import { EVALUATION_UI_TEXT } from "@/lib/evaluation/constants"

interface EvaluationItem {
  id: string
  name: string
  description: string | null
  category: string
}

interface Evaluation360 {
  id: string
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FEEDBACK_DONE"
  averageScore: number | null
  feedback: string | null
  evaluationPeriod: {
    id: string
    name: string
    periodType: string
    startDate: string
    endDate: string
    status: string
  }
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string | null
    department: { id: string; name: string } | null
    grade: { id: string; name: string; level: number } | null
    jobType: { id: string; name: string } | null
  }
  evaluatorAssignments: Array<{
    id: string
    evaluatorId: string
    order: number
    evaluator: {
      id: string
      name: string | null
      email: string | null
    }
    scores: Array<{
      evaluationItemId: string
      score: number
      comment: string | null
    }>
  }>
  scores: Array<{
    evaluationItemId: string
    score: number
    comment: string | null
    evaluationItem: EvaluationItem
    evaluatorAssignment: {
      id: string
      order: number
      evaluator: {
        id: string
        name: string | null
      }
    }
  }>
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "未開始",
  IN_PROGRESS: "評価中",
  COMPLETED: "完了",
  FEEDBACK_DONE: "フィードバック済",
}

export default function Evaluation360ResultPage() {
  const params = useParams()
  const companyId = params.companyId as string
  const evaluationId = params.id as string

  const [evaluation, setEvaluation] = useState<Evaluation360 | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 評価詳細を取得
  useEffect(() => {
    const fetchEvaluation = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/evaluations/360/${evaluationId}`)
        if (!response.ok) throw new Error("360度評価の取得に失敗しました")
        const data = await response.json()
        setEvaluation(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました")
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvaluation()
  }, [evaluationId])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">評価が見つかりません</p>
        <Button asChild className="mt-4">
          <Link href={`/companies/${companyId}/evaluations/360`}>
            一覧に戻る
          </Link>
        </Button>
      </div>
    )
  }

  // 評価項目一覧を取得
  const itemsMap = new Map<string, EvaluationItem>()
  for (const score of evaluation.scores) {
    itemsMap.set(score.evaluationItemId, score.evaluationItem)
  }
  const items = Array.from(itemsMap.values())

  // 評価者ごとのスコアを整理
  const evaluatorScores = evaluation.evaluatorAssignments.map((assignment) => ({
    evaluatorName: assignment.evaluator.name ?? assignment.evaluator.email ?? "不明",
    order: assignment.order,
    scores: assignment.scores,
    averageScore:
      assignment.scores.length > 0
        ? Math.round(
            (assignment.scores.reduce((acc, s) => acc + s.score, 0) /
              assignment.scores.length) *
              100
          ) / 100
        : null,
  }))

  // カテゴリ別スコア
  const categoryScores = items.reduce(
    (acc, item) => {
      const scores = evaluation.scores.filter(
        (s) => s.evaluationItemId === item.id
      )
      const existing = acc.find((c) => c.category === item.category)
      if (existing) {
        existing.scores.push(...scores.map((s) => s.score))
        existing.itemCount++
      } else {
        acc.push({
          category: item.category,
          scores: scores.map((s) => s.score),
          itemCount: 1,
          averageScore: null,
        })
      }
      return acc
    },
    [] as Array<{
      category: string
      scores: number[]
      itemCount: number
      averageScore: number | null
    }>
  )

  // カテゴリ別平均を計算
  for (const category of categoryScores) {
    if (category.scores.length > 0) {
      category.averageScore =
        Math.round(
          (category.scores.reduce((a, b) => a + b, 0) / category.scores.length) *
            100
        ) / 100
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${companyId}/evaluations/360`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {evaluation.employee.lastName} {evaluation.employee.firstName} さんの評価結果
          </h1>
          <p className="text-muted-foreground">
            {evaluation.evaluationPeriod.name}
          </p>
        </div>
        <Badge className="ml-auto">
          {STATUS_LABELS[evaluation.status]}
        </Badge>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => setError(null)}
          >
            閉じる
          </Button>
        </div>
      )}

      {/* 結果サマリー */}
      <EvaluationResultSummary
        employeeName={`${evaluation.employee.lastName} ${evaluation.employee.firstName}`}
        periodName={evaluation.evaluationPeriod.name}
        averageScore={evaluation.averageScore}
        categoryScores={categoryScores}
        evaluatorScores={evaluatorScores}
        feedback={evaluation.feedback}
      />

      {/* 詳細結果 */}
      {items.length > 0 && evaluatorScores.length > 0 && (
        <Evaluation360ResultDetail
          items={items}
          evaluatorScores={evaluatorScores}
        />
      )}
    </div>
  )
}
