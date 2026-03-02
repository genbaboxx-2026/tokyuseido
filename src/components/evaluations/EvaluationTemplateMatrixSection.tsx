"use client"

import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Award,
  Edit,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { EvaluationTemplateDialog, type GradeRoleData } from "./EvaluationTemplateDialog"
import type { Employee } from "./EmployeeEvaluationSection"

// モーダルを遅延読み込み
const EmployeeEvaluationItemsDialog = dynamic(
  () => import("./EmployeeEvaluationItemsDialog").then((mod) => mod.EmployeeEvaluationItemsDialog),
  { ssr: false }
)

// 保存済みテンプレート型
interface SavedTemplateData {
  id: string
  gradeJobTypeConfig: { id: string }
  status?: string
  items: Array<{ name: string; maxScore?: number }>
}

interface EvaluationTemplateMatrixSectionProps {
  companyId: string
}

export function EvaluationTemplateMatrixSection({ companyId }: EvaluationTemplateMatrixSectionProps) {
  const queryClient = useQueryClient()
  const [selectedCell, setSelectedCell] = useState<GradeRoleData | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false)
  const [isTemplateOpen, setIsTemplateOpen] = useState(false)

  // 役割責任データ取得
  const { data: rolesData, isLoading, refetch } = useQuery<GradeRoleData[]>({
    queryKey: ["gradeRoles", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/grades/roles?companyId=${companyId}`)
      if (!res.ok) {
        if (res.status === 404) return []
        throw new Error("役割責任の取得に失敗しました")
      }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  // 保存済みテンプレート取得
  const { data: templatesData, refetch: refetchTemplates } = useQuery<SavedTemplateData[]>({
    queryKey: ["evaluationTemplates", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/evaluation-templates`)
      if (!res.ok) {
        if (res.status === 404) return []
        throw new Error("テンプレートの取得に失敗しました")
      }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  // テンプレートをconfigIdでマップ
  const templatesMap = useMemo(() => {
    const map = new Map<string, SavedTemplateData>()
    templatesData?.forEach((t) => {
      map.set(t.gradeJobTypeConfig.id, t)
    })
    return map
  }, [templatesData])

  // 等級と職種の一覧を抽出
  const { grades, jobTypes, roleMatrix } = useMemo(() => {
    if (!rolesData || rolesData.length === 0) {
      return { grades: [], jobTypes: [], roleMatrix: new Map() }
    }

    const gradesMap = new Map<string, { id: string; name: string; level: number }>()
    const jobTypesMap = new Map<string, { id: string; name: string; categoryName: string }>()
    const matrix = new Map<string, GradeRoleData>()

    rolesData.forEach((data) => {
      const grade = data.config.grade
      const jobType = data.config.jobType

      if (!gradesMap.has(grade.id)) {
        gradesMap.set(grade.id, { id: grade.id, name: grade.name, level: grade.level })
      }
      if (!jobTypesMap.has(jobType.id)) {
        jobTypesMap.set(jobType.id, {
          id: jobType.id,
          name: jobType.name,
          categoryName: jobType.jobCategory.name,
        })
      }

      const key = `${grade.id}-${jobType.id}`
      matrix.set(key, data)
    })

    const sortedGrades = Array.from(gradesMap.values()).sort((a, b) => b.level - a.level)
    const sortedJobTypes = Array.from(jobTypesMap.values()).sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName) || a.name.localeCompare(b.name)
    )

    return { grades: sortedGrades, jobTypes: sortedJobTypes, roleMatrix: matrix }
  }, [rolesData])

  const handleCellClick = (data: GradeRoleData) => {
    setSelectedCell(data)
    setIsDialogOpen(true)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            評価テンプレート（役割責任ベース）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            読み込み中...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (grades.length === 0 || jobTypes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            評価テンプレート（役割責任ベース）
          </CardTitle>
          <CardDescription>
            役割責任から評価項目を自動生成します。セルをクリックして編集してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>役割責任が設定されていません</p>
            <p className="text-sm mt-1">
              等級制度の役割責任マトリクスで設定してください
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Collapsible open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    評価テンプレート（役割責任ベース）
                  </CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isTemplateOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold bg-muted/50 sticky left-0 z-10 min-w-[80px]">
                        等級
                      </th>
                      {jobTypes.map((jobType) => (
                        <th
                          key={jobType.id}
                          className="text-center p-3 font-semibold bg-muted/50 min-w-[200px]"
                        >
                          <div className="text-xs text-muted-foreground">{jobType.categoryName}</div>
                          <div>{jobType.name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((grade) => (
                      <tr key={grade.id} className="border-b">
                        <td className="p-3 font-medium bg-muted/30 sticky left-0 z-10">
                          {grade.name}
                        </td>
                        {jobTypes.map((jobType) => {
                          const key = `${grade.id}-${jobType.id}`
                          const data = roleMatrix.get(key)

                          if (!data) {
                            return (
                              <td key={jobType.id} className="p-3 text-center text-muted-foreground">
                                -
                              </td>
                            )
                          }

                          const savedTemplate = templatesMap.get(data.config.id)
                          const savedItems = savedTemplate?.items || []
                          const responsibilities = data.role?.responsibilities || []
                          const employeeCount = data.employees.length
                          const templateStatus = savedTemplate?.status

                          const displayItems = savedItems.length > 0 ? savedItems.map(i => i.name) : responsibilities
                          const hasItems = displayItems.length > 0
                          const hasSavedTemplate = savedItems.length > 0

                          const itemCount = savedItems.length
                          const totalMaxScore = savedItems.reduce((sum, item) => sum + (item.maxScore ?? 5), 0)

                          return (
                            <td key={jobType.id} className="p-3 align-top border-l">
                              <button
                                type="button"
                                onClick={() => handleCellClick(data)}
                                className="w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground border-b pb-1">
                                    <span>該当者: {employeeCount}名</span>
                                    {hasSavedTemplate && (
                                      templateStatus === "confirmed" ? (
                                        <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px] px-1.5 py-0">
                                          <CheckCircle className="h-3 w-3 mr-0.5" />
                                          確定
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] px-1.5 py-0">
                                          下書き
                                        </Badge>
                                      )
                                    )}
                                    <Edit className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                  {hasSavedTemplate ? (
                                    <>
                                      <div className="text-xs font-medium text-primary">
                                        {itemCount}項目 / {totalMaxScore}点満点
                                      </div>
                                      <ol className="list-decimal list-inside space-y-1 text-sm">
                                        {displayItems.slice(0, 2).map((item: string, idx: number) => (
                                          <li key={idx} className="text-gray-700 dark:text-gray-300 truncate">
                                            {item}
                                          </li>
                                        ))}
                                        {displayItems.length > 2 && (
                                          <li className="text-muted-foreground">
                                            他 {displayItems.length - 2} 件...
                                          </li>
                                        )}
                                      </ol>
                                    </>
                                  ) : hasItems ? (
                                    <ol className="list-decimal list-inside space-y-1 text-sm">
                                      {displayItems.slice(0, 3).map((item: string, idx: number) => (
                                        <li key={idx} className="text-gray-700 dark:text-gray-300 truncate">
                                          {item}
                                        </li>
                                      ))}
                                      {displayItems.length > 3 && (
                                        <li className="text-muted-foreground">
                                          他 {displayItems.length - 3} 件...
                                        </li>
                                      )}
                                    </ol>
                                  ) : (
                                    <p className="text-muted-foreground text-sm">未設定</p>
                                  )}
                                </div>
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <EvaluationTemplateDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        data={selectedCell}
        companyId={companyId}
        onSaved={() => {
          refetch()
          refetchTemplates()
        }}
        onEmployeeClick={(emp) => {
          const employee: Employee = {
            id: emp.id,
            employeeCode: "",
            firstName: emp.firstName,
            lastName: emp.lastName,
            grade: selectedCell?.config.grade ? {
              id: selectedCell.config.grade.id,
              name: selectedCell.config.grade.name,
            } : null,
            jobType: selectedCell?.config.jobType ? {
              id: selectedCell.config.jobType.id,
              name: selectedCell.config.jobType.name,
            } : null,
            gradeId: selectedCell?.config.gradeId,
            jobTypeId: selectedCell?.config.jobTypeId,
          }
          setSelectedEmployee(employee)
          setIsEmployeeDialogOpen(true)
        }}
      />

      <EmployeeEvaluationItemsDialog
        open={isEmployeeDialogOpen}
        onOpenChange={setIsEmployeeDialogOpen}
        employee={selectedEmployee}
        rolesData={rolesData}
        companyId={companyId}
      />
    </>
  )
}
