"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft } from "lucide-react"
import {
  IndividualEvaluationForm,
  EvaluationSummaryDisplay,
} from "@/components/evaluations/IndividualEvaluationForm"
import { EVALUATION_UI_TEXT } from "@/lib/evaluation/constants"

interface EvaluationItem {
  id: string
  name: string
  description: string | null
  category: string
  weight: number | null
}

interface EvaluationScore {
  id: string
  evaluationItemId: string
  selfScore: number | null
  evaluatorScore: number | null
  comment: string | null
  evaluationItem: EvaluationItem
}

interface IndividualEvaluation {
  id: string
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FEEDBACK_DONE"
  totalScore: number | null
  finalRating: "S" | "A" | "B" | "C" | "D" | null
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
  evaluator: {
    id: string
    name: string | null
    email: string | null
  }
  scores: EvaluationScore[]
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "未開始",
  IN_PROGRESS: "評価中",
  COMPLETED: "完了",
  FEEDBACK_DONE: "フィードバック済",
}

export default function IndividualEvaluationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string
  const evaluationId = params.evaluationId as string

  const [evaluation, setEvaluation] = useState<IndividualEvaluation | null>(null)
  const [items, setItems] = useState<EvaluationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("self")

  // 評価詳細を取得
  useEffect(() => {
    const fetchEvaluation = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/evaluations/individual/${evaluationId}`)
        if (!response.ok) throw new Error("個別評価の取得に失敗しました")
        const data = await response.json()
        setEvaluation(data)

        // 評価項目を取得（等級×職種に紐づく項目、または共通項目）
        // ここでは全項目を取得する簡易実装
        const itemsResponse = await fetch("/api/evaluations/items")
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json()
          setItems(itemsData)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました")
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvaluation()
  }, [evaluationId])

  const handleSubmit = async (
    scores: Array<{
      evaluationItemId: string
      selfScore?: number | null
      evaluatorScore?: number | null
      comment?: string | null
    }>
  ) => {
    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/evaluations/individual/${evaluationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "保存に失敗しました")
      }

      const updatedEvaluation = await response.json()
      setEvaluation((prev) => (prev ? { ...prev, ...updatedEvaluation } : null))

      // 詳細を再取得
      const detailResponse = await fetch(`/api/evaluations/individual/${evaluationId}`)
      if (detailResponse.ok) {
        const data = await detailResponse.json()
        setEvaluation(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 自己評価平均を計算
  const selfAverageScore =
    evaluation?.scores && evaluation.scores.length > 0
      ? (() => {
          const validScores = evaluation.scores.filter((s) => s.selfScore !== null)
          if (validScores.length === 0) return null
          const sum = validScores.reduce((acc, s) => acc + (s.selfScore ?? 0), 0)
          return Math.round((sum / validScores.length) * 100) / 100
        })()
      : null

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
          <Link href={`/companies/${companyId}/evaluations/individual`}>
            一覧に戻る
          </Link>
        </Button>
      </div>
    )
  }

  const allItems =
    items.length > 0
      ? items
      : evaluation.scores.map((s) => s.evaluationItem)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${companyId}/evaluations/individual`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {evaluation.employee.lastName} {evaluation.employee.firstName} さんの評価
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

      {/* 従業員情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{EVALUATION_UI_TEXT.EVALUATEE}情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">氏名</p>
              <p className="font-medium">
                {evaluation.employee.lastName} {evaluation.employee.firstName}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">社員番号</p>
              <p className="font-medium">
                {evaluation.employee.employeeCode ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">部署</p>
              <p className="font-medium">
                {evaluation.employee.department?.name ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">等級</p>
              <p className="font-medium">
                {evaluation.employee.grade?.name ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">職種</p>
              <p className="font-medium">
                {evaluation.employee.jobType?.name ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{EVALUATION_UI_TEXT.EVALUATOR}</p>
              <p className="font-medium">
                {evaluation.evaluator.name ?? evaluation.evaluator.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 結果サマリー */}
      <EvaluationSummaryDisplay
        totalScore={evaluation.totalScore}
        averageScore={evaluation.totalScore}
        selfAverageScore={selfAverageScore}
        finalRating={evaluation.finalRating}
        completionRate={
          evaluation.scores.length > 0
            ? Math.round(
                (evaluation.scores.filter((s) => s.evaluatorScore !== null).length /
                  evaluation.scores.length) *
                  100
              )
            : 0
        }
      />

      {/* 評価入力タブ */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="self">{EVALUATION_UI_TEXT.SELF_EVALUATION}</TabsTrigger>
              <TabsTrigger value="evaluator">{EVALUATION_UI_TEXT.SUPERVISOR_EVALUATION}</TabsTrigger>
              <TabsTrigger value="result">{EVALUATION_UI_TEXT.RESULT}</TabsTrigger>
            </TabsList>

            <TabsContent value="self">
              <IndividualEvaluationForm
                evaluationId={evaluation.id}
                items={allItems}
                scores={evaluation.scores}
                isSelfEvaluation={true}
                isReadOnly={evaluation.status === "COMPLETED" || evaluation.status === "FEEDBACK_DONE"}
                onSubmit={handleSubmit}
                isLoading={isSubmitting}
              />
            </TabsContent>

            <TabsContent value="evaluator">
              <IndividualEvaluationForm
                evaluationId={evaluation.id}
                items={allItems}
                scores={evaluation.scores}
                isSelfEvaluation={false}
                isReadOnly={evaluation.status === "FEEDBACK_DONE"}
                onSubmit={handleSubmit}
                isLoading={isSubmitting}
              />
            </TabsContent>

            <TabsContent value="result">
              <IndividualEvaluationForm
                evaluationId={evaluation.id}
                items={allItems}
                scores={evaluation.scores}
                isReadOnly={true}
                onSubmit={async () => {}}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
