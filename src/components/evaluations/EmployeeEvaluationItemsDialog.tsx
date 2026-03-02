"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  ClipboardCheck,
  Plus,
  Trash2,
} from "lucide-react"
import type { Employee } from "./EmployeeEvaluationSection"
import type { GradeRoleData } from "./EvaluationTemplateDialog"

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

// 評価テンプレート型
interface SavedTemplate {
  id: string
  gradeJobTypeConfig: { id: string }
  items: Array<{ name: string; maxScore?: number }>
}

// 従業員評価項目型
interface EmployeeEvalItem {
  name: string
  maxScore: number
}

interface EmployeeEvaluationItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null
  rolesData: GradeRoleData[] | undefined
  companyId: string
}

export function EmployeeEvaluationItemsDialog({
  open,
  onOpenChange,
  employee,
  rolesData,
  companyId,
}: EmployeeEvaluationItemsDialogProps) {
  const [evaluationItems, setEvaluationItems] = useState<EmployeeEvalItem[]>([])
  const [originalItems, setOriginalItems] = useState<EmployeeEvalItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)

  const hasChanges = useMemo(() => {
    if (evaluationItems.length !== originalItems.length) return true
    return evaluationItems.some((item, index) =>
      item.name !== originalItems[index]?.name || item.maxScore !== originalItems[index]?.maxScore
    )
  }, [evaluationItems, originalItems])

  const loadEvaluationItems = async () => {
    if (!employee || !companyId) return

    setIsLoading(true)
    try {
      const customRes = await fetch(`/api/employees/${employee.id}/evaluation-items`)
      if (customRes.ok) {
        const customData = await customRes.json()
        if (customData.items && customData.items.length > 0) {
          const items: EmployeeEvalItem[] = customData.items.map((item: string | { name: string; maxScore?: number }) => {
            if (typeof item === "string") {
              return { name: item, maxScore: 5 }
            }
            return { name: item.name, maxScore: item.maxScore ?? 5 }
          })
          setEvaluationItems(items)
          setOriginalItems(items)
          return
        }
      }

      const gradeId = employee.grade?.id || employee.gradeId
      const jobTypeId = employee.jobType?.id || employee.jobTypeId

      if (!gradeId || !jobTypeId) {
        setEvaluationItems([{ name: "", maxScore: 5 }])
        setOriginalItems([{ name: "", maxScore: 5 }])
        return
      }

      const res = await fetch(`/api/companies/${companyId}/evaluation-templates`)
      if (res.ok) {
        const templates: SavedTemplate[] = await res.json()

        const matchingRole = rolesData?.find(
          (r) => r.config.gradeId === gradeId && r.config.jobTypeId === jobTypeId
        )

        if (matchingRole) {
          const template = templates.find(
            (t) => t.gradeJobTypeConfig.id === matchingRole.config.id
          )

          if (template && template.items.length > 0) {
            const items: EmployeeEvalItem[] = template.items.map((item) => ({
              name: item.name,
              maxScore: item.maxScore ?? 5,
            }))
            setEvaluationItems(items)
            setOriginalItems(items)
            return
          }
        }
      }

      const gradeId2 = employee.grade?.id || employee.gradeId
      const jobTypeId2 = employee.jobType?.id || employee.jobTypeId
      const matchingRole = rolesData?.find(
        (r) => r.config.gradeId === gradeId2 && r.config.jobTypeId === jobTypeId2
      )
      const responsibilities = matchingRole?.role?.responsibilities || []
      if (responsibilities.length > 0) {
        const items: EmployeeEvalItem[] = responsibilities.map(r => ({
          name: convertToEvaluationItem(r),
          maxScore: 5,
        }))
        setEvaluationItems(items)
        setOriginalItems(items)
      } else {
        setEvaluationItems([{ name: "", maxScore: 5 }])
        setOriginalItems([{ name: "", maxScore: 5 }])
      }
    } catch (error) {
      console.error("評価項目読み込みエラー:", error)
      setEvaluationItems([{ name: "", maxScore: 5 }])
      setOriginalItems([{ name: "", maxScore: 5 }])
    } finally {
      setIsLoading(false)
    }
  }

  if (open && evaluationItems.length === 0 && !isLoading && employee) {
    loadEvaluationItems()
  }

  if (!open && evaluationItems.length > 0) {
    setEvaluationItems([])
    setOriginalItems([])
  }

  const handleEditItemName = (index: number, value: string) => {
    const newItems = [...evaluationItems]
    newItems[index] = { ...newItems[index], name: value }
    setEvaluationItems(newItems)
  }

  const handleEditItemMaxScore = (index: number, value: number) => {
    const newItems = [...evaluationItems]
    newItems[index] = { ...newItems[index], maxScore: value }
    setEvaluationItems(newItems)
  }

  const handleAddItem = () => {
    setEvaluationItems([...evaluationItems, { name: "", maxScore: 5 }])
  }

  const handleRemoveItem = (index: number) => {
    if (evaluationItems.length > 1) {
      const newItems = evaluationItems.filter((_, i) => i !== index)
      setEvaluationItems(newItems)
    }
  }

  const totalMaxScore = evaluationItems.reduce((sum, item) => sum + item.maxScore, 0)

  const handleSave = async () => {
    if (!employee) return

    const validItems = evaluationItems.filter(item => item.name.trim() !== "")
    if (validItems.length === 0) {
      alert("評価項目を1つ以上入力してください")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}/evaluation-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validItems.map(item => ({
            name: item.name,
            maxScore: item.maxScore,
          })),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "保存に失敗しました")
      }

      setOriginalItems(validItems)
      setEvaluationItems(validItems)

      if (pendingClose) {
        onOpenChange(false)
        setPendingClose(false)
      } else {
        alert("保存しました")
      }
    } catch (error) {
      console.error("評価項目保存エラー:", error)
      alert(error instanceof Error ? error.message : "保存に失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (hasChanges) {
      setShowConfirmDialog(true)
    } else {
      onOpenChange(false)
    }
  }

  const handleConfirmSave = () => {
    setShowConfirmDialog(false)
    setPendingClose(true)
    handleSave()
  }

  const handleConfirmDiscard = () => {
    setShowConfirmDialog(false)
    onOpenChange(false)
  }

  if (!employee) return null

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen) {
          handleClose()
        } else {
          onOpenChange(newOpen)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              評価項目
            </DialogTitle>
            <DialogDescription>
              {employee.lastName} {employee.firstName}（{employee.grade?.name || "-"} × {employee.jobType?.name || "-"}）
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-2 p-3 bg-muted/50 border-b text-sm font-medium shrink-0">
              <span className="w-10 text-center">No</span>
              <span className="flex-1">項目名</span>
              <span className="w-20 text-center">満点</span>
              <span className="w-10"></span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[350px]">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  読み込み中...
                </div>
              ) : (
                <div className="divide-y">
                  {evaluationItems.map((item, index) => (
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
                        {evaluationItems.length > 1 && (
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
              )}
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

          <DialogFooter className="shrink-0 flex-row justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isSaving}>
              閉じる
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>変更を保存しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              評価項目に変更があります。保存せずに閉じると変更が失われます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConfirmDiscard}>
              保存しない
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>
              保存する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
