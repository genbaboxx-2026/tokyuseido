"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Loader2, Save, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

interface Eval360InputModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  periodId: string
  employeeId: string
  reviewerId: string
  employeeName: string
  reviewerName: string
  onSaved: () => void
}

interface CategoryWithItems {
  id: string
  name: string
  items: {
    id: string
    content: string
    maxScore: number
    score: number | null
  }[]
}

interface ScoresData {
  categories: CategoryWithItems[]
  assignment: {
    comment: string | null
    status: string
  }
}

export function Eval360InputModal({
  open,
  onOpenChange,
  companyId,
  periodId,
  employeeId,
  reviewerId,
  employeeName,
  reviewerName,
  onSaved,
}: Eval360InputModalProps) {
  const [scores, setScores] = useState<Record<string, number | null>>({})
  const [comment, setComment] = useState("")
  const [isInitialized, setIsInitialized] = useState(false)

  // スコアデータを取得
  const { data, isLoading } = useQuery<ScoresData>({
    queryKey: ["360ReviewerScores", periodId, employeeId, reviewerId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/reviewer/${reviewerId}/scores`
      )
      if (!res.ok) throw new Error("データの取得に失敗しました")
      return res.json()
    },
    enabled: open,
  })

  // 初期値を設定
  useEffect(() => {
    if (data && !isInitialized) {
      const initialScores: Record<string, number | null> = {}
      for (const category of data.categories) {
        for (const item of category.items) {
          initialScores[item.id] = item.score
        }
      }
      setScores(initialScores)
      setComment(data.assignment.comment || "")
      setIsInitialized(true)
    }
  }, [data, isInitialized])

  // モーダルが閉じたら状態をリセット
  useEffect(() => {
    if (!open) {
      setIsInitialized(false)
      setScores({})
      setComment("")
    }
  }, [open])

  // スコア保存mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const scoreArray = Object.entries(scores)
        .filter(([_, score]) => score !== null)
        .map(([itemId, score]) => ({ itemId, score: score as number }))

      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/reviewer/${reviewerId}/scores`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scores: scoreArray, comment }),
        }
      )
      if (!res.ok) throw new Error("保存に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      onSaved()
    },
  })

  // 提出mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      // まずスコアを保存
      const scoreArray = Object.entries(scores)
        .filter(([_, score]) => score !== null)
        .map(([itemId, score]) => ({ itemId, score: score as number }))

      await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/reviewer/${reviewerId}/scores`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scores: scoreArray, comment }),
        }
      )

      // 提出
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/reviewer/${reviewerId}/submit`,
        { method: "POST" }
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "提出に失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  // カテゴリーごとの合計を計算
  const calculateCategoryTotal = (items: { id: string; maxScore: number }[]) => {
    let total = 0
    let max = 0
    for (const item of items) {
      if (scores[item.id] !== null && scores[item.id] !== undefined) {
        total += scores[item.id] as number
      }
      max += item.maxScore
    }
    return { total, max }
  }

  // 全体合計を計算
  const calculateGrandTotal = () => {
    if (!data) return { total: 0, max: 0 }
    let total = 0
    let max = 0
    for (const category of data.categories) {
      const catTotal = calculateCategoryTotal(category.items)
      total += catTotal.total
      max += catTotal.max
    }
    return { total, max }
  }

  // 全項目入力済みかチェック
  const allItemsScored = data?.categories.every((cat) =>
    cat.items.every((item) => scores[item.id] !== null && scores[item.id] !== undefined)
  ) ?? false

  const grandTotal = calculateGrandTotal()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>代理入力 - 360度評価</DialogTitle>
          <DialogDescription>
            被評価者: {employeeName} / 評価者: {reviewerName} の代理入力
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* カテゴリー別評価入力 */}
            {data.categories.map((category) => {
              const catTotal = calculateCategoryTotal(category.items)

              return (
                <div key={category.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{category.name}</h4>
                    <Badge variant="outline">
                      合計: {catTotal.total} / {catTotal.max}
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">No</TableHead>
                        <TableHead>項目</TableHead>
                        <TableHead className="w-[80px]">満点</TableHead>
                        <TableHead className="w-[120px]">評価点</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {category.items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="text-sm">{item.content}</TableCell>
                          <TableCell>{item.maxScore}</TableCell>
                          <TableCell>
                            <Select
                              value={
                                scores[item.id] !== null && scores[item.id] !== undefined
                                  ? scores[item.id]!.toString()
                                  : undefined
                              }
                              onValueChange={(v: string) =>
                                setScores((prev) => ({
                                  ...prev,
                                  [item.id]: parseInt(v),
                                }))
                              }
                            >
                              <SelectTrigger className="w-[100px]">
                                <SelectValue placeholder="選択" />
                              </SelectTrigger>
                              <SelectContent>
                                {/* マイナス値も許可（パワハラなど maxScore=0 の場合） */}
                                {item.maxScore === 0 ? (
                                  <>
                                    {[-10, -5, -3, -2, -1, 0].map((v) => (
                                      <SelectItem key={v} value={v.toString()}>
                                        {v}
                                      </SelectItem>
                                    ))}
                                  </>
                                ) : (
                                  <>
                                    {Array.from(
                                      { length: item.maxScore + 1 },
                                      (_, i) => i
                                    ).map((v) => (
                                      <SelectItem key={v} value={v.toString()}>
                                        {v}
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            })}

            {/* 全体合計 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">合計</span>
                <span className="text-xl font-bold text-blue-600">
                  {grandTotal.total} / {grandTotal.max}
                </span>
              </div>
            </div>

            {/* コメント */}
            <div className="space-y-2">
              <Label>コメント</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="コメントを入力..."
              />
            </div>

            {/* 入力状況 */}
            <div className="text-sm text-muted-foreground">
              {allItemsScored
                ? "✅ すべての項目が入力済みです"
                : `⚠️ 未入力の項目があります`}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            一時保存
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={!allItemsScored || submitMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                評価を提出
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>評価を提出しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  提出後は管理者による再入力依頼がない限り編集できません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={() => submitMutation.mutate()}>
                  提出する
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
