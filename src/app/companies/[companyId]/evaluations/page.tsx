"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserCircle, Percent, Users } from "lucide-react"
import {
  Evaluation360TemplateSection,
  EvaluationTemplateMatrixSection,
  EmployeeEvaluationSection,
  CompanySettingsSection,
} from "@/components/evaluations"

// 評価タブタイプ
type EvaluationTabType = "individual" | "settings" | "360"

export default function EvaluationsPage() {
  const params = useParams()
  const companyId = params.companyId as string
  const [activeTab, setActiveTab] = useState<EvaluationTabType>("360")

  // 一度表示したタブを記録（遅延ロード用）
  const loadedTabs = useRef<Set<EvaluationTabType>>(new Set(["360"]))

  const handleTabChange = (value: string) => {
    const tab = value as EvaluationTabType
    loadedTabs.current.add(tab)
    setActiveTab(tab)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">評価制度</h1>
        <p className="text-muted-foreground">
          評価テンプレートの管理と従業員の評価を行います
        </p>
      </div>

      {/* 3タブ構成 */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="360" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            360度評価
          </TabsTrigger>
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            個別評価
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            割合設定
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {/* 遅延ロード: タブを一度選択するまでコンポーネントをマウントしない */}
          {loadedTabs.current.has("360") && (
            <TabsContent value="360" forceMount className={`mt-0 space-y-6 ${activeTab !== "360" ? "hidden" : ""}`}>
              <Evaluation360TemplateSection companyId={companyId} />
              <EmployeeEvaluationSection
                companyId={companyId}
                evaluationType="360"
              />
            </TabsContent>
          )}

          {loadedTabs.current.has("individual") && (
            <TabsContent value="individual" forceMount className={`mt-0 space-y-6 ${activeTab !== "individual" ? "hidden" : ""}`}>
              <EvaluationTemplateMatrixSection companyId={companyId} />
              <EmployeeEvaluationSection
                companyId={companyId}
                evaluationType="individual"
              />
            </TabsContent>
          )}

          {loadedTabs.current.has("settings") && (
            <TabsContent value="settings" forceMount className={`mt-0 ${activeTab !== "settings" ? "hidden" : ""}`}>
              <CompanySettingsSection companyId={companyId} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  )
}
