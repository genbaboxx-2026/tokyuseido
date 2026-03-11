"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ChevronDown,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { EvaluationStepIndicator } from "@/components/operations/EvaluationStepIndicator"
import type { EvaluationResultData, FinalizeSummary } from "@/types/evaluation-result"

interface FinalizeData {
  results: EvaluationResultData[]
  summary: FinalizeSummary | null
  isGenerated: boolean
  isConfirmed: boolean
  finalizedAt: string | null
}

const RANK_COLORS: Record<string, string> = {
  S: "bg-yellow-100 text-yellow-800 border-yellow-300",
  A: "bg-sky-100 text-sky-800 border-sky-300",
  B: "bg-green-100 text-green-800 border-green-300",
  C: "bg-orange-100 text-orange-800 border-orange-300",
  D: "bg-red-100 text-red-800 border-red-300",
}

export default function FinalizePage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const companyId = params.companyId as string
  const periodId = params.periodId as string

  const [step1Open, setStep1Open] = useState(true)
  const [step2Open, setStep2Open] = useState(true)
  const [step3Open, setStep3Open] = useState(true)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  const { data: periodData } = useQuery({
    queryKey: ["evaluationPeriod", periodId],
    queryFn: async () => {
      const res = await fetch(`/api/evaluation-periods/${periodId}`)
      if (!res.ok) throw new Error("評価期間の取得に失敗しました")
      return res.json()
    },
  })

  const {
    data: finalizeData,
    isLoading,
    error,
  } = useQuery<FinalizeData>({
    queryKey: ["finalize", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/finalize`
      )
      if (!res.ok) throw new Error("データの取得に失敗しました")
      return res.json()
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "generate" }),
        }
      )
      if (!res.ok) throw new Error("計算に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["finalize", companyId, periodId],
      })
    },
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm" }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "確定に失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["finalize", companyId, periodId],
      })
      queryClient.invalidateQueries({
        queryKey: ["evaluationPeriod", periodId],
      })
      setConfirmDialogOpen(false)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">データの取得に失敗しました</p>
        <Button variant="outline" onClick={() => router.back()}>
          戻る
        </Button>
      </div>
    )
  }

  const results = finalizeData?.results ?? []
  const summary = finalizeData?.summary
  const isConfirmed = finalizeData?.isConfirmed ?? false
  const isGenerated = finalizeData?.isGenerated ?? false

  const fmt = (n: number | null) => (n !== null ? n.toLocaleString() : "-")

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${companyId}/operations/${periodId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {periodData?.name ?? "最終確認・号俸反映"}
          </h1>
          <p className="text-sm text-muted-foreground">
            評価結果の統合と号俸変動を確認・確定します
          </p>
        </div>
        {isConfirmed && (
          <Badge className="bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            確定済み
          </Badge>
        )}
      </div>

      {/* ステップインジケーター */}
      <EvaluationStepIndicator
        currentStep={2}
        canProceedToStep2={true}
        onStepClick={(step) => {
          if (step === 1) {
            router.push(`/companies/${companyId}/operations/${periodId}`)
          }
        }}
      />

      {/* 未生成の場合: 生成ボタン */}
      {!isGenerated && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              評価結果の計算がまだ実行されていません。
            </p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              評価結果を計算する
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 生成済みの場合: 4サブステップ */}
      {isGenerated && (
        <>
          {/* 再計算ボタン（確定前のみ） */}
          {!isConfirmed && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                再計算
              </Button>
            </div>
          )}

          {/* ① 結果統合 */}
          <Collapsible open={step1Open} onOpenChange={setStep1Open}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-sky-500 text-white text-xs font-bold">
                        1
                      </span>
                      <CardTitle className="text-base">結果統合</CardTitle>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        step1Open && "rotate-180"
                      )}
                    />
                  </div>
                  <CardDescription>
                    360度評価と個別評価を割合で按分し、100点満点に換算
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">従業員名</TableHead>
                          <TableHead className="w-[70px]">等級</TableHead>
                          <TableHead className="w-[90px]">職種</TableHead>
                          <TableHead className="w-[100px] text-right">360度得点</TableHead>
                          <TableHead className="w-[100px] text-right">個別得点</TableHead>
                          <TableHead className="w-[70px] text-center">割合</TableHead>
                          <TableHead className="w-[80px] text-right font-bold">合計点</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              {r.employee.lastName} {r.employee.firstName}
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.employee.grade?.name ?? "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.employee.jobType?.name ?? "-"}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {r.score360Raw !== null
                                ? `${r.score360Raw}/${r.score360Max}`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {r.scoreIndividualRaw !== null
                                ? `${r.scoreIndividualRaw}/${r.scoreIndividualMax}`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {r.ratio360 ?? 0}:{r.ratioIndividual ?? 0}
                            </TableCell>
                            <TableCell className="text-right font-bold text-sky-600">
                              {r.combinedScore.toFixed(1)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ② ランク決定 */}
          <Collapsible open={step2Open} onOpenChange={setStep2Open}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-sky-500 text-white text-xs font-bold">
                        2
                      </span>
                      <CardTitle className="text-base">ランク決定</CardTitle>
                      {summary && (
                        <div className="flex items-center gap-1">
                          {(["S", "A", "B", "C", "D"] as const).map((rank) => (
                            <Badge
                              key={rank}
                              variant="outline"
                              className={cn("text-xs", RANK_COLORS[rank])}
                            >
                              {rank}:{summary.rankDistribution[rank]}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        step2Open && "rotate-180"
                      )}
                    />
                  </div>
                  <CardDescription>
                    合計点にランク閾値を適用してS/A/B/C/Dを決定
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">従業員名</TableHead>
                          <TableHead className="w-[80px] text-right">合計点</TableHead>
                          <TableHead className="w-[80px] text-center">今期ランク</TableHead>
                          {results.some((r) => r.previousPeriodRank) && (
                            <>
                              <TableHead className="w-[80px] text-center">前期ランク</TableHead>
                              <TableHead className="w-[80px] text-center">年間ランク</TableHead>
                            </>
                          )}
                          <TableHead>スコアバー</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              {r.employee.lastName} {r.employee.firstName}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {r.combinedScore.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={cn("font-bold", RANK_COLORS[r.periodRank])}
                              >
                                {r.periodRank}
                              </Badge>
                            </TableCell>
                            {results.some((r2) => r2.previousPeriodRank) && (
                              <>
                                <TableCell className="text-center">
                                  {r.previousPeriodRank ? (
                                    <Badge
                                      variant="outline"
                                      className={cn(RANK_COLORS[r.previousPeriodRank])}
                                    >
                                      {r.previousPeriodRank}
                                    </Badge>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className={cn("font-bold", RANK_COLORS[r.annualRank])}
                                  >
                                    {r.annualRank}
                                  </Badge>
                                </TableCell>
                              </>
                            )}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      r.combinedScore >= 95
                                        ? "bg-yellow-500"
                                        : r.combinedScore >= 85
                                          ? "bg-sky-500"
                                          : r.combinedScore >= 70
                                            ? "bg-green-500"
                                            : r.combinedScore >= 50
                                              ? "bg-orange-500"
                                              : "bg-red-500"
                                    )}
                                    style={{ width: `${Math.min(r.combinedScore, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ③ 号俸変動 */}
          <Collapsible open={step3Open} onOpenChange={setStep3Open}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-sky-500 text-white text-xs font-bold">
                        3
                      </span>
                      <CardTitle className="text-base">号俸変動</CardTitle>
                      {summary && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-emerald-600 flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3" />↑{summary.stepChanges.up}名
                          </span>
                          <span className="text-gray-500 flex items-center gap-0.5">
                            <Minus className="h-3 w-3" />→{summary.stepChanges.same}名
                          </span>
                          <span className="text-red-600 flex items-center gap-0.5">
                            <TrendingDown className="h-3 w-3" />↓{summary.stepChanges.down}名
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        step3Open && "rotate-180"
                      )}
                    />
                  </div>
                  <CardDescription>
                    等級別号俸改定基準を適用して号俸変動を算出
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">従業員名</TableHead>
                          <TableHead className="w-[60px]">等級</TableHead>
                          <TableHead className="w-[60px] text-center">ランク</TableHead>
                          <TableHead className="w-[70px] text-center">現号俸帯</TableHead>
                          <TableHead className="w-[60px] text-right">現号俸</TableHead>
                          <TableHead className="w-[60px] text-center">変動</TableHead>
                          <TableHead className="w-[60px] text-right">新号俸</TableHead>
                          <TableHead className="w-[180px] text-right">基本給変動</TableHead>
                          <TableHead className="w-[80px]">備考</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r) => {
                          const salaryDiff =
                            r.newBaseSalary !== null && r.previousBaseSalary !== null
                              ? r.newBaseSalary - r.previousBaseSalary
                              : null

                          return (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">
                                {r.employee.lastName} {r.employee.firstName}
                              </TableCell>
                              <TableCell className="text-sm">
                                {r.employee.grade?.name ?? "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant="outline"
                                  className={cn("text-xs", RANK_COLORS[r.annualRank])}
                                >
                                  {r.annualRank}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {r.previousRank ?? "-"}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {r.previousStep ?? "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                <span
                                  className={cn(
                                    "font-bold text-sm",
                                    r.stepAdjustment > 0
                                      ? "text-emerald-600"
                                      : r.stepAdjustment < 0
                                        ? "text-red-600"
                                        : "text-gray-500"
                                  )}
                                >
                                  {r.stepAdjustment > 0
                                    ? `+${r.stepAdjustment}`
                                    : r.stepAdjustment === 0
                                      ? "±0"
                                      : r.stepAdjustment}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {r.newStep ?? "-"}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                <span className="text-muted-foreground">
                                  {fmt(r.previousBaseSalary)}
                                </span>
                                <span className="mx-1">→</span>
                                <span className="font-medium">
                                  {fmt(r.newBaseSalary)}
                                </span>
                                {salaryDiff !== null && salaryDiff !== 0 && (
                                  <span
                                    className={cn(
                                      "ml-1 text-xs",
                                      salaryDiff > 0
                                        ? "text-emerald-600"
                                        : "text-red-600"
                                    )}
                                  >
                                    ({salaryDiff > 0 ? "+" : ""}
                                    {salaryDiff.toLocaleString()})
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {r.warnings.map((w, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-xs text-amber-600 border-amber-300"
                                  >
                                    ⚠ {w}
                                  </Badge>
                                ))}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 人件費影響サマリ */}
                  {summary && (
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">人件費影響</span>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div
                            className={cn(
                              "font-bold",
                              summary.monthlyCostImpact > 0
                                ? "text-emerald-600"
                                : summary.monthlyCostImpact < 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                            )}
                          >
                            {summary.monthlyCostImpact > 0 ? "+" : ""}
                            {summary.monthlyCostImpact.toLocaleString()}円
                          </div>
                          <div className="text-xs text-muted-foreground">月額</div>
                        </div>
                        <div className="text-center">
                          <div
                            className={cn(
                              "font-bold",
                              summary.annualCostImpact > 0
                                ? "text-emerald-600"
                                : summary.annualCostImpact < 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                            )}
                          >
                            {summary.annualCostImpact > 0 ? "+" : ""}
                            {summary.annualCostImpact.toLocaleString()}円
                          </div>
                          <div className="text-xs text-muted-foreground">年額</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ④ 最終確認 */}
          <Card className={isConfirmed ? "border-emerald-200 bg-emerald-50/50" : ""}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex items-center justify-center h-6 w-6 rounded-full text-white text-xs font-bold",
                    isConfirmed ? "bg-emerald-500" : "bg-sky-500"
                  )}
                >
                  {isConfirmed ? <CheckCircle2 className="h-4 w-4" /> : "4"}
                </span>
                <CardTitle className="text-base">最終確認</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isConfirmed ? (
                <div className="text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
                  <h3 className="text-lg font-bold text-emerald-800">
                    評価結果が確定されました
                  </h3>
                  <p className="text-sm text-emerald-600">
                    確定日時:{" "}
                    {finalizeData?.finalizedAt
                      ? new Date(finalizeData.finalizedAt).toLocaleString("ja-JP")
                      : "-"}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/companies/${companyId}/employees`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        従業員管理を確認
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/companies/${companyId}/salary-table`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        号俸テーブルを確認
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold">
                          {summary.totalEmployees}名
                        </div>
                        <div className="text-xs text-muted-foreground">
                          対象従業員
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold flex items-center justify-center gap-2">
                          <span className="text-emerald-600">↑{summary.stepChanges.up}</span>
                          <span className="text-gray-400">→{summary.stepChanges.same}</span>
                          <span className="text-red-600">↓{summary.stepChanges.down}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          号俸変動
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div
                          className={cn(
                            "text-xl font-bold",
                            summary.monthlyCostImpact > 0
                              ? "text-emerald-600"
                              : summary.monthlyCostImpact < 0
                                ? "text-red-600"
                                : ""
                          )}
                        >
                          {summary.monthlyCostImpact > 0 ? "+" : ""}
                          {summary.monthlyCostImpact.toLocaleString()}円
                        </div>
                        <div className="text-xs text-muted-foreground">
                          月額人件費影響
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold">
                          {summary.missingStepEmployees > 0
                            ? `${summary.missingStepEmployees}名`
                            : "0名"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          スキップ（号俸未設定）
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    <p className="font-medium mb-1">
                      ⚠ この操作を行うと以下が更新されます:
                    </p>
                    <ul className="list-disc ml-5 space-y-0.5">
                      <li>各従業員の号俸・ランク・基本給</li>
                      <li>従業員の給与履歴（EmployeeSalary に新レコード追加）</li>
                      <li>号俸テーブル上の従業員配置</li>
                      <li>評価期間のステータス →「完了」</li>
                    </ul>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button variant="outline" asChild>
                      <Link href={`/companies/${companyId}/operations/${periodId}`}>
                        ← 評価実行に戻る
                      </Link>
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setConfirmDialogOpen(true)}
                      disabled={confirmMutation.isPending}
                    >
                      {confirmMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      確定して反映する
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 確定確認ダイアログ */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={(open) => {
        if (!confirmMutation.isPending) setConfirmDialogOpen(open)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>評価結果を確定しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {summary
                ? `${summary.totalEmployees}名の従業員の号俸・基本給が更新されます。この操作は取り消せません。`
                : "従業員の号俸・基本給が更新されます。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmMutation.isPending}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmMutation.mutate()
              }}
              disabled={confirmMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {confirmMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {confirmMutation.isPending ? "確定中..." : "確定する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
