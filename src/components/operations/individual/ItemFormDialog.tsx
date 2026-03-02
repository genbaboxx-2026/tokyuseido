"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import type { ItemFormData, EvaluationItem } from "./IndividualPreparingTypes"

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: EvaluationItem | null
  formData: ItemFormData
  onFormChange: (data: ItemFormData) => void
  onSave: () => void
  isSaving: boolean
}

export function ItemFormDialog({
  open,
  onOpenChange,
  editingItem,
  formData,
  onFormChange,
  onSave,
  isSaving,
}: ItemFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? "評価項目を編集" : "評価項目を追加"}
          </DialogTitle>
          <DialogDescription>
            評価項目の詳細を入力してください
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">項目名 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              placeholder="例：計画・管理"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">カテゴリ *</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => onFormChange({ ...formData, category: e.target.value })}
              placeholder="例：一般"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
              placeholder="評価基準の説明（任意）"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxScore">最大スコア</Label>
            <Input
              id="maxScore"
              type="number"
              value={formData.maxScore}
              onChange={(e) => onFormChange({ ...formData, maxScore: parseInt(e.target.value) || 5 })}
              min={1}
              max={10}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={onSave}
            disabled={!formData.name || !formData.category || isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {editingItem ? "更新" : "追加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isDeleting: boolean
}

export function DeleteItemDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteItemDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>評価項目を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。評価項目とそのスコアが削除されます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            削除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
