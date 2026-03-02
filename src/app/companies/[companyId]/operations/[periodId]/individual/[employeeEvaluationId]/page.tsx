"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  User,
  Save,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { type EvalStatus } from "@/components/operations/StatusIndicator"
import {
  type EvaluationDetail,
  type ScoreData,
  individualStatusConfig,
  ratingConfig,
  getNextStatus,
  getPrevStatus,
} from "@/components/operations/individual/IndividualEvaluationTypes"
import { IndividualPhasesStepper } from "@/components/operations/individual/IndividualPhasesStepper"
import { EvaluationItemsForm } from "@/components/operations/individual/EvaluationItemsForm"

export default function IndividualEvaluationWorkflowPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()

  const companyId = params.companyId as string
  const periodId = params.periodId as string
  const evaluationId = params.employeeEvaluationId as string

  // ローカルの状態管理
  const [scores, setScores] = useState<Record<string, ScoreData>>({})
  const [selfComment, setSelfComment] = useState("")
  const [evaluatorComment, setEvaluatorComment] = useState("")
  const [finalRating, setFinalRating] = useState<"S" | "A" | "B" | "C" | "D" | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // 評価詳細を取得
  const { data: evaluation, isLoading, error } = useQuery<EvaluationDetail>({
    queryKey: ["employeeEvaluation", evaluationId],
    queryFn: async () => {
      const res = await fetch(`/api/employee-evaluations/${evaluationId}`)
      if (!res.ok) throw new Error("評価の取得に失敗しました")
      return res.json()
    },
  })

  // 初期値を設定
  if (evaluation && !isInitialized) {
    const initialScores: Record<string, ScoreData> = {}
    evaluation.items.forEach((item) => {
      initialScores[item.id] = {
        selfScore: item.selfScore,
        evaluatorScore: item.evaluatorScore,
        comment: item.comment || "",
      }
    })
    setScores(initialScores)
    setSelfComment(evaluation.selfComment || "")
    setEvaluatorComment(evaluation.evaluatorComment || "")
    setFinalRating(evaluation.finalRating)
    setIsInitialized(true)
  }

  // ステータス更新mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: EvalStatus) => {
      const res = await fetch(`/api/employee-evaluations/${evaluationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("ステータスの更新に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeEvaluation", evaluationId] })
      queryClient.invalidateQueries({ queryKey: ["evaluationPeriod", periodId] })
    },
  })

  // 評価保存mutation
  const saveEvaluationMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(scores).map(([templateItemId, score]) => ({
        templateItemId,
        selfScore: score.selfScore,
        evaluatorScore: score.evaluatorScore,
        comment: score.comment || null,
      }))

      const res = await fetch(`/api/employee-evaluations/${evaluationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          evaluatorComment: evaluatorComment || null,
          selfComment: selfComment || null,
          finalRating,
        }),
      })
      if (!res.ok) throw new Error("保存に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeEvaluation", evaluationId] })
    },
  })

  // スコア変更ハンドラ
  const handleScoreChange = (itemId: string, field: "selfScore" | "evaluatorScore", value: number | null) => {
    setScores((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !evaluation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">評価の取得に失敗しました</p>
        <Button variant="outline" onClick={() => router.back()}>
          戻る
        </Button>
      </div>
    )
  }

  const currentConfig = individualStatusConfig[evaluation.status]
  const StatusIcon = currentConfig.icon
  const nextStatus = getNextStatus(evaluation.status)
  const prevStatus = getPrevStatus(evaluation.status)

  // 自己評価の進捗を計算
  const selfScoreCount = Object.values(scores).filter((s) => s.selfScore !== null).length
  const evaluatorScoreCount = Object.values(scores).filter((s) => s.evaluatorScore !== null).length
  const totalItems = evaluation.items.length

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
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold">
              {evaluation.employee.lastName} {evaluation.employee.firstName}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            {evaluation.employee.department && (
              <span>{evaluation.employee.department.name}</span>
            )}
            {evaluation.employee.grade && (
              <>
                <span>·</span>
                <span>{evaluation.employee.grade.name}</span>
              </>
            )}
            {evaluation.employee.jobType && (
              <>
                <span>·</span>
                <span>{evaluation.employee.jobType.name}</span>
              </>
            )}
          </div>
        </div>
        <Badge className={`${currentConfig.bgColor} ${currentConfig.color}`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {currentConfig.label}
        </Badge>
      </div>

      {/* フェーズステッパー */}
      <Card>
        <CardContent className="pt-6">
          <IndividualPhasesStepper currentStatus={evaluation.status} />
        </CardContent>
      </Card>

      {/* 現在のフェーズ説明 */}
      <Card className={`border-l-4 ${currentConfig.color.replace("text-", "border-")}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <StatusIcon className={`h-5 w-5 ${currentConfig.color}`} />
            {currentConfig.label}フェーズ
          </CardTitle>
          <CardDescription>{currentConfig.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* フェーズ別の進捗表示 */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">自己評価:</span>
              <Badge variant={selfScoreCount === totalItems ? "default" : "secondary"}>
                {selfScoreCount}/{totalItems}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">上司評価:</span>
              <Badge variant={evaluatorScoreCount === totalItems ? "default" : "secondary"}>
                {evaluatorScoreCount}/{totalItems}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* フェーズ別コンテンツ */}
      {/* STARTED/PREPARING: 準備フェーズ */}
      {(evaluation.status === "STARTED" || evaluation.status === "PREPARING") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">評価準備</CardTitle>
            <CardDescription>
              評価テンプレートを確認し、配布の準備を行います
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="font-medium text-blue-800">使用テンプレート</p>
              <p className="text-blue-600">{evaluation.templateName}</p>
              <p className="text-sm text-blue-600 mt-1">
                評価項目: {evaluation.items.length}項目
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">評価項目一覧（プレビュー）</h4>
              <EvaluationItemsForm
                items={evaluation.items}
                scores={scores}
                onScoreChange={handleScoreChange}
                mode="both"
                readOnly={true}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* DISTRIBUTED: 配布フェーズ - 自己評価入力 */}
      {evaluation.status === "DISTRIBUTED" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">自己評価入力</CardTitle>
            <CardDescription>
              従業員が自己評価を入力します。完了したら「回収」に進めてください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <EvaluationItemsForm
              items={evaluation.items}
              scores={scores}
              onScoreChange={handleScoreChange}
              mode="self"
            />
            <div className="space-y-2">
              <Label>自己評価コメント</Label>
              <Textarea
                rows={3}
                placeholder="自己評価のコメントを入力..."
                value={selfComment}
                onChange={(e) => setSelfComment(e.target.value)}
              />
            </div>
            <Button
              onClick={() => saveEvaluationMutation.mutate()}
              disabled={saveEvaluationMutation.isPending}
            >
              {saveEvaluationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  自己評価を保存
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* COLLECTED/AGGREGATING: 上司評価フェーズ */}
      {(evaluation.status === "COLLECTED" || evaluation.status === "AGGREGATING") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">上司評価入力</CardTitle>
            <CardDescription>
              自己評価を参照しながら、上司評価を入力してください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <EvaluationItemsForm
              items={evaluation.items}
              scores={scores}
              onScoreChange={handleScoreChange}
              mode="both"
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>自己評価コメント（参照）</Label>
                <div className="bg-gray-50 rounded-lg p-3 text-sm min-h-[80px]">
                  {selfComment || "（コメントなし）"}
                </div>
              </div>
              <div className="space-y-2">
                <Label>上司コメント</Label>
                <Textarea
                  rows={3}
                  placeholder="上司としてのコメントを入力..."
                  value={evaluatorComment}
                  onChange={(e) => setEvaluatorComment(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>最終評価レート</Label>
              <Select
                value={finalRating || undefined}
                onValueChange={(v) => setFinalRating(v as "S" | "A" | "B" | "C" | "D")}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="評価を選択..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ratingConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => saveEvaluationMutation.mutate()}
              disabled={saveEvaluationMutation.isPending}
            >
              {saveEvaluationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  評価を保存
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* COMPLETED: 完了フェーズ */}
      {evaluation.status === "COMPLETED" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">評価結果</CardTitle>
            <CardDescription>
              評価が完了しました。結果を確認できます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 結果サマリー */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">最終評価</p>
                {finalRating ? (
                  <Badge className={`${ratingConfig[finalRating].color} text-lg mt-1`}>
                    {finalRating}
                  </Badge>
                ) : (
                  <p className="text-lg font-bold mt-1">-</p>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">合計スコア</p>
                <p className="text-2xl font-bold mt-1">
                  {evaluation.totalScore?.toFixed(2) ?? "-"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">自己評価完了</p>
                <p className="text-2xl font-bold mt-1">{selfScoreCount}/{totalItems}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">上司評価完了</p>
                <p className="text-2xl font-bold mt-1">{evaluatorScoreCount}/{totalItems}</p>
              </div>
            </div>

            <EvaluationItemsForm
              items={evaluation.items}
              scores={scores}
              onScoreChange={handleScoreChange}
              mode="both"
              readOnly={true}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>自己評価コメント</Label>
                <div className="bg-gray-50 rounded-lg p-3 text-sm min-h-[80px]">
                  {selfComment || "（コメントなし）"}
                </div>
              </div>
              <div className="space-y-2">
                <Label>上司コメント</Label>
                <div className="bg-gray-50 rounded-lg p-3 text-sm min-h-[80px]">
                  {evaluatorComment || "（コメントなし）"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* アクションボタン */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {/* 戻るボタン */}
            {prevStatus && evaluation.status !== "COMPLETED" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {individualStatusConfig[prevStatus].label}に戻す
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ステータスを戻しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      ステータスを「{individualStatusConfig[prevStatus].label}」に戻します。
                      この操作は取り消せます。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => updateStatusMutation.mutate(prevStatus)}
                    >
                      戻す
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {!prevStatus && <div />}

            {/* 進むボタン */}
            {nextStatus && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={updateStatusMutation.isPending}
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <>
                        {individualStatusConfig[nextStatus].label}に進む
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>次のフェーズに進みますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      ステータスを「{individualStatusConfig[nextStatus].label}」に進めます。
                      {evaluation.status === "AGGREGATING" && (
                        <span className="block mt-2 text-amber-600 font-medium">
                          ※完了後は評価が確定されます。
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => updateStatusMutation.mutate(nextStatus)}
                    >
                      進む
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* 完了状態の場合 */}
            {evaluation.status === "COMPLETED" && (
              <Button variant="outline" asChild>
                <Link href={`/companies/${companyId}/operations/${periodId}`}>
                  一覧に戻る
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
