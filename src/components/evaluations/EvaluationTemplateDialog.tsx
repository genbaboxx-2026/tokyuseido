"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle,
  UserCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

// 役割責任を評価項目に変換するユーティリティ
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

// 簡易従業員型
interface SimpleEmployee {
  id: string
  firstName: string
  lastName: string
}

// テンプレート項目型
interface TemplateItem {
  name: string
  maxScore: number
}

// 等級ごとのテンプレート状態
interface GradeTemplateState {
  gradeId: string
  gradeName: string
  gradeLevel: number
  configId: string
  items: TemplateItem[]
  employees: SimpleEmployee[]
  isExpanded: boolean
  isSaving: boolean
  templateId: string | null
}

// 役割責任型
export interface GradeRoleData {
  config: {
    id: string
    gradeId: string
    jobTypeId: string
    isEnabled: boolean
    grade: {
      id: string
      name: string
      level: number
    }
    jobType: {
      id: string
      name: string
      jobCategory: {
        id: string
        name: string
      }
    }
  }
  role: {
    id: string
    responsibilities: string[]
    positionNames: string[]
  } | null
  employees: Array<{
    id: string
    firstName: string
    lastName: string
  }>
}

interface EvaluationTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allRoles: GradeRoleData[]
  companyId: string
  onSaved?: () => void
  onEmployeeClick?: (employee: SimpleEmployee, gradeRoleData: GradeRoleData) => void
}

export function EvaluationTemplateDialog({
  open,
  onOpenChange,
  allRoles,
  companyId,
  onSaved,
  onEmployeeClick,
}: EvaluationTemplateDialogProps) {
  const [gradeStates, setGradeStates] = useState<GradeTemplateState[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const jobTypeName = allRoles[0]?.config.jobType.name || ""
  const categoryName = allRoles[0]?.config.jobType.jobCategory.name || ""

  // テンプレートを読み込み
  const loadTemplates = useCallback(async () => {
    if (!companyId || allRoles.length === 0) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/evaluation-templates`)
      const templates = res.ok ? await res.json() : []
      const templatesMap = new Map<string, { id: string; items: Array<{ name: string; maxScore?: number }> }>()
      templates.forEach((t: { gradeJobTypeConfig: { id: string }; id: string; items: Array<{ name: string; maxScore?: number }> }) => {
        templatesMap.set(t.gradeJobTypeConfig.id, t)
      })

      const states: GradeTemplateState[] = allRoles.map((role) => {
        const template = templatesMap.get(role.config.id)
        const responsibilities = role.role?.responsibilities || []

        let items: TemplateItem[]
        if (template && template.items.length > 0) {
          items = template.items.map((item) => ({
            name: item.name,
            maxScore: item.maxScore ?? 5,
          }))
        } else if (responsibilities.length > 0) {
          items = responsibilities.map((r) => ({
            name: convertToEvaluationItem(r),
            maxScore: 5,
          }))
        } else {
          items = [{ name: "", maxScore: 5 }]
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
          templateId: template?.id || null,
        }
      })

      setGradeStates(states.sort((a, b) => b.gradeLevel - a.gradeLevel))
    } catch (error) {
      console.error("テンプレート読み込みエラー:", error)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, allRoles])

  useEffect(() => {
    if (open && allRoles.length > 0) {
      loadTemplates()
    }
    if (!open) {
      setGradeStates([])
    }
  }, [open, allRoles, loadTemplates])

  const toggleExpand = (gradeId: string) => {
    setGradeStates((prev) =>
      prev.map((s) => (s.gradeId === gradeId ? { ...s, isExpanded: !s.isExpanded } : s))
    )
  }

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

  const handleAddItem = (gradeId: string) => {
    setGradeStates((prev) =>
      prev.map((s) => {
        if (s.gradeId !== gradeId) return s
        return { ...s, items: [...s.items, { name: "", maxScore: 5 }] }
      })
    )
  }

  const handleRemoveItem = (gradeId: string, index: number) => {
    setGradeStates((prev) =>
      prev.map((s) => {
        if (s.gradeId !== gradeId) return s
        if (s.items.length <= 1) return s
        return { ...s, items: s.items.filter((_, i) => i !== index) }
      })
    )
  }

  const handleSave = async (gradeId: string, status: "draft" | "confirmed") => {
    const state = gradeStates.find((s) => s.gradeId === gradeId)
    if (!state) return

    const validItems = state.items.filter((item) => item.name.trim() !== "")
    if (validItems.length === 0) {
      alert("評価項目を1つ以上入力してください")
      return
    }

    setGradeStates((prev) =>
      prev.map((s) => (s.gradeId === gradeId ? { ...s, isSaving: true } : s))
    )

    try {
      const roleData = allRoles.find((r) => r.config.grade.id === gradeId)
      const res = await fetch(`/api/companies/${companyId}/evaluation-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeJobTypeConfigId: state.configId,
          name: `${state.gradeName} × ${jobTypeName} 評価テンプレート`,
          status,
          items: validItems.map((item, index) => ({
            name: item.name,
            maxScore: item.maxScore,
            category: "一般",
            sortOrder: index,
          })),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "保存に失敗しました")
      }

      onSaved?.()
    } catch (error) {
      console.error("評価テンプレート保存エラー:", error)
      alert(error instanceof Error ? error.message : "保存に失敗しました")
    } finally {
      setGradeStates((prev) =>
        prev.map((s) => (s.gradeId === gradeId ? { ...s, isSaving: false } : s))
      )
    }
  }

  if (allRoles.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[calc(100vw-80px)] w-[calc(100vw-80px)] h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            評価テンプレート
          </DialogTitle>
          <DialogDescription>
            {categoryName} / {jobTypeName} - 全等級
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
          ) : (
            gradeStates.map((state) => {
              const totalMaxScore = state.items.reduce((sum, item) => sum + item.maxScore, 0)
              const roleData = allRoles.find((r) => r.config.grade.id === state.gradeId)

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
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSave(state.gradeId, "draft")}
                        disabled={state.isSaving}
                      >
                        {state.isSaving ? "..." : "保存"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(state.gradeId, "confirmed")}
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

                        {state.employees.length > 0 && roleData && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground mr-1">該当者:</span>
                            {state.employees.slice(0, 3).map((emp) => (
                              <Button
                                key={emp.id}
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs px-1"
                                onClick={() => onEmployeeClick?.(emp, roleData)}
                              >
                                <UserCircle className="h-3 w-3 mr-0.5" />
                                {emp.lastName}
                              </Button>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
