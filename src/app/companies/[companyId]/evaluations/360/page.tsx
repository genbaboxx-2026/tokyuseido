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
import { ArrowLeft, FileText, Users } from "lucide-react"
import { AssignmentStatus } from "@/components/evaluations/EvaluatorAssignmentTable"
import { EVALUATION_UI_TEXT, EVALUATION_STATUS_OPTIONS } from "@/lib/evaluation/constants"

interface Evaluation360 {
  id: string
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FEEDBACK_DONE"
  averageScore: number | null
  feedback: string | null
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
  evaluatorAssignments: Array<{
    id: string
    evaluatorId: string
    order: number
    evaluator: {
      id: string
      name: string | null
      email: string | null
    }
  }>
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

export default function Evaluation360ListPage() {
  const params = useParams()
  const companyId = params.companyId as string

  const [evaluations, setEvaluations] = useState<Evaluation360[]>([])
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

  // 360度評価を取得
  useEffect(() => {
    const fetchEvaluations = async () => {
      if (!selectedPeriodId) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        let url = `/api/evaluations/360?evaluationPeriodId=${selectedPeriodId}`
        if (selectedStatus) {
          url += `&status=${selectedStatus}`
        }

        const response = await fetch(url)
        if (!response.ok) throw new Error("360度評価の取得に失敗しました")
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{EVALUATION_UI_TEXT.EVALUATION_360}</h1>
          <p className="text-muted-foreground">
            複数の評価者による360度評価の管理
          </p>
        </div>
        <Button asChild>
          <Link href={`/companies/${companyId}/evaluations/360/assignments`}>
            <Users className="h-4 w-4 mr-2" />
            評価者割当
          </Link>
        </Button>
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
                  <TableHead className="text-center">{EVALUATION_UI_TEXT.AVERAGE_SCORE}</TableHead>
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
                      <AssignmentStatus assignments={evaluation.evaluatorAssignments} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={STATUS_LABELS[evaluation.status]?.variant ?? "outline"}>
                        {STATUS_LABELS[evaluation.status]?.label ?? evaluation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {evaluation.averageScore !== null
                        ? evaluation.averageScore.toFixed(2)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`/companies/${companyId}/evaluations/360/${evaluation.id}/input`}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            入力
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`/companies/${companyId}/evaluations/360/${evaluation.id}/result`}
                          >
                            結果
                          </Link>
                        </Button>
                      </div>
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
