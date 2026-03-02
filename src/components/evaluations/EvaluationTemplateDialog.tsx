"use client"

import { useState } from "react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle,
  UserCircle,
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
  data: GradeRoleData | null
  companyId: string
  onSaved?: () => void
  onEmployeeClick?: (employee: SimpleEmployee) => void
}

export function EvaluationTemplateDialog({
  open,
  onOpenChange,
  data,
  companyId,
  onSaved,
  onEmployeeClick,
}: EvaluationTemplateDialogProps) {
  const [items, setItems] = useState<TemplateItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [templateId, setTemplateId] = useState<string | null>(null)

  const responsibilities = data?.role?.responsibilities || []

  const loadTemplate = async () => {
    if (!data || !companyId) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/evaluation-templates`)
      if (res.ok) {
        const templates = await res.json()
        const template = templates.find(
          (t: { gradeJobTypeConfig: { id: string }; id: string; items: Array<{ name: string; maxScore?: number }> }) =>
            t.gradeJobTypeConfig.id === data.config.id
        )
        if (template && template.items.length > 0) {
          setItems(template.items.map((item: { name: string; maxScore?: number }) => ({
            name: item.name,
            maxScore: item.maxScore ?? 5,
          })))
          setTemplateId(template.id)
        } else {
          if (responsibilities.length > 0) {
            setItems(responsibilities.map(r => ({
              name: convertToEvaluationItem(r),
              maxScore: 5,
            })))
          } else {
            setItems([{ name: "", maxScore: 5 }])
          }
          setTemplateId(null)
        }
      }
    } catch (error) {
      console.error("テンプレート読み込みエラー:", error)
      if (responsibilities.length > 0) {
        setItems(responsibilities.map(r => ({
          name: convertToEvaluationItem(r),
          maxScore: 5,
        })))
      } else {
        setItems([{ name: "", maxScore: 5 }])
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (open && items.length === 0 && !isLoading) {
    loadTemplate()
  }

  if (!open && items.length > 0) {
    setItems([])
    setTemplateId(null)
  }

  const handleEditItemName = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], name: value }
    setItems(newItems)
  }

  const handleEditItemMaxScore = (index: number, value: number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], maxScore: value }
    setItems(newItems)
  }

  const handleAddItem = () => {
    setItems([...items, { name: "", maxScore: 5 }])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index)
      setItems(newItems)
    }
  }

  const totalMaxScore = items.reduce((sum, item) => sum + item.maxScore, 0)

  const handleSave = async (status: "draft" | "confirmed") => {
    if (!data) return

    const validItems = items.filter(item => item.name.trim() !== "")
    if (validItems.length === 0) {
      alert("評価項目を1つ以上入力してください")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/evaluation-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeJobTypeConfigId: data.config.id,
          name: `${data.config.grade.name} × ${data.config.jobType.name} 評価テンプレート`,
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
      onOpenChange(false)
    } catch (error) {
      console.error("評価テンプレート保存エラー:", error)
      alert(error instanceof Error ? error.message : "保存に失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  if (!data) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            評価テンプレート
          </DialogTitle>
          <DialogDescription>
            {data.config.grade.name} × {data.config.jobType.name}
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 p-3 bg-muted/50 border-b text-sm font-medium shrink-0">
            <span className="w-10 text-center">No</span>
            <span className="flex-1">項目名</span>
            <span className="w-20 text-center">満点</span>
            <span className="w-10"></span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px]">
            <div className="divide-y">
              {items.map((item, index) => (
                <div key={index} className="flex items-start gap-2 p-3">
                  <span className="text-sm font-medium text-muted-foreground w-10 text-center pt-2">
                    {index + 1}
                  </span>
                  <Textarea
                    value={item.name}
                    onChange={(e) => handleEditItemName(index, e.target.value)}
                    className="flex-1 min-h-[60px] text-sm resize-y"
                    placeholder="評価項目を入力"
                    rows={2}
                    disabled={isSaving}
                  />
                  <Input
                    type="number"
                    min="0"
                    value={item.maxScore}
                    onChange={(e) => handleEditItemMaxScore(index, parseInt(e.target.value) || 0)}
                    className="w-20 text-center"
                    disabled={isSaving}
                  />
                  <div className="w-10 flex justify-center">
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveItem(index)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-4 p-3 bg-muted/50 border-t shrink-0">
            <span className="text-sm font-medium">合計:</span>
            <span className="text-lg font-bold text-primary">{totalMaxScore}点満点</span>
          </div>
        </div>

        <div className="flex justify-center shrink-0">
          <Button variant="outline" size="sm" onClick={handleAddItem} disabled={isSaving}>
            <Plus className="h-4 w-4 mr-1" />
            項目を追加
          </Button>
        </div>

        {data.employees.length > 0 && (
          <div className="border-t pt-3 shrink-0 max-h-[100px] overflow-y-auto">
            <Label className="text-sm font-medium">
              該当者 ({data.employees.length}名)
            </Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {data.employees.map((emp) => (
                <Button
                  key={emp.id}
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => onEmployeeClick?.(emp)}
                >
                  <UserCircle className="h-3 w-3 mr-1" />
                  {emp.lastName} {emp.firstName}
                </Button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 flex-row justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>
            閉じる
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleSave("draft")} disabled={isSaving}>
            {isSaving ? "..." : "保存"}
          </Button>
          <Button size="sm" onClick={() => handleSave("confirmed")} disabled={isSaving}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {isSaving ? "..." : "確定"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
