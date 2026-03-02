"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Gift,
  Loader2,
  PlayCircle,
  TrendingUp,
  Users,
} from "lucide-react"

type EvaluationType = "individual" | "360"
type EvaluationEventType = "salary_reflection" | "bonus"
type Step = 1 | 2

interface EvaluationEvent {
  id: string
  type: EvaluationEventType
  name: string
}

interface BonusSetting {
  id: string
  name: string
}

interface StartResult {
  evaluationPeriod: { id: string; name: string }
  summary: {
    totalEmployees: number
    createdEvaluations: number
    skippedEmployees: number
    skippedReasons: {
      noTemplate: number
      alreadyExists: number
    }
  }
}

interface EvaluationStartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
}

export function EvaluationStartDialog({
  open,
  onOpenChange,
  companyId,
}: EvaluationStartDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  // 各イベントごとの評価種別（複数選択可能）
  const [eventEvaluationTypes, setEventEvaluationTypes] = useState<Record<string, EvaluationType[]>>({})
  const [periodName, setPeriodName] = useState("")
  const [isStarting, setIsStarting] = useState(false)
  const [result, setResult] = useState<StartResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 賞与設定取得
  const { data: bonusData, isPending: isBonusLoading } = useQuery<{ bonusSettings: BonusSetting[] }>({
    queryKey: ["bonusSettings", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/bonus-settings`)
      if (!res.ok) return { bonusSettings: [] }
      return res.json()
    },
    enabled: open,
  })

  // 評価イベント一覧を構築
  const evaluationEvents: EvaluationEvent[] = []

  // 号俸反映イベント（常に追加）
  evaluationEvents.push({
    id: "salary_reflection",
    type: "salary_reflection",
    name: "号俸反映",
  })

  // 賞与イベント
  if (bonusData?.bonusSettings) {
    bonusData.bonusSettings.forEach((bonus) => {
      evaluationEvents.push({
        id: bonus.id,
        type: "bonus",
        name: bonus.name,
      })
    })
  }

  const resetForm = () => {
    setStep(1)
    setSelectedEventIds([])
    setEventEvaluationTypes({})
    setPeriodName("")
    setResult(null)
    setError(null)
  }

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds((prev) => {
      if (prev.includes(eventId)) {
        // イベント削除時、評価種別もクリア
        setEventEvaluationTypes((types) => {
          const newTypes = { ...types }
          delete newTypes[eventId]
          return newTypes
        })
        return prev.filter((id) => id !== eventId)
      }
      return [...prev, eventId]
    })
  }

  // 評価種別のトグル（各イベントごと）
  const toggleEvaluationType = (eventId: string, evalType: EvaluationType) => {
    setEventEvaluationTypes((prev) => {
      const current = prev[eventId] || []
      const newTypes = current.includes(evalType)
        ? current.filter((t) => t !== evalType)
        : [...current, evalType]
      return { ...prev, [eventId]: newTypes }
    })
  }

  const handleClose = () => {
    if (result) {
      // 作成した評価期間の詳細画面に遷移
      router.push(`/companies/${companyId}/operations/${result.evaluationPeriod.id}`)
    }
    onOpenChange(false)
    setTimeout(resetForm, 300)
  }

  // 評価期間名を自動生成
  const generatePeriodName = (events: EvaluationEvent[]) => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const halfYear = month <= 6 ? "上期" : "下期"
    const eventNames = events.map(e => e.name).join("・")
    return `${year}年度${halfYear} ${eventNames}`
  }

  // ステップ2に進む
  const goToStep2 = () => {
    const events = evaluationEvents.filter((e) => selectedEventIds.includes(e.id))
    setPeriodName(generatePeriodName(events))
    setStep(2)
  }

  // ステップ2のバリデーション: 全ての選択イベントに評価種別が設定されているか
  const isStep2Valid = () => {
    if (!periodName.trim()) return false
    return selectedEventIds.every((eventId) => {
      const types = eventEvaluationTypes[eventId]
      return types && types.length > 0
    })
  }

  const handleStart = async () => {
    setIsStarting(true)
    setError(null)

    try {
      const now = new Date()
      const month = now.getMonth() + 1

      const payload: Record<string, unknown> = {
        companyId,
        eventEvaluationTypes, // 各イベントごとの評価種別
        evaluationEventIds: selectedEventIds,
        periodName,
        periodType: month <= 6 ? "FIRST_HALF" : "SECOND_HALF",
        startDate: now.toISOString().split('T')[0],
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }

      const res = await fetch("/api/evaluations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        const detailMsg = data.details ? `: ${JSON.stringify(data.details)}` : ""
        console.error("API Error:", data)
        throw new Error((data.error || "評価の開始に失敗しました") + detailMsg)
      }

      const data: StartResult = await res.json()
      // 確認画面をスキップして直接詳細画面に遷移
      onOpenChange(false)
      router.push(`/companies/${companyId}/operations/${data.evaluationPeriod.id}`)
      setTimeout(resetForm, 300)
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsStarting(false)
    }
  }

  const selectedEvents = evaluationEvents.filter((e) => selectedEventIds.includes(e.id))

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) handleClose()
      else onOpenChange(newOpen)
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-emerald-600" />
            評価を開始
            {!result && (
              <Badge variant="outline" className="ml-2">
                ステップ {step}/2
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "評価対象を選択してください"
              : "評価種別を選択してください"}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-emerald-900 dark:text-emerald-100">
                  評価を開始しました
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  {result.evaluationPeriod.name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border text-center">
                <p className="text-2xl font-bold">{result.summary.createdEvaluations}</p>
                <p className="text-xs text-muted-foreground">評価作成数</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <p className="text-2xl font-bold">{result.summary.totalEmployees}</p>
                <p className="text-xs text-muted-foreground">対象従業員数</p>
              </div>
            </div>

            {result.summary.skippedEmployees > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {result.summary.skippedEmployees}名がスキップされました
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-300 mt-1 space-y-0.5 ml-5">
                  {result.summary.skippedReasons.noTemplate > 0 && (
                    <li>テンプレート未設定: {result.summary.skippedReasons.noTemplate}名</li>
                  )}
                  {result.summary.skippedReasons.alreadyExists > 0 && (
                    <li>既に評価が存在: {result.summary.skippedReasons.alreadyExists}名</li>
                  )}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>
                評価画面へ移動
              </Button>
            </DialogFooter>
          </div>
        ) : step === 1 ? (
          /* ステップ1: 評価対象選択 */
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">評価対象を選択</Label>
              {isBonusLoading ? (
                <div className="flex items-center justify-center gap-2 p-8 rounded-lg border border-dashed">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">評価対象を読み込み中...</span>
                </div>
              ) : (
                <div className="grid gap-2">
                  {evaluationEvents.map((event) => {
                    const isChecked = selectedEventIds.includes(event.id)
                    return (
                      <div
                        key={event.id}
                        onClick={() => toggleEventSelection(event.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        {event.type === "salary_reflection" ? (
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Gift className="h-5 w-5 text-amber-600" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{event.name}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>
                キャンセル
              </Button>
              <Button
                onClick={goToStep2}
                disabled={selectedEventIds.length === 0 || isBonusLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                次へ
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* ステップ2: 評価種別選択 */
          <div className="space-y-4 py-2">
            {/* 評価期間名（一番上） */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">評価期間名</Label>
              <Input
                value={periodName}
                onChange={(e) => setPeriodName(e.target.value)}
                placeholder="例: 2026年度上期 号俸反映"
              />
            </div>

            {/* 各評価対象ごとの評価種別選択 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">評価種別を選択</Label>
              {selectedEvents.map((event) => {
                const selectedTypes = eventEvaluationTypes[event.id] || []
                return (
                  <div key={event.id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center gap-2">
                      {event.type === "salary_reflection" ? (
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Gift className="h-4 w-4 text-amber-600" />
                      )}
                      <span className="font-medium text-sm">{event.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <div
                        onClick={() => toggleEvaluationType(event.id, "individual")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors flex-1 ${
                          selectedTypes.includes("individual")
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes("individual")}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">個別評価</span>
                      </div>
                      <div
                        onClick={() => toggleEvaluationType(event.id, "360")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors flex-1 ${
                          selectedTypes.includes("360")
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes("360")}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">360度評価</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isStarting}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                戻る
              </Button>
              <Button
                onClick={handleStart}
                disabled={isStarting || !isStep2Valid()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    開始中...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-1" />
                    評価を開始
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
