"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"

// モーダルを遅延読み込み
const EvaluationModal = dynamic(
  () => import("@/components/operations/EvaluationModal").then((mod) => mod.EvaluationModal),
  { ssr: false }
)
import { type EvalStatus } from "@/components/operations/StatusIndicator"
import {
  calculateSalaryReflectionDate,
  calculateBonusPaymentDate,
  formatDateWithYear,
  parseTargets,
  type BonusSetting,
} from "@/components/operations/evaluationUtils"
import { IndividualEvaluationSection } from "@/components/operations/individual"
import { Evaluation360Section } from "@/components/operations/evaluation360"

interface SalarySettings {
  reflectionMonth: number | null
  reflectionDay: number | null
  evaluationPeriodStart: string | null
  evaluationPeriodEnd: string | null
}

interface EvaluationPeriodDetail {
  id: string
  name: string
  periodType: "FIRST_HALF" | "SECOND_HALF"
  startDate: string
  endDate: string
  status: EvalStatus
  createdAt: string
  evaluations: {
    id: string
    evaluationType: "individual" | "360"
    status: EvalStatus
    employee: {
      id: string
      lastName: string
      firstName: string
      grade: { name: string } | null
      jobType: { name: string } | null
      department: { name: string } | null
    }
  }[]
  salarySettings: SalarySettings
  bonusSettings: BonusSetting[]
  _count: {
    evaluations: number
  }
}

export default function EvaluationPeriodDetailPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string
  const periodId = params.periodId as string
  const queryClient = useQueryClient()

  // モーダル表示用の状態
  const [selectedEvaluation, setSelectedEvaluation] = useState<{
    id: string
    type: "individual" | "360"
  } | null>(null)

  const { data, isLoading, error } = useQuery<EvaluationPeriodDetail>({
    queryKey: ["evaluationPeriod", periodId],
    queryFn: async () => {
      const res = await fetch(`/api/evaluation-periods/${periodId}`)
      if (!res.ok) throw new Error("評価期間の取得に失敗しました")
      return res.json()
    },
  })

  // ステータス更新のmutation（オプティミスティック更新）
  const updateStatusMutation = useMutation({
    mutationFn: async ({ evaluationId, newStatus }: { evaluationId: string; newStatus: EvalStatus }) => {
      const res = await fetch(`/api/employee-evaluations/${evaluationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "ステータスの更新に失敗しました")
      }
      return res.json()
    },
    onMutate: async ({ evaluationId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["evaluationPeriod", periodId] })
      const previousData = queryClient.getQueryData<EvaluationPeriodDetail>(["evaluationPeriod", periodId])

      if (previousData) {
        queryClient.setQueryData<EvaluationPeriodDetail>(["evaluationPeriod", periodId], {
          ...previousData,
          evaluations: previousData.evaluations.map((evaluation) =>
            evaluation.id === evaluationId
              ? { ...evaluation, status: newStatus }
              : evaluation
          ),
        })
      }

      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["evaluationPeriod", periodId], context.previousData)
      }
      alert("ステータスの更新に失敗しました")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluationPeriod", periodId] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">評価期間の取得に失敗しました</p>
        <Button variant="outline" onClick={() => router.back()}>
          戻る
        </Button>
      </div>
    )
  }

  // 全員完了かどうかを判定
  const allCompleted = data.evaluations.length > 0 &&
    data.evaluations.every(e => e.status === "COMPLETED")

  // 表示用ステータス
  const displayStatus = allCompleted
    ? { label: "完了", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 }
    : { label: "未完了", color: "bg-amber-100 text-amber-800", icon: Clock }
  const StatusIcon = displayStatus.icon

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${companyId}/operations`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(data.startDate).toLocaleDateString("ja-JP")} 〜{" "}
            {new Date(data.endDate).toLocaleDateString("ja-JP")}
          </p>
        </div>
        <Badge className={displayStatus.color}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {displayStatus.label}
        </Badge>
      </div>

      {/* 個別評価セクション（フェーズタブUI） */}
      <IndividualEvaluationSection companyId={companyId} periodId={periodId} />

      {/* 360度評価セクション（フェーズタブUI） */}
      <Evaluation360Section companyId={companyId} periodId={periodId} />

      {/* 評価モーダル */}
      {selectedEvaluation && (
        <EvaluationModal
          evaluationId={selectedEvaluation.id}
          evaluationType={selectedEvaluation.type}
          isOpen={!!selectedEvaluation}
          onClose={() => setSelectedEvaluation(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["evaluationPeriod", periodId] })
          }}
        />
      )}

      {/* 評価がない場合 */}
      {data.evaluations.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              評価対象者がいません
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
