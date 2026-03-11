"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Users,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"

interface EvaluatorTokenInfo {
  evaluatorId: string
  evaluatorName: string
  token: string | null
  maskedPassword: string | null
  rawPassword: string | null
  employeeCount: number
  collectionRate: {
    selfCompleted: number
    evaluatorCompleted: number
    total: number
  }
  url: string | null
  employees: Array<{
    id: string
    name: string
    selfCompleted: boolean
    evaluatorCompleted: boolean
  }>
}

interface EvaluatorCardsAccordionProps {
  companyId: string
  periodId: string
  onOpenPortal: (evaluatorId: string, token: string) => void
}

export function EvaluatorCardsAccordion({
  companyId,
  periodId,
  onOpenPortal,
}: EvaluatorCardsAccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ evaluators: EvaluatorTokenInfo[] }>({
    queryKey: ["evaluatorTokens", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/evaluator-tokens`
      )
      if (!res.ok) throw new Error("評価者トークンの取得に失敗しました")
      return res.json()
    },
  })

  const toggleItem = (evaluatorId: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(evaluatorId)) {
        next.delete(evaluatorId)
      } else {
        next.add(evaluatorId)
      }
      return next
    })
  }

  const handleCopy = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error("コピーに失敗しました:", err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const evaluators = data?.evaluators ?? []

  if (evaluators.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground bg-gray-50 rounded-lg">
        配布済みの評価がありません
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        評価者別ステータス
      </h3>
      {evaluators.map((evaluator) => {
        const isOpen = openItems.has(evaluator.evaluatorId)
        const selfProgress =
          evaluator.collectionRate.total > 0
            ? (evaluator.collectionRate.selfCompleted /
                evaluator.collectionRate.total) *
              100
            : 0
        const evaluatorProgress =
          evaluator.collectionRate.total > 0
            ? (evaluator.collectionRate.evaluatorCompleted /
                evaluator.collectionRate.total) *
              100
            : 0

        return (
          <Collapsible
            key={evaluator.evaluatorId}
            open={isOpen}
            onOpenChange={() => toggleItem(evaluator.evaluatorId)}
          >
            <div className="border rounded-lg overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="font-medium">{evaluator.evaluatorName}</span>
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      担当: {evaluator.employeeCount}名
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      回収: {evaluator.collectionRate.evaluatorCompleted}/
                      {evaluator.collectionRate.total}
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        evaluatorProgress === 100
                          ? "bg-green-100 text-green-700 border-green-300"
                          : evaluatorProgress > 0
                          ? "bg-amber-100 text-amber-700 border-amber-300"
                          : "bg-gray-100 text-gray-500"
                      }
                    >
                      {Math.round(evaluatorProgress)}%
                    </Badge>
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t bg-gray-50 p-4 space-y-4">
                  {/* 評価者専用ページを開くボタン */}
                  {evaluator.token && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() =>
                        onOpenPortal(evaluator.evaluatorId, evaluator.token!)
                      }
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      評価者専用ページを開く
                    </Button>
                  )}

                  {/* シェアURL */}
                  {evaluator.url && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        シェアURL
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white border rounded px-3 py-2 text-xs truncate">
                          {evaluator.url}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleCopy(evaluator.url!, `url-${evaluator.evaluatorId}`)
                          }
                        >
                          {copiedField === `url-${evaluator.evaluatorId}` ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* パスワード */}
                  {evaluator.rawPassword && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        パスワード
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="bg-white border rounded px-3 py-2 text-xs">
                          {evaluator.maskedPassword}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleCopy(
                              evaluator.rawPassword!,
                              `pwd-${evaluator.evaluatorId}`
                            )
                          }
                        >
                          {copiedField === `pwd-${evaluator.evaluatorId}` ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 回収率 */}
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      回収状況
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>自己評価</span>
                          <span>
                            {evaluator.collectionRate.selfCompleted}/
                            {evaluator.collectionRate.total}件
                          </span>
                        </div>
                        <Progress value={selfProgress} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>上司評価</span>
                          <span>
                            {evaluator.collectionRate.evaluatorCompleted}/
                            {evaluator.collectionRate.total}件
                          </span>
                        </div>
                        <Progress value={evaluatorProgress} className="h-2" />
                      </div>
                    </div>
                  </div>

                  {/* 担当従業員リスト */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      担当従業員
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {evaluator.employees.map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center justify-between bg-white border rounded px-3 py-2 text-sm"
                        >
                          <span>{emp.name}</span>
                          <div className="flex gap-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1 ${
                                emp.selfCompleted
                                  ? "bg-green-100 text-green-700 border-green-300"
                                  : "bg-red-100 text-red-700 border-red-300"
                              }`}
                            >
                              自己
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1 ${
                                emp.evaluatorCompleted
                                  ? "bg-green-100 text-green-700 border-green-300"
                                  : "bg-red-100 text-red-700 border-red-300"
                              }`}
                            >
                              上司
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )
      })}
    </div>
  )
}
