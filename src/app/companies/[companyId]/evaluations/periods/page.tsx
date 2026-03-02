"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react"
import { EvaluationPeriodForm } from "@/components/evaluations/EvaluationPeriodForm"
import { EVALUATION_UI_TEXT } from "@/lib/evaluation/constants"

interface EvaluationPeriod {
  id: string
  name: string
  periodType: "FIRST_HALF" | "SECOND_HALF"
  startDate: string
  endDate: string
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FEEDBACK_DONE"
  _count: {
    individualEvaluations: number
    evaluation360s: number
  }
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  NOT_STARTED: { label: "未開始", variant: "outline" },
  IN_PROGRESS: { label: "評価中", variant: "default" },
  COMPLETED: { label: "完了", variant: "secondary" },
  FEEDBACK_DONE: { label: "フィードバック済", variant: "secondary" },
}

const PERIOD_TYPE_LABELS: Record<string, string> = {
  FIRST_HALF: "上期",
  SECOND_HALF: "下期",
}

export default function EvaluationPeriodsPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string

  const [periods, setPeriods] = useState<EvaluationPeriod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<EvaluationPeriod | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPeriods = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/evaluations/periods?companyId=${companyId}`)
      if (!response.ok) throw new Error("評価期間の取得に失敗しました")
      const data = await response.json()
      setPeriods(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPeriods()
  }, [companyId])

  const handleCreate = async (data: {
    name: string
    periodType: string
    startDate: string
    endDate: string
  }) => {
    try {
      setIsSubmitting(true)
      const response = await fetch("/api/evaluations/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          companyId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "作成に失敗しました")
      }

      setIsDialogOpen(false)
      fetchPeriods()
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (data: {
    name: string
    periodType: string
    startDate: string
    endDate: string
    status?: string
  }) => {
    if (!editingPeriod) return

    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/evaluations/periods/${editingPeriod.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "更新に失敗しました")
      }

      setEditingPeriod(null)
      fetchPeriods()
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (period: EvaluationPeriod) => {
    if (!confirm(`「${period.name}」を削除してもよろしいですか？`)) return

    try {
      const response = await fetch(`/api/evaluations/periods/${period.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "削除に失敗しました")
      }

      fetchPeriods()
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${companyId}/evaluations`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{EVALUATION_UI_TEXT.EVALUATION_PERIODS}</h1>
          <p className="text-muted-foreground">
            評価期間の作成・管理を行います
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {EVALUATION_UI_TEXT.CREATE}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{EVALUATION_UI_TEXT.EVALUATION_PERIODS}を作成</DialogTitle>
            </DialogHeader>
            <EvaluationPeriodForm
              companyId={companyId}
              onSubmit={handleCreate}
              onCancel={() => setIsDialogOpen(false)}
              isLoading={isSubmitting}
            />
          </DialogContent>
        </Dialog>
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

      <Card>
        <CardHeader>
          <CardTitle>評価期間一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : periods.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {EVALUATION_UI_TEXT.NO_DATA}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{EVALUATION_UI_TEXT.PERIOD_NAME}</TableHead>
                  <TableHead>{EVALUATION_UI_TEXT.PERIOD_TYPE}</TableHead>
                  <TableHead>期間</TableHead>
                  <TableHead>{EVALUATION_UI_TEXT.STATUS}</TableHead>
                  <TableHead className="text-center">評価数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">{period.name}</TableCell>
                    <TableCell>{PERIOD_TYPE_LABELS[period.periodType]}</TableCell>
                    <TableCell>
                      {new Date(period.startDate).toLocaleDateString("ja-JP")} 〜{" "}
                      {new Date(period.endDate).toLocaleDateString("ja-JP")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_LABELS[period.status]?.variant ?? "outline"}>
                        {STATUS_LABELS[period.status]?.label ?? period.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      個別: {period._count.individualEvaluations} / 360: {period._count.evaluation360s}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingPeriod(period)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(period)}
                          disabled={
                            period._count.individualEvaluations > 0 ||
                            period._count.evaluation360s > 0
                          }
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* 編集ダイアログ */}
      <Dialog open={!!editingPeriod} onOpenChange={() => setEditingPeriod(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{EVALUATION_UI_TEXT.EVALUATION_PERIODS}を編集</DialogTitle>
          </DialogHeader>
          {editingPeriod && (
            <EvaluationPeriodForm
              companyId={companyId}
              initialData={{
                ...editingPeriod,
                startDate: new Date(editingPeriod.startDate).toISOString().split("T")[0],
                endDate: new Date(editingPeriod.endDate).toISOString().split("T")[0],
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingPeriod(null)}
              isLoading={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
