"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Copy,
} from "lucide-react"
import type { Evaluation360TemplateSummary } from "@/types/evaluation"

interface TemplateCategory {
  id: string
  name: string
  sortOrder: number
  items: {
    id: string
    content: string
    maxScore: number
    sortOrder: number
  }[]
}

interface FullTemplate extends Evaluation360TemplateSummary {
  categories: TemplateCategory[]
}

interface Evaluation360TemplateResponse {
  templates: FullTemplate[]
  total: number
}

export default function Evaluation360TemplateSection({
  companyId,
}: {
  companyId: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  // テンプレート一覧取得
  const { data, isLoading, refetch } = useQuery<Evaluation360TemplateResponse>({
    queryKey: ["evaluation360Templates", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/evaluation-360-templates`)
      if (!res.ok) {
        if (res.status === 404) return { templates: [], total: 0 }
        throw new Error("テンプレートの取得に失敗しました")
      }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  // 削除ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(
        `/api/companies/${companyId}/evaluation-360-templates/${templateId}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "削除に失敗しました")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Templates", companyId] })
      setDeleteTargetId(null)
    },
    onError: (error) => {
      console.error("テンプレート削除エラー:", error)
      alert(error instanceof Error ? error.message : "削除に失敗しました")
    },
  })

  // 複製ミューテーション
  const duplicateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(
        `/api/companies/${companyId}/evaluation-360-templates/${templateId}/duplicate`,
        { method: "POST" }
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "複製に失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation360Templates", companyId] })
      setDuplicatingId(null)
    },
    onError: (error) => {
      console.error("テンプレート複製エラー:", error)
      alert(error instanceof Error ? error.message : "複製に失敗しました")
      setDuplicatingId(null)
    },
  })

  // 新規作成（空テンプレートを作成して編集画面に遷移）
  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/evaluation-360-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "作成に失敗しました")
      }

      const template = await res.json()
      // キャッシュを無効化してから遷移
      await queryClient.invalidateQueries({ queryKey: ["evaluation360Templates", companyId] })
      router.push(`/companies/${companyId}/evaluations/360-templates/${template.id}/edit`)
    } catch (error) {
      console.error("テンプレート作成エラー:", error)
      alert(error instanceof Error ? error.message : "作成に失敗しました")
    } finally {
      setIsCreating(false)
    }
  }

  const handleEdit = (templateId: string) => {
    router.push(`/companies/${companyId}/evaluations/360-templates/${templateId}/edit`)
  }

  const handleDuplicate = (templateId: string) => {
    // 二重クリック防止
    if (duplicatingId) return
    setDuplicatingId(templateId)
    duplicateMutation.mutate(templateId)
  }

  const handleDelete = (templateId: string) => {
    setDeleteTargetId(templateId)
  }

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId)
    }
  }

  // 空のテンプレート（保存されていないもの）は非表示
  // カテゴリがあるか、名前が設定されている場合のみ表示
  const templates = (data?.templates || []).filter(
    (t) => t.categoriesCount > 0 || (t.name && t.name.trim() !== "")
  )

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                360度評価テンプレート
              </CardTitle>
              <CardDescription>
                360度評価で使用するテンプレートを管理します
              </CardDescription>
            </div>
            <Button onClick={handleCreate} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? "作成中..." : "新規作成"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              読み込み中...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>テンプレートがありません</p>
              <p className="text-sm mt-1">
                「新規作成」ボタンからテンプレートを作成してください
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => {
                const totalScore = template.categories.reduce(
                  (sum, cat) => sum + cat.items.reduce((s, item) => s + item.maxScore, 0),
                  0
                )

                return (
                  <div key={template.id} className="border rounded-lg overflow-hidden">
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between p-4 bg-muted/30">
                      <div className="flex-1 min-w-0">
                        {/* テンプレート名（1行目、太字） */}
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-bold text-base truncate">
                            {template.name || "(名前未設定)"}
                          </p>
                          {/* ステータスバッジ */}
                          <Badge variant={template.status === "confirmed" ? "default" : "secondary"}>
                            {template.status === "confirmed" ? "✅ 確定" : "📝 下書き"}
                          </Badge>
                        </div>
                        {/* 対象等級・職種（2行目） */}
                        <div className="space-y-1">
                          <p className="text-sm">
                            <span className="text-muted-foreground">対象等級: </span>
                            <span className="font-medium">
                              {template.grades.length > 0
                                ? [...template.grades].sort((a, b) => (b.level ?? 0) - (a.level ?? 0)).map((g) => g.name).join(", ")
                                : "(未設定)"}
                            </span>
                          </p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">対象職種: </span>
                            <span className="font-medium">
                              {template.jobTypes && template.jobTypes.length > 0
                                ? template.jobTypes.map((jt) => jt.name).join(", ")
                                : "(未設定)"}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-sm text-muted-foreground">
                          {template.categoriesCount}カテゴリ / {template.itemsCount}項目 / 満点{totalScore}点
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(template.id)}
                            disabled={duplicatingId !== null}
                            title="複製"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template.id)}
                            title="編集"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(template.id)}
                            title="削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTargetId} onOpenChange={() => setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テンプレートを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。テンプレートと関連するすべてのカテゴリ・項目が削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
