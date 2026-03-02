"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { Evaluation360InputForm } from "@/components/evaluations/Evaluation360InputForm"
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
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "未開始",
  IN_PROGRESS: "評価中",
  COMPLETED: "完了",
  FEEDBACK_DONE: "フィードバック済",
}

export default function Evaluation360InputPage() {
  const params = useParams()
  const companyId = params.companyId as string
  const evaluationId = params.id as string

  const [evaluation, setEvaluation] = useState<Evaluation360 | null>(null)
  const [items, setItems] = useState<EvaluationItem[]>([])
  const [currentAssignment, setCurrentAssignment] = useState<
    Evaluation360["evaluatorAssignments"][0] | null
  >(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 評価詳細を取得
  useEffect(() => {
    const fetchEvaluation = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/evaluations/360/${evaluationId}`)
        if (!response.ok) throw new Error("360度評価の取得に失敗しました")
        const data = await response.json()
        setEvaluation(data)

        // 現在のユーザーの割当を探す
        // 実際にはセッションからユーザーIDを取得する必要がある
        // 簡易実装として最初の評価者を使用
        if (data.evaluatorAssignments.length > 0) {
          setCurrentAssignment(data.evaluatorAssignments[0])
        }

        // 評価項目を取得
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
      evaluatorAssignmentId: string
      evaluationItemId: string
      score: number
      comment?: string | null
    }>
  ) => {
    try {
      setIsSubmitting(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/evaluations/360/${evaluationId}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "保存に失敗しました")
      }

      setSuccessMessage("評価を保存しました")

      // 詳細を再取得
      const detailResponse = await fetch(`/api/evaluations/360/${evaluationId}`)
      if (detailResponse.ok) {
        const data = await detailResponse.json()
        setEvaluation(data)
        if (data.evaluatorAssignments.length > 0) {
          setCurrentAssignment(data.evaluatorAssignments[0])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsSubmitting(false)
    }
  }

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
            {evaluation.employee.lastName} {evaluation.employee.firstName} さんの360度評価
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

      {successMessage && (
        <div className="bg-green-100 text-green-800 p-4 rounded-md">
          {successMessage}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => setSuccessMessage(null)}
          >
            閉じる
          </Button>
        </div>
      )}

      {/* 被評価者情報 */}
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
          </div>
        </CardContent>
      </Card>

      {/* 評価者選択（複数評価者がいる場合） */}
      {evaluation.evaluatorAssignments.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{EVALUATION_UI_TEXT.EVALUATOR}を選択</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {evaluation.evaluatorAssignments.map((assignment) => (
                <Button
                  key={assignment.id}
                  variant={currentAssignment?.id === assignment.id ? "default" : "outline"}
                  onClick={() => setCurrentAssignment(assignment)}
                >
                  {assignment.order}. {assignment.evaluator.name ?? assignment.evaluator.email}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 評価入力フォーム */}
      {currentAssignment ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {currentAssignment.evaluator.name ?? currentAssignment.evaluator.email} の評価入力
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Evaluation360InputForm
              evaluation360Id={evaluation.id}
              evaluatorAssignmentId={currentAssignment.id}
              items={items}
              existingScores={currentAssignment.scores}
              isReadOnly={
                evaluation.status === "COMPLETED" ||
                evaluation.status === "FEEDBACK_DONE"
              }
              onSubmit={handleSubmit}
              onCancel={() => {}}
              isLoading={isSubmitting}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              {EVALUATION_UI_TEXT.NO_EVALUATORS}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
