"use client"

import React, { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  CheckCircle,
  Pencil,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Award,
  Sparkles,
  Plus,
  Trash2,
  UserCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { PeriodEvaluationTemplateData, PeriodEvaluationTemplateItemData } from "@/types/evaluation-template"

interface IndividualTemplatePanelProps {
  companyId: string
  periodId: string
  onApplySuccess?: () => void
}

interface MasterTemplate {
  id: string
  name: string
  status: string
  gradeJobTypeConfig: {
    id: string
    grade: { id: string; name: string }
    jobType: { id: string; name: string }
  }
  items: Array<{
    id: string
    name: string
    description: string | null
    category: string
    maxScore: number
    weight: number
    sortOrder: number
  }>
}

interface GradeRoleData {
  config: {
    id: string
    grade: { id: string; name: string; level: number }
    jobType: { id: string; name: string; jobCategory: { name: string } }
    gradeId: string
    jobTypeId: string
  }
  role: { responsibilities: string[] } | null
  employees: { id: string; firstName: string; lastName: string }[]
}

interface TemplateItem {
  name: string
  maxScore: number
}

interface GradeTemplateState {
  gradeId: string
  gradeName: string
  gradeLevel: number
  configId: string
  items: TemplateItem[]
  employees: { id: string; firstName: string; lastName: string }[]
  isExpanded: boolean
  isSaving: boolean
  periodTemplateId: string | null
}

export function IndividualTemplatePanel({
  companyId,
  periodId,
  onApplySuccess,
}: IndividualTemplatePanelProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string | null>(null)
  const [gradeStates, setGradeStates] = useState<GradeTemplateState[]>([])
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null)

  // 役割責任データ取得（マトリクス構築用）
  const { data: rolesData, isLoading: loadingRoles } = useQuery<GradeRoleData[]>({
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

  // 期間固有テンプレート一覧を取得
  const { data: periodTemplatesData, isLoading: loadingPeriodTemplates } = useQuery<{
    templates: PeriodEvaluationTemplateData[]
  }>({
    queryKey: ["periodTemplates", companyId, periodId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual-templates`
      )
      if (!res.ok) throw new Error("テンプレートの取得に失敗しました")
      return res.json()
    },
    staleTime: 30000,
  })

  // マスターテンプレート一覧を取得
  const { data: masterTemplates } = useQuery<MasterTemplate[]>({
    queryKey: ["evaluationTemplates", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/evaluation-templates`)
      if (!res.ok) throw new Error("マスターテンプレートの取得に失敗しました")
      return res.json()
    },
    staleTime: 60000,
  })

  // マトリクス構築
  const { grades, jobTypes, roleMatrix } = useMemo(() => {
    if (!rolesData || rolesData.length === 0) {
      return { grades: [], jobTypes: [], roleMatrix: new Map<string, GradeRoleData>() }
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

      matrix.set(`${grade.id}-${jobType.id}`, data)
    })

    const sortedGrades = Array.from(gradesMap.values()).sort((a, b) => b.level - a.level)
    const sortedJobTypes = Array.from(jobTypesMap.values()).sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName) || a.name.localeCompare(b.name)
    )

    return { grades: sortedGrades, jobTypes: sortedJobTypes, roleMatrix: matrix }
  }, [rolesData])

  // マスターテンプレートをconfigIdでマップ
  const masterTemplatesMap = useMemo(() => {
    const map = new Map<string, MasterTemplate>()
    masterTemplates?.forEach((t) => {
      map.set(t.gradeJobTypeConfig.id, t)
    })
    return map
  }, [masterTemplates])

  // 期間固有テンプレートをgrade+jobTypeでマップ
  const periodTemplatesMap = useMemo(() => {
    const map = new Map<string, PeriodEvaluationTemplateData>()
    periodTemplatesData?.templates?.forEach((t) => {
      if (t.gradeId && t.jobTypeId) {
        map.set(`${t.gradeId}-${t.jobTypeId}`, t)
      }
    })
    return map
  }, [periodTemplatesData?.templates])

  // ダイアログを開いたときに該当職種の全等級テンプレートを構築
  const loadGradeStatesForJobType = useCallback((jobTypeId: string) => {
    if (!rolesData) return

    const rolesForJobType = rolesData
      .filter((r) => r.config.jobType.id === jobTypeId)
      .sort((a, b) => b.config.grade.level - a.config.grade.level)

    const states: GradeTemplateState[] = rolesForJobType.map((role) => {
      const matrixKey = `${role.config.grade.id}-${jobTypeId}`
      const periodTemplate = periodTemplatesMap.get(matrixKey)
      const masterTemplate = masterTemplatesMap.get(role.config.id)

      let items: TemplateItem[]
      if (periodTemplate?.items && periodTemplate.items.length > 0) {
        items = periodTemplate.items.map((item) => ({
          name: item.name,
          maxScore: item.maxScore ?? 5,
        }))
      } else if (masterTemplate?.items && masterTemplate.items.length > 0) {
        items = masterTemplate.items.map((item: { name: string; maxScore?: number }) => ({
          name: item.name,
          maxScore: item.maxScore ?? 5,
        }))
      } else {
        const responsibilities = role.role?.responsibilities || []
        if (responsibilities.length > 0) {
          items = responsibilities.map((r) => ({
            name: convertToEvaluationItem(r),
            maxScore: 5,
          }))
        } else {
          items = [{ name: "", maxScore: 5 }]
        }
      }

      return {
        gradeId: role.config.grade.id,
        gradeName: role.config.grade.name,
        gradeLevel: role.config.grade.level,
        configId: role.config.id,
        items,
        employees: role.employees,
        isExpanded: true,
        isSaving: false,
        periodTemplateId: periodTemplate?.id || null,
      }
    })

    setGradeStates(states)
  }, [rolesData, periodTemplatesMap, masterTemplatesMap])

  // セルクリック → 職種の全等級ダイアログを開く
  const handleCellClick = (_configId: string, _gradeId: string, jobTypeId: string) => {
    setSelectedJobTypeId(jobTypeId)
    loadGradeStatesForJobType(jobTypeId)
  }

  const handleCloseDialog = () => {
    setSelectedJobTypeId(null)
    setGradeStates([])
  }

  // 等級セクション展開トグル
  const toggleExpand = (gradeId: string) => {
    setGradeStates((prev) =>
      prev.map((s) => (s.gradeId === gradeId ? { ...s, isExpanded: !s.isExpanded } : s))
    )
  }

  // 項目名編集
  const handleEditItemName = (gradeId: string, index: number, value: string) => {
    setGradeStates((prev) =>
      prev.map((s) => {
        if (s.gradeId !== gradeId) return s
        const newItems = [...s.items]
        newItems[index] = { ...newItems[index], name: value }
        return { ...s, items: newItems }
      })
    )
  }

  // 項目満点編集
  const handleEditItemMaxScore = (gradeId: string, index: number, value: number) => {
    setGradeStates((prev) =>
      prev.map((s) => {
        if (s.gradeId !== gradeId) return s
        const newItems = [...s.items]
        newItems[index] = { ...newItems[index], maxScore: value }
        return { ...s, items: newItems }
      })
    )
  }

  // 項目追加
  const handleAddItem = (gradeId: string) => {
    setGradeStates((prev) =>
      prev.map((s) => {
        if (s.gradeId !== gradeId) return s
        return { ...s, items: [...s.items, { name: "", maxScore: 5 }] }
      })
    )
  }

  // 項目削除
  const handleRemoveItem = (gradeId: string, index: number) => {
    setGradeStates((prev) =>
      prev.map((s) => {
        if (s.gradeId !== gradeId) return s
        if (s.items.length <= 1) return s
        return { ...s, items: s.items.filter((_, i) => i !== index) }
      })
    )
  }

  // 等級ごとに保存（期間固有テンプレートとして）
  const handleSaveGradeTemplate = async (gradeId: string, status: "draft" | "confirmed") => {
    const state = gradeStates.find((s) => s.gradeId === gradeId)
    if (!state || !selectedJobTypeId) return

    const validItems = state.items.filter((item) => item.name.trim() !== "")
    if (validItems.length === 0) {
      alert("評価項目を1つ以上入力してください")
      return
    }

    setGradeStates((prev) =>
      prev.map((s) => (s.gradeId === gradeId ? { ...s, isSaving: true } : s))
    )

    try {
      const jobType = jobTypes.find((jt) => jt.id === selectedJobTypeId)
      const templateName = `${state.gradeName} × ${jobType?.name || ""} 評価テンプレート`

      if (state.periodTemplateId) {
        const res = await fetch(
          `/api/companies/${companyId}/operations/${periodId}/individual-templates/${state.periodTemplateId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: templateName,
              status,
              items: validItems.map((item, index) => ({
                name: item.name,
                maxScore: item.maxScore,
                category: "一般",
                weight: 1.0,
                sortOrder: index,
              })),
            }),
          }
        )
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "更新に失敗しました")
        }
      } else {
        const masterTemplate = masterTemplatesMap.get(state.configId)
        if (masterTemplate) {
          const copyRes = await fetch(
            `/api/companies/${companyId}/operations/${periodId}/individual-templates`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sourceTemplateId: masterTemplate.id }),
            }
          )
          if (!copyRes.ok) {
            const data = await copyRes.json()
            throw new Error(data.error || "コピーに失敗しました")
          }
          const copyData = await copyRes.json()
          const newTemplateId = copyData.template?.id

          if (newTemplateId) {
            const updateRes = await fetch(
              `/api/companies/${companyId}/operations/${periodId}/individual-templates/${newTemplateId}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: templateName,
                  status,
                  items: validItems.map((item, index) => ({
                    name: item.name,
                    maxScore: item.maxScore,
                    category: "一般",
                    weight: 1.0,
                    sortOrder: index,
                  })),
                }),
              }
            )
            if (!updateRes.ok) {
              const data = await updateRes.json()
              throw new Error(data.error || "更新に失敗しました")
            }

            setGradeStates((prev) =>
              prev.map((s) =>
                s.gradeId === gradeId ? { ...s, periodTemplateId: newTemplateId } : s
              )
            )
          }
        } else {
          alert("マスターテンプレートが見つかりません。先に評価制度設定でテンプレートを作成してください。")
          return
        }
      }

      queryClient.invalidateQueries({
        queryKey: ["periodTemplates", companyId, periodId],
      })
    } catch (error) {
      console.error("テンプレート保存エラー:", error)
      alert(error instanceof Error ? error.message : "保存に失敗しました")
    } finally {
      setGradeStates((prev) =>
        prev.map((s) => (s.gradeId === gradeId ? { ...s, isSaving: false } : s))
      )
    }
  }

  // 反映ボタン
  const handleApplyTemplate = (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation()
    setApplyingTemplateId(templateId)
    applyTemplateMutation.mutate(templateId)
  }

  // テンプレート反映
  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual-templates/${templateId}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overwrite: false }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "反映に失敗しました")
      }
      return res.json()
    },
    onSuccess: (data) => {
      setApplyingTemplateId(null)
      alert(data.message)
      onApplySuccess?.()
    },
    onError: (error: Error) => {
      setApplyingTemplateId(null)
      alert(error.message)
    },
  })

  // ダイアログ用の情報
  const selectedJobType = jobTypes.find((jt) => jt.id === selectedJobTypeId)

  if (loadingRoles || loadingPeriodTemplates) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (grades.length === 0 || jobTypes.length === 0) {
    return null
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  評価テンプレート（役割責任ベース）
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                この評価期間で使用するテンプレートを管理します（運用側で編集可能・マスタには影響しません）
              </p>
              <div className="overflow-x-auto border rounded-lg">
                <table className="border-collapse text-sm" style={{ minWidth: `${80 + jobTypes.length * 300}px` }}>
                  <thead>
                    <tr className="border-b bg-primary/10">
                      <th className="text-left p-3 font-semibold sticky left-0 z-10 bg-primary/10 w-[80px] border-r">
                        等級
                      </th>
                      {jobTypes.map((jobType) => (
                        <th key={jobType.id} className="text-center p-3 font-semibold w-[300px] border-r last:border-r-0">
                          <div className="text-xs text-muted-foreground">{jobType.categoryName}</div>
                          <div className="text-base">{jobType.name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((grade) => (
                      <tr key={grade.id} className="border-b hover:bg-muted/20">
                        <td className="p-3 font-bold text-center bg-muted/30 sticky left-0 z-10 border-r">
                          {grade.name}
                        </td>
                        {jobTypes.map((jobType) => {
                          const matrixKey = `${grade.id}-${jobType.id}`
                          const roleData = roleMatrix.get(matrixKey)

                          if (!roleData) {
                            return (
                              <td key={jobType.id} className="p-3 text-center text-muted-foreground border-r last:border-r-0 bg-gray-50/50">
                                -
                              </td>
                            )
                          }

                          const configId = roleData.config.id
                          const periodTemplate = periodTemplatesMap.get(matrixKey)
                          const masterTemplate = masterTemplatesMap.get(configId)
                          const employeeCount = roleData.employees.length

                          const isPeriodSpecific = !!periodTemplate
                          const savedItems = isPeriodSpecific
                            ? (periodTemplate?.items || [])
                            : (masterTemplate?.items || [])
                          const responsibilities = roleData.role?.responsibilities || []

                          const displayItems = savedItems.length > 0
                            ? savedItems.map((i: { name: string }) => i.name)
                            : responsibilities
                          const hasItems = displayItems.length > 0
                          const hasSavedTemplate = savedItems.length > 0

                          const itemCount = savedItems.length
                          const totalMaxScore = savedItems.reduce(
                            (sum: number, item: { maxScore?: number }) => sum + (item.maxScore ?? 5),
                            0
                          )

                          const templateStatus = isPeriodSpecific ? "period" : masterTemplate?.status

                          return (
                            <td key={jobType.id} className="p-2 align-top border-r last:border-r-0">
                              <div
                                onClick={() => handleCellClick(configId, grade.id, jobType.id)}
                                className="w-full text-left p-3 rounded-lg border bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer group shadow-sm"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2 text-xs border-b pb-2 mb-2">
                                    <span className="text-muted-foreground font-medium">該当者: {employeeCount}名</span>
                                    <div className="flex items-center gap-1">
                                      {isPeriodSpecific ? (
                                        <Badge className="bg-blue-500 hover:bg-blue-500 text-white text-[10px] px-1.5 py-0">
                                          期間固有
                                        </Badge>
                                      ) : hasSavedTemplate && templateStatus === "confirmed" ? (
                                        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px] px-1.5 py-0">
                                          <CheckCircle className="h-3 w-3 mr-0.5" />
                                          確定
                                        </Badge>
                                      ) : hasSavedTemplate ? (
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] px-1.5 py-0">
                                          下書き
                                        </Badge>
                                      ) : null}
                                      <Pencil className="h-4 w-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                  {hasSavedTemplate ? (
                                    <>
                                      <div className="text-sm font-bold text-primary mb-2">
                                        {itemCount}項目 / {totalMaxScore}点満点
                                      </div>
                                      <ol className="space-y-1 text-sm">
                                        {displayItems.map((item: string, idx: number) => (
                                          <li key={idx} className="text-gray-700 dark:text-gray-300 flex">
                                            <span className="text-muted-foreground mr-2 shrink-0">{idx + 1}.</span>
                                            <span>{item}</span>
                                          </li>
                                        ))}
                                      </ol>
                                      {isPeriodSpecific && periodTemplate && (
                                        <div className="pt-2 border-t mt-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full text-xs"
                                            onClick={(e) => handleApplyTemplate(e, periodTemplate.id)}
                                            disabled={applyingTemplateId === periodTemplate.id}
                                          >
                                            {applyingTemplateId === periodTemplate.id ? (
                                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            ) : (
                                              <RefreshCw className="h-3 w-3 mr-1" />
                                            )}
                                            従業員に反映
                                          </Button>
                                        </div>
                                      )}
                                    </>
                                  ) : hasItems ? (
                                    <ol className="space-y-1 text-sm">
                                      {displayItems.map((item: string, idx: number) => (
                                        <li key={idx} className="text-gray-700 dark:text-gray-300 flex">
                                          <span className="text-muted-foreground mr-2 shrink-0">{idx + 1}.</span>
                                          <span>{item}</span>
                                        </li>
                                      ))}
                                    </ol>
                                  ) : (
                                    <p className="text-muted-foreground text-sm italic">未設定</p>
                                  )}
                                </div>
                              </div>
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

      {/* テンプレート編集ダイアログ（評価制度設定と同じUI） */}
      <Dialog open={!!selectedJobTypeId} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="!max-w-[calc(100vw-80px)] w-[calc(100vw-80px)] h-[90vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              評価テンプレート
            </DialogTitle>
            <DialogDescription>
              {selectedJobType?.categoryName} / {selectedJobType?.name} - 全等級
              <span className="block text-xs mt-1">
                ここでの変更はこの評価期間のみに適用され、マスターテンプレートには影響しません。
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {gradeStates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">データがありません</div>
            ) : (
              gradeStates.map((state) => {
                const totalMaxScore = state.items.reduce((sum, item) => sum + item.maxScore, 0)

                return (
                  <div key={state.gradeId} className="border rounded-lg overflow-hidden">
                    {/* 等級ヘッダー */}
                    <div className="w-full flex items-center justify-between p-3 bg-muted/50">
                      <div
                        className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity flex-1"
                        onClick={() => toggleExpand(state.gradeId)}
                      >
                        {state.isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-bold text-lg">{state.gradeName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {state.items.length}項目 / {totalMaxScore}点満点
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({state.employees.length}名)
                        </span>
                        {state.periodTemplateId && (
                          <Badge className="bg-blue-500 hover:bg-blue-500 text-white text-[10px] px-1.5 py-0">
                            期間固有
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {state.periodTemplateId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            onClick={() => {
                              setApplyingTemplateId(state.periodTemplateId)
                              applyTemplateMutation.mutate(state.periodTemplateId!)
                            }}
                            disabled={applyingTemplateId === state.periodTemplateId}
                          >
                            {applyingTemplateId === state.periodTemplateId ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            従業員に反映
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveGradeTemplate(state.gradeId, "draft")}
                          disabled={state.isSaving}
                        >
                          {state.isSaving ? "..." : "保存"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveGradeTemplate(state.gradeId, "confirmed")}
                          disabled={state.isSaving}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          確定
                        </Button>
                      </div>
                    </div>

                    {/* 項目一覧 */}
                    {state.isExpanded && (
                      <div className="p-3 space-y-2">
                        {/* ヘッダー */}
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
                          <span className="w-6 text-center">No</span>
                          <span className="flex-1">項目名</span>
                          <span className="w-14 text-center">満点</span>
                          <span className="w-8"></span>
                        </div>

                        {/* 項目リスト */}
                        {state.items.map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-6 text-center">
                              {index + 1}
                            </span>
                            <Input
                              value={item.name}
                              onChange={(e) =>
                                handleEditItemName(state.gradeId, index, e.target.value)
                              }
                              className="flex-1 h-8 text-sm"
                              placeholder="評価項目を入力"
                              disabled={state.isSaving}
                            />
                            <Input
                              type="number"
                              min="0"
                              value={item.maxScore}
                              onChange={(e) =>
                                handleEditItemMaxScore(
                                  state.gradeId,
                                  index,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-14 h-8 text-center text-sm"
                              disabled={state.isSaving}
                            />
                            <div className="w-8 flex justify-center">
                              {state.items.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveItem(state.gradeId, index)}
                                  disabled={state.isSaving}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* 項目追加 & 該当者 */}
                        <div className="flex items-center justify-between pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAddItem(state.gradeId)}
                            disabled={state.isSaving}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            項目追加
                          </Button>

                          {state.employees.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground mr-1">該当者:</span>
                              {state.employees.slice(0, 3).map((emp) => (
                                <span
                                  key={emp.id}
                                  className="inline-flex items-center text-xs text-muted-foreground"
                                >
                                  <UserCircle className="h-3 w-3 mr-0.5" />
                                  {emp.lastName}
                                </span>
                              ))}
                              {state.employees.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  他{state.employees.length - 3}名
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter className="flex-shrink-0 border-t p-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function convertToEvaluationItem(responsibility: string): string {
  let converted = responsibility
    .replace(/すること[。．]?$/, "できたか")
    .replace(/する[。．]?$/, "できたか")
    .replace(/を行う[。．]?$/, "を行えたか")
    .replace(/できる[。．]?$/, "できたか")
    .replace(/している[。．]?$/, "していたか")
    .replace(/を図る[。．]?$/, "を図れたか")

  if (!converted.endsWith("？") && !converted.endsWith("?")) {
    converted += "？"
  }

  return converted
}
