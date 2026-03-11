"use client"

import { useState, useEffect } from "react"
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
  ClipboardCheck,
  Users,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const EvaluationModal = dynamic(
  () => import("@/components/operations/EvaluationModal").then((mod) => mod.EvaluationModal),
  { ssr: false }
)
import { type EvalStatus } from "@/components/operations/StatusIndicator"
import type { BonusSetting } from "@/components/operations/evaluationUtils"
import { IndividualEvaluationSection } from "@/components/operations/individual"
import { Evaluation360Section } from "@/components/operations/evaluation360"
import { EvaluationStepIndicator } from "@/components/operations/EvaluationStepIndicator"
import { FinalizePromptBanner } from "@/components/operations/FinalizePromptBanner"

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
  finalizedAt: string | null
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

interface PhaseCounts {
  preparing: number
  distributing: number
  collected?: number
  aggregated: number
  completed: number
}

export default function EvaluationPeriodDetailPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.companyId as string
  const periodId = params.periodId as string
  const queryClient = useQueryClient()

  const [selectedEvaluation, setSelectedEvaluation] = useState<{
    id: string
    type: "individual" | "360"
  } | null>(null)
  const [individualOpen, setIndividualOpen] = useState(true)
  const [eval360Open, setEval360Open] = useState(true)

  const { data, isLoading, error } = useQuery<EvaluationPeriodDetail>({
    queryKey: ["evaluationPeriod", periodId],
    queryFn: async () => {
      const res = await fetch(`/api/evaluation-periods/${periodId}`)
      if (!res.ok) throw new Error("評価期間の取得に失敗しました")
      return res.json()
    },
  })

  const { data: individualCounts } = useQuery<PhaseCounts>({
    queryKey: ["individualPhaseCounts", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/phase-counts`
      )
      if (!res.ok) return { preparing: 0, distributing: 0, aggregated: 0, completed: 0 }
      return res.json()
    },
  })

  const { data: eval360Counts } = useQuery<PhaseCounts>({
    queryKey: ["360PhaseCounts", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/phase-counts`
      )
      if (!res.ok) return { preparing: 0, distributing: 0, aggregated: 0, completed: 0 }
      return res.json()
    },
  })

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
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["evaluationPeriod", periodId], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluationPeriod", periodId] })
    },
  })

  const individualTotal = individualCounts
    ? Object.values(individualCounts).reduce((a, b) => a + b, 0)
    : 0
  const individualCompleted = individualCounts?.completed ?? 0
  const isIndividualAllCompleted = individualTotal > 0 && individualCompleted === individualTotal

  const eval360Total = eval360Counts
    ? Object.values(eval360Counts).reduce((a, b) => a + b, 0)
    : 0
  const eval360Completed = eval360Counts?.completed ?? 0
  const isEval360AllCompleted = eval360Total > 0 && eval360Completed === eval360Total

  const hasIndividual = individualTotal > 0
  const has360 = eval360Total > 0

  const allEvaluationsCompleted =
    (hasIndividual ? isIndividualAllCompleted : true) &&
    (has360 ? isEval360AllCompleted : true) &&
    (hasIndividual || has360)

  const isFinalized = !!data?.finalizedAt

  useEffect(() => {
    if (allEvaluationsCompleted) {
      setIndividualOpen(false)
      setEval360Open(false)
    }
  }, [allEvaluationsCompleted])

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

  const displayStatus = isFinalized
    ? { label: "確定済み", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 }
    : allEvaluationsCompleted
      ? { label: "最終確認待ち", color: "bg-sky-100 text-sky-800", icon: Clock }
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

      {/* ステップインジケーター */}
      <EvaluationStepIndicator
        currentStep={1}
        canProceedToStep2={allEvaluationsCompleted}
        onStepClick={(step) => {
          if (step === 2) {
            router.push(`/companies/${companyId}/operations/${periodId}/finalize`)
          }
        }}
      />

      {/* 個別評価セクション（アコーディオン） */}
      {hasIndividual && (
        <Collapsible open={individualOpen} onOpenChange={setIndividualOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="h-5 w-5 text-sky-600" />
                    <CardTitle className="text-base">個別評価</CardTitle>
                    <Badge
                      variant={isIndividualAllCompleted ? "default" : "secondary"}
                      className={cn(
                        isIndividualAllCompleted && "bg-emerald-100 text-emerald-800"
                      )}
                    >
                      {isIndividualAllCompleted ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> 完了</>
                      ) : (
                        <>完了: {individualCompleted}/{individualTotal}</>
                      )}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      individualOpen && "rotate-180"
                    )}
                  />
                </div>
                <p className="text-sm text-muted-foreground">上司による従業員評価</p>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <IndividualEvaluationSection companyId={companyId} periodId={periodId} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* 360度評価セクション（アコーディオン） */}
      {has360 && (
        <Collapsible open={eval360Open} onOpenChange={setEval360Open}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-sky-600" />
                    <CardTitle className="text-base">360度評価</CardTitle>
                    <Badge
                      variant={isEval360AllCompleted ? "default" : "secondary"}
                      className={cn(
                        isEval360AllCompleted && "bg-emerald-100 text-emerald-800"
                      )}
                    >
                      {isEval360AllCompleted ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> 完了</>
                      ) : (
                        <>確定: {eval360Completed}/{eval360Total}</>
                      )}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      eval360Open && "rotate-180"
                    )}
                  />
                </div>
                <p className="text-sm text-muted-foreground">複数評価者による多面評価</p>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Evaluation360Section companyId={companyId} periodId={periodId} periodName={data.name} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* 最終確認バナー */}
      {allEvaluationsCompleted && !isFinalized && (
        <FinalizePromptBanner companyId={companyId} periodId={periodId} />
      )}

      {/* 確定済みバナー */}
      {isFinalized && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center space-y-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
          <h3 className="text-lg font-bold text-emerald-800">評価確定済み</h3>
          <p className="text-sm text-emerald-600">
            {new Date(data.finalizedAt!).toLocaleDateString("ja-JP")} に確定されました
          </p>
          <Button variant="outline" asChild>
            <Link href={`/companies/${companyId}/operations/${periodId}/finalize`}>
              確定結果を確認する
            </Link>
          </Button>
        </div>
      )}

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
    </div>
  )
}
