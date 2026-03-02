"use client"

import {
  ArrowRight,
  Loader2,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { type CategoryType } from "./Evaluation360Types"

interface ItemsPreparationCardProps {
  categories: CategoryType[]
  isGenerating: boolean
  isCopying: boolean
  isSaving: boolean
  onGenerate: () => void
  onCopyPrevious: () => void
  onAddCategory: () => void
  onUpdateCategory: (index: number, field: string, value: string) => void
  onRemoveCategory: (index: number) => void
  onAddItem: (categoryIndex: number) => void
  onUpdateItem: (categoryIndex: number, itemIndex: number, field: string, value: string | number) => void
  onRemoveItem: (categoryIndex: number, itemIndex: number) => void
  onSave: () => void
  onConfirmAndProceed: () => Promise<void>
}

export function ItemsPreparationCard({
  categories,
  isGenerating,
  isCopying,
  isSaving,
  onGenerate,
  onCopyPrevious,
  onAddCategory,
  onUpdateCategory,
  onRemoveCategory,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSave,
  onConfirmAndProceed,
}: ItemsPreparationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">評価項目準備</CardTitle>
        <CardDescription>
          テンプレートから生成するか、前期の項目をコピーして開始できます
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            テンプレートから生成
          </Button>
          <Button
            variant="outline"
            onClick={onCopyPrevious}
            disabled={isCopying}
          >
            {isCopying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            前期をコピー
          </Button>
        </div>

        {categories.map((category, catIndex) => (
          <div key={catIndex} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={category.name}
                onChange={(e) => onUpdateCategory(catIndex, "name", e.target.value)}
                className="font-semibold"
              />
              <Button variant="ghost" size="icon" onClick={() => onRemoveCategory(catIndex)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">No</TableHead>
                  <TableHead>項目</TableHead>
                  <TableHead className="w-[100px]">満点</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {category.items.map((item, itemIndex) => (
                  <TableRow key={itemIndex}>
                    <TableCell>{itemIndex + 1}</TableCell>
                    <TableCell>
                      <Textarea
                        value={item.content}
                        onChange={(e) => onUpdateItem(catIndex, itemIndex, "content", e.target.value)}
                        rows={2}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.maxScore}
                        onChange={(e) => onUpdateItem(catIndex, itemIndex, "maxScore", parseInt(e.target.value) || 0)}
                        min={0}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => onRemoveItem(catIndex, itemIndex)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Button variant="outline" size="sm" onClick={() => onAddItem(catIndex)}>
              <Plus className="h-4 w-4 mr-1" />
              項目を追加
            </Button>
          </div>
        ))}

        <Button variant="outline" onClick={onAddCategory}>
          <Plus className="h-4 w-4 mr-1" />
          カテゴリーを追加
        </Button>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            下書き保存
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={categories.length === 0 || categories.every((c) => c.items.length === 0)}>
                項目確定 → 評価者選定へ
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>項目を確定しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  確定後も項目の編集は可能ですが、評価者選定フェーズに進みます。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirmAndProceed}>
                  確定
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
