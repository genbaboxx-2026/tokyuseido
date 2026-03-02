"use client"

import { useState, useEffect, useRef } from "react"
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
import {
  Users,
  Plus,
  Trash2,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { Employee, EvaluationStatusType } from "./EmployeeEvaluationSection"

// 360度評価テンプレートのカテゴリ型
interface Template360Category {
  id: string
  name: string
  sortOrder: number
  items: Array<{
    id: string
    content: string
    maxScore: number
    sortOrder: number
  }>
}

// 360度評価テンプレート型
interface Template360 {
  id: string
  grades: Array<{ id: string; name: string }>
  jobTypes: Array<{ id: string; name: string }>
  categories: Template360Category[]
}

interface Employee360EvaluationItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null
  companyId: string
  onStatusChange?: (employeeId: string, status: EvaluationStatusType) => void
}

export function Employee360EvaluationItemsDialog({
  open,
  onOpenChange,
  employee,
  companyId,
  onStatusChange,
}: Employee360EvaluationItemsDialogProps) {
  const [categories, setCategories] = useState<Template360Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [templateFound, setTemplateFound] = useState(false)

  // 評価者設定（評価者ID + テンプレートIDのペア）
  const [evaluatorSettings, setEvaluatorSettings] = useState<Array<{ evaluatorId: string | null; templateId: string }>>([
    { evaluatorId: null, templateId: "" },
    { evaluatorId: null, templateId: "" },
    { evaluatorId: null, templateId: "" },
    { evaluatorId: null, templateId: "" },
    { evaluatorId: null, templateId: "" },
  ])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])

  // テンプレート一覧
  const [templates, setTemplates] = useState<Template360[]>([])

  const loadedEmployeeIdRef = useRef<string | null>(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    const loadData = async () => {
      if (!employee || !companyId) return

      if (hasLoadedRef.current && loadedEmployeeIdRef.current === employee.id) {
        return
      }

      setIsLoading(true)
      setCategories([])
      setTemplateFound(false)
      setEvaluatorSettings([
        { evaluatorId: null, templateId: "" },
        { evaluatorId: null, templateId: "" },
        { evaluatorId: null, templateId: "" },
        { evaluatorId: null, templateId: "" },
        { evaluatorId: null, templateId: "" },
      ])
      loadedEmployeeIdRef.current = employee.id
      hasLoadedRef.current = true

      try {
        // 従業員一覧を取得（評価者選択用）
        const empRes = await fetch(`/api/employees?companyId=${companyId}&limit=100`)
        if (empRes.ok) {
          const empData = await empRes.json()
          setAllEmployees(empData.employees || [])
        }

        // 360度評価テンプレート一覧を取得
        const templatesRes = await fetch(`/api/companies/${companyId}/evaluation-360-templates`)
        if (templatesRes.ok) {
          const templatesData = await templatesRes.json()
          const loadedTemplates: Template360[] = templatesData.templates || []
          setTemplates(loadedTemplates)

          const gradeId = employee.grade?.id || employee.gradeId
          const jobTypeId = employee.jobType?.id || employee.jobTypeId

          // カスタム項目を確認
          try {
            const customRes = await fetch(`/api/employees/${employee.id}/evaluation-360-items`)
            if (customRes.ok) {
              const customData = await customRes.json()
              if (customData.categories && customData.categories.length > 0) {
                setCategories(customData.categories)
                setTemplateFound(true)
                if (customData.evaluatorSettings) {
                  setEvaluatorSettings(customData.evaluatorSettings)
                }
                return
              }
            }
          } catch {
            // カスタム項目がなければテンプレートを使用
          }

          // 等級・職種に合致するテンプレートを探す
          if (gradeId && jobTypeId) {
            const matchingTemplate = loadedTemplates.find((t) => {
              const hasGrade = t.grades.some((g) => g.id === gradeId)
              const hasJobType = t.jobTypes.some((jt) => jt.id === jobTypeId)
              return hasGrade && hasJobType
            })

            if (matchingTemplate && matchingTemplate.categories.length > 0) {
              setCategories(matchingTemplate.categories)
              setTemplateFound(true)
              return
            }
          }
        }

        setTemplateFound(false)
      } catch (error) {
        console.error("360度評価データ読み込みエラー:", error)
        setTemplateFound(false)
      } finally {
        setIsLoading(false)
      }
    }

    if (open && employee) {
      loadData()
    }

    if (!open) {
      loadedEmployeeIdRef.current = null
      hasLoadedRef.current = false
    }
  }, [open, employee?.id, companyId])

  // 評価者変更
  const handleEvaluatorChange = (index: number, evaluatorId: string | null) => {
    setEvaluatorSettings((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], evaluatorId }
      return updated
    })
  }

  // 評価者のテンプレート変更
  const handleEvaluatorTemplateChange = (index: number, templateId: string) => {
    setEvaluatorSettings((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], templateId }
      return updated
    })
  }

  // 評価者名取得
  const getEmployeeName = (empId: string | null): string => {
    if (!empId) return ""
    const emp = allEmployees.find((e) => e.id === empId)
    return emp ? `${emp.lastName} ${emp.firstName}` : ""
  }

  // テンプレート名取得
  const getTemplateName = (templateId: string): string => {
    if (!templateId) return ""
    const t = templates.find((t) => t.id === templateId)
    if (!t) return ""
    const grades = t.grades.map((g) => g.name).join(",")
    const jobTypes = t.jobTypes.map((jt) => jt.name).join(",")
    return `${grades} × ${jobTypes}`
  }

  const handleCategoryNameChange = (categoryId: string, newName: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, name: newName } : cat
      )
    )
  }

  const handleItemContentChange = (categoryId: string, itemId: string, newContent: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              items: cat.items.map((item) =>
                item.id === itemId ? { ...item, content: newContent } : item
              ),
            }
          : cat
      )
    )
  }

  const handleItemMaxScoreChange = (categoryId: string, itemId: string, newScore: number) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              items: cat.items.map((item) =>
                item.id === itemId ? { ...item, maxScore: newScore } : item
              ),
            }
          : cat
      )
    )
  }

  const handleAddItem = (categoryId: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              items: [
                ...cat.items,
                {
                  id: `new-${Date.now()}`,
                  content: "",
                  maxScore: 5,
                  sortOrder: cat.items.length,
                },
              ],
            }
          : cat
      )
    )
  }

  const handleDeleteItem = (categoryId: string, itemId: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? { ...cat, items: cat.items.filter((item) => item.id !== itemId) }
          : cat
      )
    )
  }

  const handleAddCategory = () => {
    setCategories((prev) => [
      ...prev,
      {
        id: `new-cat-${Date.now()}`,
        name: "新しいカテゴリ",
        sortOrder: prev.length,
        items: [
          {
            id: `new-item-${Date.now()}`,
            content: "",
            maxScore: 5,
            sortOrder: 0,
          },
        ],
      },
    ])
  }

  const handleDeleteCategory = (categoryId: string) => {
    setCategories((prev) => prev.filter((cat) => cat.id !== categoryId))
  }

  const handleSave = async () => {
    if (!employee) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}/evaluation-360-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories,
          evaluatorSettings: evaluatorSettings.filter((s) => s.evaluatorId !== null),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "保存に失敗しました")
      }

      onStatusChange?.(employee.id, "COMPLETED")
      onOpenChange(false)
    } catch (error) {
      console.error("保存エラー:", error)
      alert(error instanceof Error ? error.message : "保存に失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  if (!employee) return null

  const totalScore = categories.reduce(
    (sum, cat) => sum + cat.items.reduce((s, item) => s + item.maxScore, 0),
    0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[calc(100vw-4rem)] !max-w-[calc(100vw-4rem)] h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            360度評価項目
          </DialogTitle>
          <DialogDescription>
            {employee.lastName} {employee.firstName}（{employee.grade?.name || "-"} × {employee.jobType?.name || "-"}）
          </DialogDescription>
        </DialogHeader>

        {/* 評価者ごとのテンプレート設定 */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <Label className="text-sm font-medium">評価者と評価テンプレートの設定（最大5名）</Label>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div key={idx} className="grid grid-cols-[1fr_2fr] gap-2 items-center">
                <Select
                  value={evaluatorSettings[idx].evaluatorId || "none"}
                  onValueChange={(value) => handleEvaluatorChange(idx, value === "none" ? null : value)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder={`評価者${idx + 1}`}>
                      {evaluatorSettings[idx].evaluatorId ? getEmployeeName(evaluatorSettings[idx].evaluatorId) : `評価者${idx + 1}`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {allEmployees
                      .filter((e) => e.id !== employee.id)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.lastName} {e.firstName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select
                  value={evaluatorSettings[idx].templateId || "none"}
                  onValueChange={(value) => handleEvaluatorTemplateChange(idx, value === "none" ? "" : value)}
                  disabled={!evaluatorSettings[idx].evaluatorId}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="テンプレートを選択">
                      {evaluatorSettings[idx].templateId ? getTemplateName(evaluatorSettings[idx].templateId) : "テンプレートを選択"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.grades.map((g) => g.name).join(",")} × {t.jobTypes.map((jt) => jt.name).join(",")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            読み込み中...
          </div>
        ) : !templateFound && categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>この等級・職種に対応する360度評価テンプレートがありません</p>
            <p className="text-sm mt-2">
              テンプレートを作成するか、カテゴリを追加してください
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCategory}
              className="mt-4"
            >
              <Plus className="h-4 w-4 mr-1" />
              カテゴリを追加して作成
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => {
              const subtotal = category.items.reduce((sum, item) => sum + item.maxScore, 0)
              let categoryIndex = 0
              for (const cat of categories) {
                if (cat.id === category.id) break
                categoryIndex += cat.items.length
              }

              return (
                <div key={category.id} className="border rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b">
                    <Input
                      value={category.name}
                      onChange={(e) => handleCategoryNameChange(category.id, e.target.value)}
                      className="font-semibold text-base w-[400px] bg-white dark:bg-slate-950"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b">
                        <th className="text-center p-3 border-r w-[60px] font-semibold text-slate-600 dark:text-slate-300">No</th>
                        <th className="text-left p-3 border-r font-semibold text-slate-600 dark:text-slate-300">項目</th>
                        <th className="text-center p-3 border-r w-[100px] font-semibold text-slate-600 dark:text-slate-300">満点</th>
                        <th className="text-center p-3 w-[70px] font-semibold text-slate-600 dark:text-slate-300">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.items.map((item, itemIdx) => (
                        <tr key={item.id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 border-r text-center font-medium text-slate-500">{categoryIndex + itemIdx + 1}</td>
                          <td className="p-3 border-r">
                            <Input
                              value={item.content}
                              onChange={(e) => handleItemContentChange(category.id, item.id, e.target.value)}
                              placeholder="評価項目を入力"
                              className="bg-white dark:bg-slate-950"
                            />
                          </td>
                          <td className="p-3 border-r">
                            <Input
                              type="number"
                              value={item.maxScore}
                              onChange={(e) => handleItemMaxScoreChange(category.id, item.id, parseInt(e.target.value) || 0)}
                              className="text-center bg-white dark:bg-slate-950"
                              min={0}
                            />
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteItem(category.id, item.id)}
                              disabled={category.items.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <td colSpan={2} className="p-2 border-r">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => handleAddItem(category.id)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            項目追加
                          </Button>
                        </td>
                        <td className="p-3 border-r text-center font-bold text-lg">{subtotal}</td>
                        <td className="p-3 text-center text-sm font-medium text-slate-500">合計</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCategory}
              className="text-muted-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              カテゴリを追加
            </Button>

            <div className="border rounded-xl p-4 bg-gradient-to-r from-primary/10 to-primary/5 flex justify-end items-center gap-6 shadow-sm">
              <span className="font-semibold text-slate-600 dark:text-slate-300">合計（全項目）</span>
              <span className="text-2xl font-bold text-primary">{totalScore}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isSaving || categories.length === 0}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
