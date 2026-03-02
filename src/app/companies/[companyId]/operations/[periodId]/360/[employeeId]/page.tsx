"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Send,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  Lock,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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

import dynamic from "next/dynamic"
import {
  type Evaluation360Status,
  type CategoryType,
  statusConfig,
} from "@/components/operations/evaluation360/Evaluation360Types"
import { PhasesStepper } from "@/components/operations/evaluation360/PhasesStepper"

// 大きなコンポーネントを遅延読み込み
const ReviewerSelectDialog = dynamic(
  () => import("@/components/operations/evaluation360/ReviewerSelectDialog").then((mod) => mod.ReviewerSelectDialog),
  { ssr: false }
)
const ItemsPreparationCard = dynamic(
  () => import("@/components/operations/evaluation360/ItemsPreparationCard").then((mod) => mod.ItemsPreparationCard),
  { ssr: false }
)
const CollectionStatusCard = dynamic(
  () => import("@/components/operations/evaluation360/CollectionStatusCard").then((mod) => mod.CollectionStatusCard),
  { ssr: false }
)
const AggregationResultCard = dynamic(
  () => import("@/components/operations/evaluation360/AggregationResultCard").then((mod) => mod.AggregationResultCard),
  { ssr: false }
)

export default function Evaluation360WorkflowPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()

  const companyId = params.companyId as string
  const periodId = params.periodId as string
  const employeeId = params.employeeId as string

  // ローカル状態
  const [localCategories, setLocalCategories] = useState<CategoryType[] | null>(null)
  const [localReviewerIds, setLocalReviewerIds] = useState<string[] | null>(null)
  const [localIsAnonymous, setLocalIsAnonymous] = useState<boolean | null>(null)
  const [localEvaluationMethod, setLocalEvaluationMethod] = useState<"web" | "paper" | null>(null)
  const [reviewerDialogOpen, setReviewerDialogOpen] = useState(false)

  // レコード詳細を取得
  const { data: record, isLoading, error } = useQuery({
    queryKey: ["evaluation360Record", periodId, employeeId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}`
      )
      if (!res.ok) throw new Error("レコードの取得に失敗しました")
      return res.json()
    },
  })

  // 集計結果を取得
  const { data: summary } = useQuery({
    queryKey: ["evaluation360Summary", periodId, employeeId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/summary`
      )
      if (!res.ok) throw new Error("集計結果の取得に失敗しました")
      return res.json()
    },
    enabled: !!record && (record.status === "aggregated" || record.status === "completed"),
  })

  // 実際に使用する値
  const categories: CategoryType[] = localCategories ?? (record?.categories?.map((cat: { id: string; name: string; sortOrder: number; description?: string | null; items: { id: string; content: string; maxScore: number; sortOrder: number }[] }) => ({
    id: cat.id,
    name: cat.name,
    sortOrder: cat.sortOrder,
    description: cat.description,
    items: cat.items.map((item: { id: string; content: string; maxScore: number; sortOrder: number }) => ({
      id: item.id,
      content: item.content,
      maxScore: item.maxScore,
      sortOrder: item.sortOrder,
    })),
  })) || [])

  const selectedReviewerIds = localReviewerIds ?? (record?.reviewerAssignments?.map((ra: { reviewerId: string }) => ra.reviewerId) || [])
  const isAnonymous = localIsAnonymous ?? (record?.isAnonymous ?? true)
  const evaluationMethod = localEvaluationMethod ?? (record?.evaluationMethod || "web")

  // setterラッパー
  const setCategories = (value: CategoryType[] | ((prev: CategoryType[]) => CategoryType[])) => {
    if (typeof value === "function") {
      setLocalCategories(value(categories))
    } else {
      setLocalCategories(value)
    }
  }
  const setSelectedReviewerIds = (value: string[] | ((prev: string[]) => string[])) => {
    if (typeof value === "function") {
      setLocalReviewerIds(value(selectedReviewerIds))
    } else {
      setLocalReviewerIds(value)
    }
  }
  const setIsAnonymous = (value: boolean) => setLocalIsAnonymous(value)
  const setEvaluationMethod = (value: "web" | "paper") => setLocalEvaluationMethod(value)

  // Mutations
  const generateItemsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/generate-items`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("生成に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Record", periodId, employeeId] })
      setLocalCategories(null)
    },
  })

  const copyPreviousMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/copy-previous`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("コピーに失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Record", periodId, employeeId] })
      setLocalCategories(null)
    },
  })

  const saveItemsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/items`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories }),
        }
      )
      if (!res.ok) throw new Error("保存に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Record", periodId, employeeId] })
    },
  })

  const saveReviewersMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/reviewers`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewerIds: selectedReviewerIds,
            isAnonymous,
            evaluationMethod,
          }),
        }
      )
      if (!res.ok) throw new Error("保存に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Record", periodId, employeeId] })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: Evaluation360Status) => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "更新に失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Record", periodId, employeeId] })
    },
  })

  const distributeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/distribute`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("配布に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Record", periodId, employeeId] })
    },
  })

  const aggregateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/aggregate`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("集計に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Record", periodId, employeeId] })
    },
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/360/${employeeId}/complete`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("確定に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Record", periodId, employeeId] })
    },
  })

  // カテゴリー操作
  const addCategory = () => {
    setCategories((prev) => [
      ...prev,
      { name: `カテゴリー${prev.length + 1}`, sortOrder: prev.length, items: [] },
    ])
  }

  const updateCategory = (index: number, field: string, value: string) => {
    setCategories((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index))
  }

  const addItem = (categoryIndex: number) => {
    setCategories((prev) => {
      const updated = [...prev]
      updated[categoryIndex].items.push({
        content: "",
        maxScore: 5,
        sortOrder: updated[categoryIndex].items.length,
      })
      return updated
    })
  }

  const updateItem = (categoryIndex: number, itemIndex: number, field: string, value: string | number) => {
    setCategories((prev) => {
      const updated = [...prev]
      updated[categoryIndex].items[itemIndex] = {
        ...updated[categoryIndex].items[itemIndex],
        [field]: value,
      }
      return updated
    })
  }

  const removeItem = (categoryIndex: number, itemIndex: number) => {
    setCategories((prev) => {
      const updated = [...prev]
      updated[categoryIndex].items = updated[categoryIndex].items.filter((_, i) => i !== itemIndex)
      return updated
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">レコードの取得に失敗しました</p>
        <Button variant="outline" onClick={() => router.back()}>
          戻る
        </Button>
      </div>
    )
  }

  const currentStatus = record.status as Evaluation360Status
  const currentConfig = statusConfig[currentStatus]
  const StatusIcon = currentConfig.icon

  const totalReviewers = record.reviewerAssignments?.length || 0
  const submittedCount = record.reviewerAssignments?.filter(
    (ra: { status: string }) => ra.status === "submitted"
  ).length || 0
  const progressPercent = totalReviewers > 0 ? (submittedCount / totalReviewers) * 100 : 0

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${companyId}/operations/${periodId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            <h1 className="text-2xl font-bold">
              {record.employee?.lastName} {record.employee?.firstName}
            </h1>
            <Badge variant="outline">360度評価</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            {record.employee?.department && <span>{record.employee.department.name}</span>}
            {record.employee?.grade && (
              <>
                <span>·</span>
                <span>{record.employee.grade.name}</span>
              </>
            )}
            {record.employee?.jobType && (
              <>
                <span>·</span>
                <span>{record.employee.jobType.name}</span>
              </>
            )}
          </div>
        </div>
        <Badge className={`${currentConfig.bgColor} ${currentConfig.color}`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {currentConfig.label}
        </Badge>
      </div>

      {/* フェーズステッパー */}
      <Card>
        <CardContent className="pt-6">
          <PhasesStepper currentStatus={currentStatus} />
        </CardContent>
      </Card>

      {/* 現在のフェーズ説明 */}
      <Card className={`border-l-4 ${currentConfig.color.replace("text-", "border-")}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <StatusIcon className={`h-5 w-5 ${currentConfig.color}`} />
            {currentConfig.label}フェーズ
            {currentStatus === "completed" && (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>{currentConfig.description}</CardDescription>
        </CardHeader>
        {totalReviewers > 0 && (
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">回収進捗:</span>
              <Progress value={progressPercent} className="flex-1" />
              <Badge variant={submittedCount === totalReviewers ? "default" : "secondary"}>
                {submittedCount}/{totalReviewers}
              </Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {/* draft / preparing_items: 評価項目準備 */}
      {(currentStatus === "draft" || currentStatus === "preparing_items") && (
        <ItemsPreparationCard
          categories={categories}
          isGenerating={generateItemsMutation.isPending}
          isCopying={copyPreviousMutation.isPending}
          isSaving={saveItemsMutation.isPending}
          onGenerate={() => generateItemsMutation.mutate()}
          onCopyPrevious={() => copyPreviousMutation.mutate()}
          onAddCategory={addCategory}
          onUpdateCategory={updateCategory}
          onRemoveCategory={removeCategory}
          onAddItem={addItem}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onSave={() => saveItemsMutation.mutate()}
          onConfirmAndProceed={async () => {
            await saveItemsMutation.mutateAsync()
            await updateStatusMutation.mutateAsync("preparing_reviewers")
          }}
        />
      )}

      {/* preparing_reviewers: 評価者選定 */}
      {currentStatus === "preparing_reviewers" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">評価者選定</CardTitle>
            <CardDescription>評価者を選択し、匿名設定を行います</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>評価者リスト</Label>
                <Button variant="outline" size="sm" onClick={() => setReviewerDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  評価者を追加
                </Button>
              </div>

              {selectedReviewerIds.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>評価者</TableHead>
                      <TableHead>部署</TableHead>
                      <TableHead>等級</TableHead>
                      <TableHead>担当数</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {record.reviewerAssignments?.map((ra: {
                      id: string
                      reviewerId: string
                      reviewer: { firstName: string; lastName: string; department?: { name: string }; grade?: { name: string } }
                      totalLoad: number
                      loadLevel: string
                    }, index: number) => (
                      <TableRow key={ra.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{ra.reviewer.lastName} {ra.reviewer.firstName}</TableCell>
                        <TableCell>{ra.reviewer.department?.name || "-"}</TableCell>
                        <TableCell>{ra.reviewer.grade?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              ra.loadLevel === "green" ? "bg-green-100 text-green-800" :
                              ra.loadLevel === "yellow" ? "bg-yellow-100 text-yellow-800" :
                              "bg-red-100 text-red-800"
                            }
                          >
                            {ra.totalLoad}人
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedReviewerIds((prev) => prev.filter((id) => id !== ra.reviewerId))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  評価者が選択されていません
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label>匿名設定</Label>
                <RadioGroup
                  value={isAnonymous ? "anonymous" : "named"}
                  onValueChange={(v: string) => setIsAnonymous(v === "anonymous")}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="anonymous" id="anonymous" />
                    <label htmlFor="anonymous" className="text-sm">匿名（推奨）</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="named" id="named" />
                    <label htmlFor="named" className="text-sm">記名</label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>評価方法</Label>
                <RadioGroup
                  value={evaluationMethod}
                  onValueChange={(v: string) => setEvaluationMethod(v as "web" | "paper")}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="web" id="web" />
                    <label htmlFor="web" className="text-sm">Web入力</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="paper" id="paper" />
                    <label htmlFor="paper" className="text-sm">紙入力</label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => updateStatusMutation.mutate("preparing_items")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                項目編集に戻る
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => saveReviewersMutation.mutate()}
                  disabled={saveReviewersMutation.isPending}
                >
                  {saveReviewersMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  下書き保存
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={selectedReviewerIds.length === 0}>
                      選定完了
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>評価者選定を完了しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        {selectedReviewerIds.length}人の評価者を設定します。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          await saveReviewersMutation.mutateAsync()
                          await updateStatusMutation.mutateAsync("ready")
                        }}
                      >
                        完了
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ready: 配布可能 */}
      {currentStatus === "ready" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">配布準備完了</CardTitle>
            <CardDescription>評価項目と評価者の設定が完了しました。配布を開始できます。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">評価項目数</p>
                <p className="text-2xl font-bold">
                  {categories.reduce((sum, cat) => sum + cat.items.length, 0)}項目
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">評価者数</p>
                <p className="text-2xl font-bold">{totalReviewers}人</p>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => updateStatusMutation.mutate("preparing_items")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                準備に戻す
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Send className="h-4 w-4 mr-2" />
                    配布する
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>配布を開始しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      {totalReviewers}人の評価者に評価シートを配布します。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={() => distributeMutation.mutate()}>
                      配布開始
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* distributing / collecting: 配布・回収中 */}
      {(currentStatus === "distributing" || currentStatus === "collecting") && (
        <CollectionStatusCard
          currentStatus={currentStatus}
          reviewerAssignments={record.reviewerAssignments || []}
          submittedCount={submittedCount}
          totalReviewers={totalReviewers}
          companyId={companyId}
          periodId={periodId}
          employeeId={employeeId}
          onAggregate={() => aggregateMutation.mutate()}
        />
      )}

      {/* aggregated / completed: 集計・完了 */}
      {(currentStatus === "aggregated" || currentStatus === "completed") && summary && (
        <AggregationResultCard
          currentStatus={currentStatus}
          summary={summary}
          companyId={companyId}
          periodId={periodId}
          onReaggregate={() => updateStatusMutation.mutate("collecting")}
          onComplete={() => completeMutation.mutate()}
        />
      )}

      {/* 評価者選択ダイアログ */}
      <ReviewerSelectDialog
        open={reviewerDialogOpen}
        onOpenChange={setReviewerDialogOpen}
        companyId={companyId}
        excludeEmployeeId={employeeId}
        selectedIds={selectedReviewerIds}
        onSelect={(ids) => setSelectedReviewerIds(ids)}
      />
    </div>
  )
}
