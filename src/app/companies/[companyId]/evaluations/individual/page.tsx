"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, FileText } from "lucide-react"
import { RatingBadge } from "@/components/evaluations/EvaluationScoreInput"
import { EVALUATION_UI_TEXT, EVALUATION_STATUS_OPTIONS } from "@/lib/evaluation/constants"

interface IndividualEvaluation {
  id: string
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FEEDBACK_DONE"
  totalScore: number | null
  finalRating: "S" | "A" | "B" | "C" | "D" | null
  evaluationPeriod: {
    id: string
    name: string
    periodType: string
    status: string
  }
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string | null
    department: { id: string; name: string } | null
    grade: { id: string; name: string } | null
  }
  evaluator: {
    id: string
    name: string | null
    email: string | null
  }
  _count: {
    scores: number
  }
}

interface EvaluationPeriod {
  id: string
  name: string
  periodType: string
  status: string
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  NOT_STARTED: { label: "未開始", variant: "outline" },
  IN_PROGRESS: { label: "評価中", variant: "default" },
  COMPLETED: { label: "完了", variant: "secondary" },
  FEEDBACK_DONE: { label: "フィードバック済", variant: "secondary" },
}

export default function IndividualEvaluationListPage() {
  const params = useParams()
  const companyId = params.companyId as string

  const [evaluations, setEvaluations] = useState<IndividualEvaluation[]>([])
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // 個別評価を取得
  useEffect(() => {
    const fetchEvaluations = async () => {
      if (!selectedPeriodId) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        let url = `/api/evaluations/individual?evaluationPeriodId=${selectedPeriodId}`
        if (selectedStatus) {
          url += `&status=${selectedStatus}`
        }

        const response = await fetch(url)
        if (!response.ok) throw new Error("個別評価の取得に失敗しました")
        const data = await response.json()
        setEvaluations(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました")
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvaluations()
  }, [selectedPeriodId, selectedStatus])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${companyId}/evaluations`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{EVALUATION_UI_TEXT.INDIVIDUAL_EVALUATION}</h1>
          <p className="text-muted-foreground">
            上司による個別評価の管理
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
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">
                {EVALUATION_UI_TEXT.STATUS}
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="すべて" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">すべて</SelectItem>
                  {EVALUATION_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 評価一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>{EVALUATION_UI_TEXT.EVALUATEE}一覧</CardTitle>
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
                : EVALUATION_UI_TEXT.NO_DATA}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{EVALUATION_UI_TEXT.EVALUATEE}</TableHead>
                  <TableHead>部署</TableHead>
                  <TableHead>等級</TableHead>
                  <TableHead>{EVALUATION_UI_TEXT.EVALUATOR}</TableHead>
                  <TableHead className="text-center">{EVALUATION_UI_TEXT.STATUS}</TableHead>
                  <TableHead className="text-center">入力項目数</TableHead>
                  <TableHead className="text-center">{EVALUATION_UI_TEXT.FINAL_RATING}</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell className="font-medium">
                      {evaluation.employee.lastName} {evaluation.employee.firstName}
                      {evaluation.employee.employeeCode && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {evaluation.employee.employeeCode}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {evaluation.employee.department?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      {evaluation.employee.grade?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      {evaluation.evaluator.name ?? evaluation.evaluator.email}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={STATUS_LABELS[evaluation.status]?.variant ?? "outline"}>
                        {STATUS_LABELS[evaluation.status]?.label ?? evaluation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {evaluation._count.scores}
                    </TableCell>
                    <TableCell className="text-center">
                      <RatingBadge rating={evaluation.finalRating} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/companies/${companyId}/evaluations/individual/${evaluation.id}`}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          詳細
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
