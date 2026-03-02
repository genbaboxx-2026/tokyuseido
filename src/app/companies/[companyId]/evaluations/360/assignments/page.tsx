"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "lucide-react"
import { EvaluatorAssignmentTable } from "@/components/evaluations/EvaluatorAssignmentTable"
import { EVALUATION_UI_TEXT } from "@/lib/evaluation/constants"

interface User {
  id: string
  name: string | null
  email: string | null
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string | null
  department: { id: string; name: string } | null
  grade: { id: string; name: string } | null
}

interface Evaluation360 {
  id: string
  employee: Employee
  evaluatorAssignments: Array<{
    id: string
    evaluatorId: string
    order: number
    evaluator: User
  }>
}

interface EvaluationPeriod {
  id: string
  name: string
  periodType: string
  status: string
}

interface Assignment {
  evaluation360Id: string
  evaluatorId: string
  order: number
}

export default function EvaluatorAssignmentPage() {
  const params = useParams()
  const companyId = params.companyId as string

  const [periods, setPeriods] = useState<EvaluationPeriod[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [evaluations, setEvaluations] = useState<Evaluation360[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 評価期間を取得
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const response = await fetch(`/api/evaluations/periods?companyId=${companyId}`)
        if (!response.ok) throw new Error("評価期間の取得に失敗しました")
        const data = await response.json()
        setPeriods(data)
        if (data.length > 0) {
          setSelectedPeriodId(data[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました")
      }
    }
    fetchPeriods()
  }, [companyId])

  // 360度評価とユーザー一覧を取得
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedPeriodId) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)

        // 360度評価を取得
        const evaluationsResponse = await fetch(
          `/api/evaluations/360?evaluationPeriodId=${selectedPeriodId}`
        )
        if (!evaluationsResponse.ok) throw new Error("360度評価の取得に失敗しました")
        const evaluationsData = await evaluationsResponse.json()
        setEvaluations(evaluationsData)

        // ユーザー一覧を取得（会社に所属するユーザー）
        // 簡易実装：全ユーザーを取得
        // 実際には会社に紐づくユーザーのみを取得するAPIが必要
        const usersResponse = await fetch("/api/users")
        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setUsers(usersData)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [selectedPeriodId])

  const handleSave = async (assignments: Record<string, Assignment[]>) => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)

      // 各評価の評価者割当を更新
      const promises = Object.entries(assignments).map(
        async ([evaluationId, assignmentList]) => {
          const response = await fetch(
            `/api/evaluations/360/${evaluationId}/assignments`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                assignmentList.map((a) => ({
                  evaluatorId: a.evaluatorId,
                  order: a.order,
                }))
              ),
            }
          )

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "保存に失敗しました")
          }

          return response.json()
        }
      )

      await Promise.all(promises)

      setSuccessMessage("評価者割当を保存しました")

      // データを再取得
      const evaluationsResponse = await fetch(
        `/api/evaluations/360?evaluationPeriodId=${selectedPeriodId}`
      )
      if (evaluationsResponse.ok) {
        const evaluationsData = await evaluationsResponse.json()
        setEvaluations(evaluationsData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsSaving(false)
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
          <h1 className="text-2xl font-bold">評価者割当</h1>
          <p className="text-muted-foreground">
            360度評価の評価者を割り当てます
          </p>
        </div>
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

      {/* フィルター */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                {EVALUATION_UI_TEXT.EVALUATION_PERIODS}
              </label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger>
                  <SelectValue placeholder={EVALUATION_UI_TEXT.SELECT_PLACEHOLDER} />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 評価者割当テーブル */}
      <Card>
        <CardHeader>
          <CardTitle>評価者割当表</CardTitle>
          <CardDescription>
            各被評価者に対して最大4名の評価者を割り当てます。
            横軸が評価者1〜4、縦軸が被評価者です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : evaluations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {periods.length === 0
                ? "評価期間を先に作成してください"
                : "360度評価が登録されていません"}
            </div>
          ) : (
            <EvaluatorAssignmentTable
              evaluations={evaluations}
              availableEvaluators={users}
              onSave={handleSave}
              isLoading={isSaving}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
