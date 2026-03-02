"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ClipboardCheck, Loader2, AlertCircle } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { WorkflowStepTabs } from "../WorkflowStepTabs"
import { IndividualPreparingTab } from "./IndividualPreparingTab"
import { IndividualDistributingTab } from "./IndividualDistributingTab"
import { IndividualCollectedTab } from "./IndividualCollectedTab"
import { IndividualAggregatedTab } from "./IndividualAggregatedTab"
import { IndividualCompletedTab } from "./IndividualCompletedTab"

interface IndividualEvaluationSectionProps {
  companyId: string
  periodId: string
}

interface PhaseCounts {
  preparing: number
  distributing: number
  collected: number
  aggregated: number
  completed: number
}

export function IndividualEvaluationSection({
  companyId,
  periodId,
}: IndividualEvaluationSectionProps) {
  const [activeTab, setActiveTab] = useState("preparing")
  const queryClient = useQueryClient()

  // フェーズカウントを取得
  const { data: phaseCounts, isLoading: isLoadingCounts } = useQuery<PhaseCounts>({
    queryKey: ["individualPhaseCounts", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/phase-counts`
      )
      if (!res.ok) throw new Error("フェーズカウントの取得に失敗しました")
      return res.json()
    },
  })

  const totalCount = phaseCounts
    ? phaseCounts.preparing +
      phaseCounts.distributing +
      phaseCounts.collected +
      phaseCounts.aggregated +
      phaseCounts.completed
    : 0

  const completedCount = phaseCounts?.completed ?? 0

  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  const refreshPhaseCounts = () => {
    queryClient.invalidateQueries({
      queryKey: ["individualPhaseCounts", companyId, periodId],
    })
  }

  if (isLoadingCounts) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">個別評価</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">個別評価</CardTitle>
          </div>
          <CardDescription>上司による従業員評価</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>評価対象者がいません</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">個別評価</CardTitle>
            <Badge
              variant="outline"
              className={
                completedCount === totalCount
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-gray-100 text-gray-600"
              }
            >
              完了: {completedCount}/{totalCount}
            </Badge>
          </div>
        </div>
        <CardDescription>上司による従業員評価</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <WorkflowStepTabs
            steps={[
              { value: "preparing", label: "準備", count: phaseCounts?.preparing ?? 0 },
              { value: "distributing", label: "配布", count: phaseCounts?.distributing ?? 0 },
              { value: "collected", label: "回収", count: phaseCounts?.collected ?? 0 },
              { value: "aggregated", label: "集計", count: phaseCounts?.aggregated ?? 0 },
              { value: "completed", label: "完了", count: phaseCounts?.completed ?? 0 },
            ]}
            activeStep={activeTab}
            onStepChange={handleTabChange}
          />

          <TabsContent value="preparing" className="mt-4">
            <IndividualPreparingTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="distributing" className="mt-4">
            <IndividualDistributingTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="collected" className="mt-4">
            <IndividualCollectedTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="aggregated" className="mt-4">
            <IndividualAggregatedTab
              companyId={companyId}
              periodId={periodId}
              onStatusChange={refreshPhaseCounts}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <IndividualCompletedTab
              companyId={companyId}
              periodId={periodId}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
