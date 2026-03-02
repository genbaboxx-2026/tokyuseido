"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users,
  ArrowRight,
  PlayCircle,
  Clock,
  Play,
  CheckCircle2,
  ChevronRight,
  Loader2,
  TrendingUp,
  Gift,
} from "lucide-react"
import { EvaluationStartDialog } from "@/components/evaluations/EvaluationStartDialog"

// 6段階ステータス型
type EvalStatus = "STARTED" | "PREPARING" | "DISTRIBUTED" | "COLLECTED" | "AGGREGATING" | "COMPLETED"

interface EvaluationPeriod {
  id: string
  name: string
  periodType: "FIRST_HALF" | "SECOND_HALF"
  startDate: string
  endDate: string
  status: EvalStatus
  createdAt: string
  _count: {
    evaluations: number
    completed: number
  }
}

interface BonusSetting {
  id: string
  name: string
  paymentDate: string
}

interface EvaluationPeriodsResponse {
  periods: EvaluationPeriod[]
  salarySettings: {
    reflectionMonth: number | null
    reflectionDay: number | null
  }
  bonusSettings: BonusSetting[]
}

const statusConfig: Record<EvalStatus, { label: string; color: string; icon: typeof Clock }> = {
  STARTED: { label: "開始", color: "bg-red-100 text-red-800", icon: Clock },
  PREPARING: { label: "配布準備", color: "bg-red-100 text-red-800", icon: Clock },
  DISTRIBUTED: { label: "配布完了", color: "bg-yellow-100 text-yellow-800", icon: Play },
  COLLECTED: { label: "回収済み", color: "bg-yellow-100 text-yellow-800", icon: Play },
  AGGREGATING: { label: "集計", color: "bg-yellow-100 text-yellow-800", icon: Play },
  COMPLETED: { label: "完了", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
}

// うるう年判定
const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// 号俸反映日を計算（うるう年考慮）
const calculateSalaryReflectionDate = (month: number, day: number): string => {
  const now = new Date()
  let year = now.getFullYear()

  // 今日より前の日付なら来年
  const targetDate = new Date(year, month - 1, day)
  if (targetDate < now) {
    year++
  }

  // 2月28日設定でうるう年なら2月29日に
  let adjustedDay = day
  if (month === 2 && day === 28 && isLeapYear(year)) {
    adjustedDay = 29
  }

  return `${year}年${month}月${adjustedDay}日`
}

// 賞与支給日を計算（土日考慮、前倒し）
const calculateBonusPaymentDate = (paymentDate: string): string => {
  const date = new Date(paymentDate)
  const now = new Date()

  // 今年または来年の日付を計算
  let year = now.getFullYear()
  const month = date.getMonth()
  let day = date.getDate()

  // 2月28日でうるう年なら2月29日に
  if (month === 1 && day === 28 && isLeapYear(year)) {
    day = 29
  }

  let targetDate = new Date(year, month, day)

  // 今日より前なら来年
  if (targetDate < now) {
    year++
    // 来年がうるう年かチェック
    if (month === 1 && date.getDate() === 28 && isLeapYear(year)) {
      day = 29
    } else {
      day = date.getDate()
    }
    targetDate = new Date(year, month, day)
  }

  // 土日の場合は前の営業日に（金曜日に前倒し）
  const dayOfWeek = targetDate.getDay()
  if (dayOfWeek === 0) {
    // 日曜 → 金曜（-2日）
    targetDate.setDate(targetDate.getDate() - 2)
  } else if (dayOfWeek === 6) {
    // 土曜 → 金曜（-1日）
    targetDate.setDate(targetDate.getDate() - 1)
  }

  return `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
}

// 評価期間名から対象（号俸反映/賞与）を判定
const parseEvaluationTargets = (name: string, bonusSettings: BonusSetting[]) => {
  const targets: { type: "salary" | "bonus"; label: string; bonusId?: string }[] = []

  if (name.includes("号俸反映")) {
    targets.push({ type: "salary", label: "号俸反映" })
  }

  for (const bonus of bonusSettings) {
    if (name.includes(bonus.name)) {
      targets.push({ type: "bonus", label: bonus.name, bonusId: bonus.id })
    }
  }

  return targets
}

export default function OperationsPage() {
  const params = useParams()
  const companyId = params.companyId as string
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  // 評価期間一覧取得
  const { data, isLoading: isPeriodsLoading } = useQuery<EvaluationPeriodsResponse>({
    queryKey: ["evaluationPeriods", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/evaluation-periods`)
      if (!res.ok) return { periods: [], salarySettings: { reflectionMonth: null, reflectionDay: null }, bonusSettings: [] }
      return res.json()
    },
  })

  const evaluationPeriods = data?.periods || []
  const salarySettings = data?.salarySettings
  const bonusSettings = data?.bonusSettings || []

  // ダイアログが閉じた時に一覧を再取得
  const handleDialogChange = (open: boolean) => {
    setStartDialogOpen(open)
    if (!open) {
      queryClient.invalidateQueries({ queryKey: ["evaluationPeriods", companyId] })
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">運用ダッシュボード</h1>
        <p className="text-muted-foreground">
          評価・昇給の運用状況を確認できます
        </p>
      </div>

      {/* 評価管理 */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">評価管理</h2>
          <p className="text-sm text-muted-foreground">
            従業員の評価を管理・入力します
          </p>
        </div>

        {/* 評価を開始ボタン */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/20">
          <div>
            <p className="font-medium">評価を開始</p>
            <p className="text-sm text-muted-foreground">
              評価対象（号俸反映・賞与）と種別を選択して開始
            </p>
          </div>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setStartDialogOpen(true)}
          >
            <PlayCircle className="h-4 w-4 mr-1.5" />
            開始する
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>

        {/* 評価期間一覧 */}
        {isPeriodsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : evaluationPeriods && evaluationPeriods.length > 0 ? (
          <div className="space-y-2">
            {evaluationPeriods.map((period) => {
              // 全員完了かどうかを判定
              const allCompleted = period._count.evaluations > 0 &&
                period._count.completed === period._count.evaluations
              const displayStatus = allCompleted
                ? { label: "完了", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 }
                : { label: "未完了", color: "bg-amber-100 text-amber-800", icon: Clock }
              const StatusIcon = displayStatus.icon
              const targets = parseEvaluationTargets(period.name, bonusSettings)

              return (
                <Link
                  key={period.id}
                  href={`/companies/${companyId}/operations/${period.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{period.name}</span>
                    {/* 対象と日付の表示 */}
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {targets.map((target, idx) => {
                        if (target.type === "salary" && salarySettings?.reflectionMonth && salarySettings?.reflectionDay) {
                          const dateStr = calculateSalaryReflectionDate(
                            salarySettings.reflectionMonth,
                            salarySettings.reflectionDay
                          )
                          return (
                            <span key={idx} className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-blue-600" />
                              号俸反映日: {dateStr}
                            </span>
                          )
                        } else if (target.type === "bonus") {
                          const bonus = bonusSettings.find((b) => b.id === target.bonusId)
                          if (bonus) {
                            const dateStr = calculateBonusPaymentDate(bonus.paymentDate)
                            return (
                              <span key={idx} className="flex items-center gap-1">
                                <Gift className="h-3 w-3 text-amber-600" />
                                {target.label}支給日: {dateStr}
                              </span>
                            )
                          }
                        }
                        return null
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {period._count.evaluations}名
                    </Badge>
                    <Badge className={displayStatus.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {displayStatus.label}
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            まだ評価期間がありません。「開始する」ボタンから評価を開始してください。
          </div>
        )}
      </div>

      {/* 評価開始ダイアログ */}
      <EvaluationStartDialog
        open={startDialogOpen}
        onOpenChange={handleDialogChange}
        companyId={companyId}
      />
    </div>
  )
}
