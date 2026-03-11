"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Plus, Trash2, ClipboardCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Evaluation, EvaluationItem } from "./IndividualPreparingTypes"

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

interface EvaluationDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluation: Evaluation | null
  onAddItem: () => void
  onEditItem: (item: EvaluationItem) => void
  onDeleteItem: (itemId: string) => void
  onSaveItems?: (items: Array<{ id?: string; name: string; maxScore: number }>) => Promise<void>
  companyId?: string
}

interface EditableItem {
  id?: string
  name: string
  maxScore: number
  isNew?: boolean
}

export function EvaluationDetailModal({
  open,
  onOpenChange,
  evaluation,
  onSaveItems,
  companyId,
}: EvaluationDetailModalProps) {
  const [editableItems, setEditableItems] = useState<EditableItem[]>([])
  const [originalItems, setOriginalItems] = useState<EditableItem[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)

  // テンプレートから項目を読み込む
  const loadTemplateItems = useCallback(async () => {
    if (!evaluation || !companyId) return []

    try {
      // まず従業員のカスタム評価項目をチェック
      const customRes = await fetch(`/api/employees/${evaluation.employeeId}/evaluation-items`)
      if (customRes.ok) {
        const customData = await customRes.json()
        if (customData.items && customData.items.length > 0) {
          return customData.items.map((item: string | { name: string; maxScore?: number }) => {
            if (typeof item === "string") {
              return { name: item, maxScore: 5, isNew: true }
            }
            return { name: item.name, maxScore: item.maxScore ?? 5, isNew: true }
          })
        }
      }

      // テンプレートから読み込む
      const gradeId = evaluation.employee.grade?.id
      const jobTypeId = evaluation.employee.jobType?.id

      if (gradeId && jobTypeId) {
        const res = await fetch(`/api/companies/${companyId}/evaluation-templates`)
        if (res.ok) {
          const templates = await res.json()
          // GradeJobTypeConfigを検索
          const configRes = await fetch(`/api/grades/roles?companyId=${companyId}`)
          if (configRes.ok) {
            const rolesData = await configRes.json()
            const matchingRole = rolesData?.find(
              (r: { config: { gradeId: string; jobTypeId: string } }) =>
                r.config.gradeId === gradeId && r.config.jobTypeId === jobTypeId
            )

            if (matchingRole) {
              const template = templates.find(
                (t: { gradeJobTypeConfig: { id: string } }) =>
                  t.gradeJobTypeConfig.id === matchingRole.config.id
              )

              if (template && template.items && template.items.length > 0) {
                return template.items.map((item: { name: string; maxScore?: number }) => ({
                  name: item.name,
                  maxScore: item.maxScore ?? 5,
                  isNew: true,
                }))
              }

              // テンプレートがない場合は役割責任から生成
              const responsibilities = matchingRole.role?.responsibilities || []
              if (responsibilities.length > 0) {
                return responsibilities.map((r: string) => ({
                  name: convertToEvaluationItem(r),
                  maxScore: 5,
                  isNew: true,
                }))
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("テンプレート読み込みエラー:", error)
    }

    return []
  }, [evaluation, companyId])

  // 評価データから編集可能な項目リストを作成
  useEffect(() => {
    if (evaluation && open) {
      const loadItems = async () => {
        // 既存の評価項目があればそれを使用
        if (evaluation.items.length > 0) {
          const items: EditableItem[] = evaluation.items.map((item) => ({
            id: item.id,
            name: item.templateItem?.name || "",
            maxScore: item.templateItem?.maxScore || 5,
          }))
          setEditableItems(items)
          setOriginalItems(JSON.parse(JSON.stringify(items)))
        } else {
          // 項目がない場合はテンプレートから読み込む
          setIsLoading(true)
          const templateItems = await loadTemplateItems()
          if (templateItems.length > 0) {
            setEditableItems(templateItems)
            setOriginalItems(JSON.parse(JSON.stringify(templateItems)))
          } else {
            // テンプレートもない場合は空の1行
            const emptyItem = { name: "", maxScore: 5, isNew: true }
            setEditableItems([emptyItem])
            setOriginalItems([emptyItem])
          }
          setIsLoading(false)
        }
      }
      loadItems()
    }
  }, [evaluation, open, loadTemplateItems])

  // 変更があるかチェック
  const hasChanges = useMemo(() => {
    if (editableItems.length !== originalItems.length) return true
    return editableItems.some((item, index) =>
      item.name !== originalItems[index]?.name || item.maxScore !== originalItems[index]?.maxScore
    )
  }, [editableItems, originalItems])

  const handleEditItemName = (index: number, value: string) => {
    const newItems = [...editableItems]
    newItems[index] = { ...newItems[index], name: value }
    setEditableItems(newItems)
  }

  const handleEditItemMaxScore = (index: number, value: number) => {
    const newItems = [...editableItems]
    newItems[index] = { ...newItems[index], maxScore: value }
    setEditableItems(newItems)
  }

  const handleAddItem = () => {
    setEditableItems([...editableItems, { name: "", maxScore: 5, isNew: true }])
  }

  const handleRemoveItem = (index: number) => {
    if (editableItems.length > 1) {
      const newItems = editableItems.filter((_, i) => i !== index)
      setEditableItems(newItems)
    }
  }

  const totalMaxScore = editableItems.reduce((sum, item) => sum + item.maxScore, 0)

  const handleSave = useCallback(async () => {
    if (!evaluation || !onSaveItems) return

    const validItems = editableItems.filter(item => item.name.trim() !== "")
    if (validItems.length === 0) {
      alert("評価項目を1つ以上入力してください")
      return
    }

    setIsSaving(true)
    try {
      await onSaveItems(validItems)
      setOriginalItems(JSON.parse(JSON.stringify(validItems)))
      setEditableItems(validItems)

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
  }, [evaluation, editableItems, onSaveItems, pendingClose, onOpenChange])

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

  if (!evaluation) return null

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen) {
          handleClose()
        } else {
          onOpenChange(newOpen)
        }
      }}>
        <DialogContent className="!max-w-[calc(100vw-100px)] w-[1100px] max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              評価項目
            </DialogTitle>
            <DialogDescription>
              {evaluation.employee.lastName} {evaluation.employee.firstName}（{evaluation.employee.grade?.name || "-"} × {evaluation.employee.jobType?.name || "-"}）
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
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">読み込み中...</span>
                </div>
              ) : (
              <div className="divide-y">
                {editableItems.map((item, index) => (
                  <div key={item.id || `new-${index}`} className="flex items-start gap-2 p-3">
                    <span className="text-sm font-medium text-muted-foreground w-10 text-center pt-2">
                      {index + 1}
                    </span>
                    <Textarea
                      value={item.name}
                      onChange={(e) => handleEditItemName(index, e.target.value)}
                      className="flex-1 min-h-[60px] text-sm resize-y"
                      placeholder="評価項目を入力"
                      rows={2}
                      disabled={isSaving || evaluation.currentPhase === "completed"}
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.maxScore}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^0-9]/g, "")
                        handleEditItemMaxScore(index, sanitized === "" ? 0 : parseInt(sanitized, 10))
                      }}
                      className="w-20 text-center"
                      disabled={isSaving || evaluation.currentPhase === "completed"}
                    />
                    <div className="w-10 flex justify-center">
                      {editableItems.length > 1 && evaluation.currentPhase !== "completed" && (
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

          {evaluation.currentPhase !== "completed" && (
            <div className="flex justify-center shrink-0">
              <Button variant="outline" size="sm" onClick={handleAddItem} disabled={isSaving}>
                <Plus className="h-4 w-4 mr-1" />
                項目を追加
              </Button>
            </div>
          )}

          <DialogFooter className="shrink-0 flex-row justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isSaving}>
              閉じる
            </Button>
            {evaluation.currentPhase !== "completed" && onSaveItems && (
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "保存中..." : "保存"}
              </Button>
            )}
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
