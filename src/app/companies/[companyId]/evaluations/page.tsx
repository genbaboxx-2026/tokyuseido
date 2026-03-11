"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserCircle, Percent, Users, CheckCircle } from "lucide-react"
import {
  Evaluation360TemplateSection,
  EvaluationTemplateMatrixSection,
  EmployeeEvaluationSection,
  CompanySettingsSection,
} from "@/components/evaluations"

type EvaluationTabType = "individual" | "settings" | "360"

interface Employee {
  id: string
  has360Evaluation?: boolean
  hasIndividualEvaluation?: boolean
}

interface EvaluationStatus {
  employeeId: string
  status: string
}

export default function EvaluationsPage() {
  const params = useParams()
  const companyId = params.companyId as string
  const [activeTab, setActiveTab] = useState<EvaluationTabType>("360")

  const loadedTabs = useRef<Set<EvaluationTabType>>(new Set(["360"]))

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["employees", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/employees?companyId=${companyId}&limit=100`)
      if (!res.ok) return []
      const data = await res.json()
      return data.employees || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: individualStatuses } = useQuery<EvaluationStatus[]>({
    queryKey: ["evaluationStatuses", companyId, "individual"],
    queryFn: async () => {
      const res = await fetch(`/api/employees/evaluation-statuses?companyId=${companyId}&type=individual`)
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 30 * 1000,
  })

  const { data: evaluation360Statuses } = useQuery<EvaluationStatus[]>({
    queryKey: ["evaluationStatuses", companyId, "360"],
    queryFn: async () => {
      const res = await fetch(`/api/employees/evaluation-statuses?companyId=${companyId}&type=360`)
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 30 * 1000,
  })

  const isIndividualAllCompleted = (() => {
    if (!employees || !individualStatuses) return false
    const targetEmployees = employees.filter(e => e.hasIndividualEvaluation)
    if (targetEmployees.length === 0) return false
    const statusMap = new Map(individualStatuses.map(s => [s.employeeId, s.status]))
    return targetEmployees.every(e => statusMap.get(e.id) === "COMPLETED")
  })()

  const is360AllCompleted = (() => {
    if (!employees || !evaluation360Statuses) return false
    const targetEmployees = employees.filter(e => e.has360Evaluation)
    if (targetEmployees.length === 0) return false
    const statusMap = new Map(evaluation360Statuses.map(s => [s.employeeId, s.status]))
    return targetEmployees.every(e => statusMap.get(e.id) === "COMPLETED")
  })()

  const handleTabChange = (value: string) => {
    const tab = value as EvaluationTabType
    loadedTabs.current.add(tab)
    setActiveTab(tab)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">評価制度</h1>
        <p className="text-muted-foreground">
          評価テンプレートの管理と従業員の評価を行います
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="360" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            360度評価
            {is360AllCompleted && (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            個別評価
            {isIndividualAllCompleted && (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            割合設定
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
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
