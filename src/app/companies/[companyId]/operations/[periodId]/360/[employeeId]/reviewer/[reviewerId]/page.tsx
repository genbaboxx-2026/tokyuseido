"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Save,
  Send,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

export default function ReviewerInputPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()

  const companyId = params.companyId as string
  const periodId = params.periodId as string
  const employeeId = params.employeeId as string
  const reviewerId = params.reviewerId as string

  // ローカル状態 - 変更があった場合のみ値を持つ
  const [localScores, setLocalScores] = useState<Record<string, number | null> | null>(null)
  const [localComment, setLocalComment] = useState<string | null>(null)

  // データを取得
  const { data, isLoading, error } = useQuery({
    queryKey: ["reviewerScores", periodId, employeeId, reviewerId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/reviewer/${reviewerId}/scores`
      )
      if (!res.ok) throw new Error("データの取得に失敗しました")
      return res.json()
    },
  })

  // 実際に使用する値 - ローカル変更があればそれを、なければdataから取得
  const initialScoresFromData = data ? (() => {
    const s: Record<string, number | null> = {}
    for (const category of data.categories) {
      for (const item of category.items) {
        s[item.id] = item.score
      }
    }
    return s
  })() : {}

  const scores = localScores ?? initialScoresFromData
  const comment = localComment ?? (data?.assignment.comment || "")

  // setterラッパー
  const setScores = (value: Record<string, number | null> | ((prev: Record<string, number | null>) => Record<string, number | null>)) => {
    if (typeof value === "function") {
      setLocalScores(prev => value(prev ?? initialScoresFromData))
    } else {
      setLocalScores(value)
    }
  }
  const setComment = (value: string) => setLocalComment(value)

  // スコア保存
  const saveScoresMutation = useMutation({
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
      queryClient.invalidateQueries({
        queryKey: ["reviewerScores", periodId, employeeId, reviewerId],
      })
    },
  })

  // 提出
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
      router.push(`/companies/${companyId}/operations/${periodId}/360/${employeeId}`)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">データの取得に失敗しました</p>
        <Button variant="outline" onClick={() => router.back()}>
          戻る
        </Button>
      </div>
    )
  }

  const isSubmitted = data.assignment.status === "submitted"
  const isReadOnly = isSubmitted

  // 合計を計算
  const calculateCategoryTotal = (
    items: { id: string; maxScore: number }[]
  ) => {
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

  const calculateGrandTotal = () => {
    let total = 0
    let max = 0
    for (const category of data.categories) {
      const catTotal = calculateCategoryTotal(category.items)
      total += catTotal.total
      max += catTotal.max
    }
    return { total, max }
  }

  const grandTotal = calculateGrandTotal()

  // 全項目入力済みかチェック
  const allItemsScored = data.categories.every((cat: { items: { id: string }[] }) =>
    cat.items.every((item: { id: string }) => scores[item.id] !== null && scores[item.id] !== undefined)
  )

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link
            href={`/companies/${companyId}/operations/${periodId}/360/${employeeId}`}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            <h1 className="text-2xl font-bold">360度評価入力</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            被評価者: {data.record.employee.lastName} {data.record.employee.firstName}
            {data.record.employee.grade && ` (${data.record.employee.grade.name})`}
          </p>
          <p className="text-sm text-muted-foreground">
            評価者: {data.assignment.reviewer.lastName} {data.assignment.reviewer.firstName}
            {!isSubmitted && " の代理入力"}
          </p>
        </div>
        {isSubmitted && (
          <Badge className="bg-green-100 text-green-800">提出済み</Badge>
        )}
      </div>

      {/* カテゴリー別評価入力 */}
      {data.categories.map((category: {
        id: string
        name: string
        items: { id: string; content: string; maxScore: number; score: number | null }[]
      }) => {
        const catTotal = calculateCategoryTotal(category.items)

        return (
          <Card key={category.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{category.name}</CardTitle>
                <Badge variant="outline">
                  合計: {catTotal.total} / {catTotal.max}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
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
                  {category.items.map((item: { id: string; content: string; maxScore: number }, index: number) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="text-sm">{item.content}</TableCell>
                      <TableCell>{item.maxScore}</TableCell>
                      <TableCell>
                        {isReadOnly ? (
                          <Badge variant="outline" className="text-base">
                            {scores[item.id] !== null && scores[item.id] !== undefined
                              ? scores[item.id]
                              : "-"}
                          </Badge>
                        ) : (
                          <Select
                            value={
                              scores[item.id] !== null && scores[item.id] !== undefined
                                ? scores[item.id]!.toString()
                                : undefined
                            }
                            onValueChange={(v) =>
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
                              {/* マイナス値も許可（パワハラなど） */}
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
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}

      {/* 合計 */}
      <Card className="bg-blue-50">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">合計</span>
            <span className="text-2xl font-bold text-blue-600">
              {grandTotal.total} / {grandTotal.max}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* コメント */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">コメント</CardTitle>
          <CardDescription>
            被評価者へのフィードバックコメントを入力してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isReadOnly ? (
            <div className="bg-gray-50 rounded-lg p-4 min-h-[100px]">
              {comment || "（コメントなし）"}
            </div>
          ) : (
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="コメントを入力..."
            />
          )}
        </CardContent>
      </Card>

      {/* アクションボタン */}
      {!isReadOnly && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {allItemsScored
                  ? "✅ すべての項目が入力済みです"
                  : `⚠️ 未入力の項目があります`}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => saveScoresMutation.mutate()}
                  disabled={saveScoresMutation.isPending}
                >
                  {saveScoresMutation.isPending ? (
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 提出済みの場合 */}
      {isReadOnly && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-end">
              <Button variant="outline" asChild>
                <Link
                  href={`/companies/${companyId}/operations/${periodId}/360/${employeeId}`}
                >
                  戻る
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
