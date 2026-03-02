"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  RotateCcw,
  Edit3,
  X,
  Check,
} from "lucide-react"
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

type EvaluationType = "individual" | "360"

interface CategoryItem {
  id?: string
  sourceTemplateItemId?: string | null
  itemName: string
  description?: string | null
  maxScore: number
  sortOrder: number
  isCustomized?: boolean
  isAdded?: boolean
  isDeleted?: boolean
}

interface Category {
  name: string
  sortOrder: number
  items: CategoryItem[]
}

interface IndividualItemsResponse {
  employeeId: string
  periodId: string | null
  type: "individual"
  isInitialized: boolean
  items: CategoryItem[]
  message?: string
}

interface Category360Response {
  employeeId: string
  periodId: string | null
  type: "360"
  isInitialized: boolean
  categories: Category[]
  templateId?: string
  templateName?: string
  message?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  employeeId: string
  periodId?: string | null
  evaluationType: EvaluationType
  employeeName?: string
  onSaveComplete?: () => void
}

export default function EvaluationItemsCustomizeModal({
  open,
  onOpenChange,
  companyId,
  employeeId,
  periodId,
  evaluationType,
  employeeName,
  onSaveComplete,
}: Props) {
  const queryClient = useQueryClient()
  const [localItems, setLocalItems] = useState<CategoryItem[]>([])
  const [localCategories, setLocalCategories] = useState<Category[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [showDiscardAlert, setShowDiscardAlert] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)

  // 評価項目を取得
  const { data, isLoading, error, refetch } = useQuery<IndividualItemsResponse | Category360Response>({
    queryKey: ["evaluationCustomItems", companyId, employeeId, periodId, evaluationType],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (periodId) params.set("periodId", periodId)
      params.set("type", evaluationType)

      const res = await fetch(
        `/api/companies/${companyId}/employees/${employeeId}/evaluation-items?${params}`
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "取得に失敗しました")
      }
      return res.json()
    },
    enabled: open,
  })

  // データをローカル状態に同期
  useEffect(() => {
    if (data) {
      if (evaluationType === "360" && "categories" in data) {
        setLocalCategories(data.categories || [])
      } else if ("items" in data) {
        setLocalItems(data.items || [])
      }
      setHasChanges(false)
    }
  }, [data, evaluationType])

  // 保存mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams()
      if (periodId) params.set("periodId", periodId)
      params.set("type", evaluationType)

      const body = evaluationType === "360"
        ? { categories: localCategories }
        : { items: localItems }

      const res = await fetch(
        `/api/companies/${companyId}/employees/${employeeId}/evaluation-items?${params}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "保存に失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["evaluationCustomItems", companyId, employeeId, periodId, evaluationType],
      })
      setHasChanges(false)
      onSaveComplete?.()
      onOpenChange(false)
    },
  })

  // テンプレートからリセット
  const resetMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams()
      if (periodId) params.set("periodId", periodId)
      params.set("type", evaluationType)

      // 既存項目を削除して再取得をトリガー
      await fetch(
        `/api/companies/${companyId}/employees/${employeeId}/evaluation-items?${params}`,
        {
          method: "DELETE",
        }
      )
      // 再取得
      await refetch()
    },
  })

  // ダイアログを閉じる際の処理
  const handleClose = () => {
    if (hasChanges) {
      setShowDiscardAlert(true)
    } else {
      onOpenChange(false)
    }
  }

  // === 個別評価用の操作 ===
  const addItem = () => {
    setLocalItems((prev) => [
      ...prev,
      {
        itemName: "",
        maxScore: 5,
        sortOrder: prev.length,
        isAdded: true,
        isCustomized: true,
      },
    ])
    setHasChanges(true)
  }

  const updateItem = (index: number, field: keyof CategoryItem, value: string | number | boolean) => {
    setLocalItems((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
        isCustomized: true,
      }
      return updated
    })
    setHasChanges(true)
  }

  const removeItem = (index: number) => {
    setLocalItems((prev) => {
      const updated = [...prev]
      if (updated[index].sourceTemplateItemId) {
        // テンプレート由来の場合は削除フラグ
        updated[index] = { ...updated[index], isDeleted: true }
      } else {
        // 追加項目は配列から削除
        return prev.filter((_, i) => i !== index)
      }
      return updated
    })
    setHasChanges(true)
  }

  const restoreItem = (index: number) => {
    setLocalItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], isDeleted: false }
      return updated
    })
    setHasChanges(true)
  }

  // === 360度評価用の操作 ===
  const addCategory = () => {
    setLocalCategories((prev) => [
      ...prev,
      {
        name: `カテゴリ${prev.length + 1}`,
        sortOrder: prev.length,
        items: [],
      },
    ])
    setHasChanges(true)
  }

  const updateCategory = (catIndex: number, name: string) => {
    setLocalCategories((prev) => {
      const updated = [...prev]
      updated[catIndex] = { ...updated[catIndex], name }
      return updated
    })
    setHasChanges(true)
  }

  const removeCategory = (catIndex: number) => {
    setLocalCategories((prev) => prev.filter((_, i) => i !== catIndex))
    setHasChanges(true)
  }

  const addCategoryItem = (catIndex: number) => {
    setLocalCategories((prev) => {
      const updated = [...prev]
      updated[catIndex].items.push({
        itemName: "",
        maxScore: 5,
        sortOrder: updated[catIndex].items.length,
        isAdded: true,
        isCustomized: true,
      })
      return updated
    })
    setHasChanges(true)
  }

  const updateCategoryItem = (
    catIndex: number,
    itemIndex: number,
    field: keyof CategoryItem,
    value: string | number | boolean
  ) => {
    setLocalCategories((prev) => {
      const updated = [...prev]
      updated[catIndex].items[itemIndex] = {
        ...updated[catIndex].items[itemIndex],
        [field]: value,
        isCustomized: true,
      }
      return updated
    })
    setHasChanges(true)
  }

  const removeCategoryItem = (catIndex: number, itemIndex: number) => {
    setLocalCategories((prev) => {
      const updated = [...prev]
      const item = updated[catIndex].items[itemIndex]
      if (item.sourceTemplateItemId) {
        updated[catIndex].items[itemIndex] = { ...item, isDeleted: true }
      } else {
        updated[catIndex].items = updated[catIndex].items.filter((_, i) => i !== itemIndex)
      }
      return updated
    })
    setHasChanges(true)
  }

  const restoreCategoryItem = (catIndex: number, itemIndex: number) => {
    setLocalCategories((prev) => {
      const updated = [...prev]
      updated[catIndex].items[itemIndex] = {
        ...updated[catIndex].items[itemIndex],
        isDeleted: false,
      }
      return updated
    })
    setHasChanges(true)
  }

  // 総項目数を計算
  const getTotalItemCount = () => {
    if (evaluationType === "360") {
      return localCategories.reduce(
        (sum, cat) => sum + cat.items.filter((i) => !i.isDeleted).length,
        0
      )
    }
    return localItems.filter((i) => !i.isDeleted).length
  }

  // 総満点を計算
  const getTotalMaxScore = () => {
    if (evaluationType === "360") {
      return localCategories.reduce(
        (sum, cat) =>
          sum + cat.items.filter((i) => !i.isDeleted).reduce((s, i) => s + i.maxScore, 0),
        0
      )
    }
    return localItems.filter((i) => !i.isDeleted).reduce((s, i) => s + i.maxScore, 0)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              {evaluationType === "360" ? "360度評価項目" : "個別評価項目"}のカスタマイズ
            </DialogTitle>
            <DialogDescription>
              {employeeName && <span className="font-medium">{employeeName}</span>}
              {employeeName && " - "}
              テンプレートをベースに、この従業員専用の評価項目を編集できます
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">
                <p>エラーが発生しました</p>
                <Button variant="outline" className="mt-2" onClick={() => refetch()}>
                  再読み込み
                </Button>
              </div>
            ) : (
              <>
                {/* サマリー */}
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span>
                      項目数: <strong>{getTotalItemCount()}</strong>
                    </span>
                    <span>
                      合計満点: <strong>{getTotalMaxScore()}点</strong>
                    </span>
                    {hasChanges && (
                      <Badge variant="secondary" className="text-amber-600">
                        未保存の変更あり
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetMutation.mutate()}
                    disabled={resetMutation.isPending}
                  >
                    {resetMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-1" />
                    )}
                    テンプレートからリセット
                  </Button>
                </div>

                {/* 360度評価の場合：カテゴリ付き */}
                {evaluationType === "360" ? (
                  <div className="space-y-4">
                    {localCategories.map((cat, catIndex) => (
                      <div key={catIndex} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 p-3 bg-muted/30">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Input
                            value={cat.name}
                            onChange={(e) => updateCategory(catIndex, e.target.value)}
                            className="font-semibold h-8"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeCategory(catIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">No</TableHead>
                              <TableHead>項目内容</TableHead>
                              <TableHead className="w-24">満点</TableHead>
                              <TableHead className="w-24">状態</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cat.items.map((item, itemIndex) => (
                              <TableRow
                                key={itemIndex}
                                className={item.isDeleted ? "opacity-50 bg-red-50" : ""}
                              >
                                <TableCell>{itemIndex + 1}</TableCell>
                                <TableCell>
                                  <Textarea
                                    value={item.itemName}
                                    onChange={(e) =>
                                      updateCategoryItem(catIndex, itemIndex, "itemName", e.target.value)
                                    }
                                    rows={2}
                                    disabled={item.isDeleted}
                                    className="resize-none"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={item.maxScore}
                                    onChange={(e) =>
                                      updateCategoryItem(
                                        catIndex,
                                        itemIndex,
                                        "maxScore",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    min={0}
                                    disabled={item.isDeleted}
                                    className="h-8"
                                  />
                                </TableCell>
                                <TableCell>
                                  {item.isAdded ? (
                                    <Badge variant="secondary" className="text-blue-600">
                                      追加
                                    </Badge>
                                  ) : item.isCustomized ? (
                                    <Badge variant="secondary" className="text-amber-600">
                                      編集済
                                    </Badge>
                                  ) : item.isDeleted ? (
                                    <Badge variant="secondary" className="text-red-600">
                                      削除
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">元のまま</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.isDeleted ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => restoreCategoryItem(catIndex, itemIndex)}
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => removeCategoryItem(catIndex, itemIndex)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="p-2 border-t bg-muted/20">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addCategoryItem(catIndex)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            項目を追加
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" onClick={addCategory}>
                      <Plus className="h-4 w-4 mr-1" />
                      カテゴリを追加
                    </Button>
                  </div>
                ) : (
                  /* 個別評価の場合：フラットなリスト */
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">No</TableHead>
                          <TableHead>評価項目</TableHead>
                          <TableHead className="w-24">満点</TableHead>
                          <TableHead className="w-24">状態</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {localItems.map((item, index) => (
                          <TableRow
                            key={index}
                            className={item.isDeleted ? "opacity-50 bg-red-50" : ""}
                          >
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              <Textarea
                                value={item.itemName}
                                onChange={(e) => updateItem(index, "itemName", e.target.value)}
                                rows={2}
                                disabled={item.isDeleted}
                                className="resize-none"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.maxScore}
                                onChange={(e) =>
                                  updateItem(index, "maxScore", parseInt(e.target.value) || 0)
                                }
                                min={0}
                                disabled={item.isDeleted}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              {item.isAdded ? (
                                <Badge variant="secondary" className="text-blue-600">
                                  追加
                                </Badge>
                              ) : item.isCustomized ? (
                                <Badge variant="secondary" className="text-amber-600">
                                  編集済
                                </Badge>
                              ) : item.isDeleted ? (
                                <Badge variant="secondary" className="text-red-600">
                                  削除
                                </Badge>
                              ) : (
                                <Badge variant="outline">元のまま</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.isDeleted ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => restoreItem(index)}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => removeItem(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="p-2 border-t bg-muted/20">
                      <Button variant="ghost" size="sm" onClick={addItem}>
                        <Plus className="h-4 w-4 mr-1" />
                        項目を追加
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={handleClose}>
              キャンセル
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasChanges}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  保存
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 破棄確認ダイアログ */}
      <AlertDialog open={showDiscardAlert} onOpenChange={setShowDiscardAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>変更を破棄しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              未保存の変更があります。閉じると変更は失われます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>編集を続ける</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDiscardAlert(false)
                onOpenChange(false)
              }}
            >
              破棄して閉じる
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
