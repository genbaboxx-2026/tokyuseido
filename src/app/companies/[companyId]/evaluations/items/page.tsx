"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Plus, Wand2 } from "lucide-react"
import { EVALUATION_UI_TEXT, EVALUATION_CATEGORIES } from "@/lib/evaluation/constants"

interface EvaluationItem {
  id: string
  name: string
  description: string | null
  category: string
  weight: number | null
  gradeJobTypeConfigId: string | null
}

interface GradeJobTypeConfig {
  id: string
  grade: { id: string; name: string }
  jobType: { id: string; name: string }
}

export default function EvaluationItemsPage() {
  const params = useParams()
  const companyId = params.companyId as string

  const [items, setItems] = useState<EvaluationItem[]>([])
  const [configs, setConfigs] = useState<GradeJobTypeConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 新規項目フォーム
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    category: "",
    weight: 1,
  })

  // 評価項目を取得
  const fetchItems = async () => {
    try {
      setIsLoading(true)
      let url = "/api/evaluations/items"
      if (selectedConfigId) {
        url += `?gradeJobTypeConfigId=${selectedConfigId}`
      }
      const response = await fetch(url)
      if (!response.ok) throw new Error("評価項目の取得に失敗しました")
      const data = await response.json()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsLoading(false)
    }
  }

  // 等級×職種設定を取得
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const response = await fetch(`/api/grades/matrix?companyId=${companyId}`)
        if (response.ok) {
          const data = await response.json()
          const enabledConfigs = data.filter(
            (c: { isEnabled: boolean }) => c.isEnabled
          )
          setConfigs(enabledConfigs)
        }
      } catch (err) {
        console.error("等級×職種設定の取得エラー:", err)
      }
    }
    fetchConfigs()
  }, [companyId])

  useEffect(() => {
    fetchItems()
  }, [selectedConfigId])

  const handleCreate = async () => {
    if (!newItem.name || !newItem.category) {
      setError("項目名とカテゴリは必須です")
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const response = await fetch("/api/evaluations/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newItem,
          gradeJobTypeConfigId: selectedConfigId || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "作成に失敗しました")
      }

      setIsDialogOpen(false)
      setNewItem({ name: "", description: "", category: "", weight: 1 })
      fetchItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePresetFromRoles = async () => {
    if (!selectedConfigId) {
      setError("等級×職種を選択してください")
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch("/api/evaluations/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetFromRoles: true,
          gradeJobTypeConfigId: selectedConfigId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "プリセット作成に失敗しました")
      }

      const result = await response.json()
      setSuccessMessage(result.message)
      fetchItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsSubmitting(false)
    }
  }

  // カテゴリでグループ化
  const groupedItems = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = []
      }
      acc[item.category].push(item)
      return acc
    },
    {} as Record<string, EvaluationItem[]>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${companyId}/evaluations`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{EVALUATION_UI_TEXT.EVALUATION_ITEMS}</h1>
          <p className="text-muted-foreground">
            評価項目を等級・職種ごとに設定します
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              項目を追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>評価項目を追加</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">{EVALUATION_UI_TEXT.ITEM_NAME}</label>
                <Input
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="評価項目名"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{EVALUATION_UI_TEXT.DESCRIPTION}</label>
                <Textarea
                  value={newItem.description}
                  onChange={(e) =>
                    setNewItem({ ...newItem, description: e.target.value })
                  }
                  placeholder="項目の説明"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{EVALUATION_UI_TEXT.CATEGORY}</label>
                <Select
                  value={newItem.category}
                  onValueChange={(value) => setNewItem({ ...newItem, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={EVALUATION_UI_TEXT.SELECT_PLACEHOLDER} />
                  </SelectTrigger>
                  <SelectContent>
                    {EVALUATION_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{EVALUATION_UI_TEXT.WEIGHT}</label>
                <Input
                  type="number"
                  value={newItem.weight}
                  onChange={(e) =>
                    setNewItem({ ...newItem, weight: parseFloat(e.target.value) || 1 })
                  }
                  min={0}
                  max={10}
                  step={0.1}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  {EVALUATION_UI_TEXT.CANCEL}
                </Button>
                <Button onClick={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? EVALUATION_UI_TEXT.LOADING : EVALUATION_UI_TEXT.SAVE}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => setError(null)}
          >
            閉じる
          </Button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 text-green-800 p-4 rounded-md">
          {successMessage}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => setSuccessMessage(null)}
          >
            閉じる
          </Button>
        </div>
      )}

      {/* フィルター */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                等級×職種
              </label>
              <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                <SelectTrigger>
                  <SelectValue placeholder="共通項目（全等級・職種）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">共通項目（全等級・職種）</SelectItem>
                  {configs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.grade.name} × {config.jobType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedConfigId && (
              <Button
                variant="outline"
                onClick={handlePresetFromRoles}
                disabled={isSubmitting}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                役割責任からプリセット
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 評価項目一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>評価項目一覧</CardTitle>
          <CardDescription>
            {selectedConfigId
              ? `選択した等級×職種に紐づく評価項目`
              : "共通の評価項目"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {EVALUATION_UI_TEXT.NO_DATA}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([category, categoryItems]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    {category}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{EVALUATION_UI_TEXT.ITEM_NAME}</TableHead>
                        <TableHead>{EVALUATION_UI_TEXT.DESCRIPTION}</TableHead>
                        <TableHead className="text-center w-24">
                          {EVALUATION_UI_TEXT.WEIGHT}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.description ?? "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.weight ?? 1}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
