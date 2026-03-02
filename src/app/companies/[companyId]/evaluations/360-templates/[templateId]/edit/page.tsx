"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
import { FileText, X, Save, CheckCircle } from "lucide-react"
import type { Evaluation360TemplateResponse } from "@/types/evaluation"
import {
  type CategoryState,
  type Grade,
  type JobType,
  Eval360TemplateBasicInfo,
  Eval360TemplateTargetSelection,
  Eval360TemplateCategoryEditor,
} from "@/components/evaluations/eval360-template"

export default function Evaluation360TemplateEditPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const companyId = params.companyId as string
  const templateId = params.templateId as string

  const [name, setName] = useState("")
  const [status, setStatus] = useState<"draft" | "confirmed">("draft")
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([])
  const [selectedJobTypeIds, setSelectedJobTypeIds] = useState<string[]>([])
  const [categories, setCategories] = useState<CategoryState[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  // テンプレート詳細取得
  const { data: template, isLoading } = useQuery<Evaluation360TemplateResponse & { status?: "draft" | "confirmed" }>({
    queryKey: ["evaluation360Template", templateId],
    queryFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/evaluation-360-templates/${templateId}`
      )
      if (!res.ok) throw new Error("テンプレートの取得に失敗しました")
      return res.json()
    },
  })

  // 等級一覧取得
  const { data: gradesData } = useQuery<Grade[]>({
    queryKey: ["grades", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/grades?companyId=${companyId}`)
      if (!res.ok) return []
      return res.json()
    },
  })

  // 職種一覧取得
  const { data: jobTypesData } = useQuery<JobType[]>({
    queryKey: ["jobTypes", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/job-categories`)
      if (!res.ok) return []
      const data = await res.json()
      const jobTypes: JobType[] = []
      data.jobCategories?.forEach((cat: { jobTypes?: JobType[] }) => {
        cat.jobTypes?.forEach((jt) => {
          jobTypes.push({ id: jt.id, name: jt.name })
        })
      })
      return jobTypes
    },
  })

  // データを初期化
  useEffect(() => {
    if (template) {
      setName(template.name)
      setStatus(template.status || "draft")
      setSelectedGradeIds(template.grades.map((g) => g.id))
      setSelectedJobTypeIds(template.jobTypes?.map((jt) => jt.id) || [])
      setCategories(
        template.categories.map((cat) => ({
          ...cat,
          isExpanded: true,
          items: cat.items.map((item) => ({
            ...item,
            maxScore: item.maxScore ?? 5,
          })),
        }))
      )
    }
  }, [template])

  // 新規テンプレートの場合、等級・職種データが読み込まれたら全選択
  useEffect(() => {
    if (template && template.grades.length === 0 && gradesData && gradesData.length > 0) {
      setSelectedGradeIds(gradesData.map((g) => g.id))
    }
  }, [template, gradesData])

  useEffect(() => {
    if (template && (!template.jobTypes || template.jobTypes.length === 0) && jobTypesData && jobTypesData.length > 0) {
      setSelectedJobTypeIds(jobTypesData.map((jt) => jt.id))
    }
  }, [template, jobTypesData])

  // 変更検出
  useEffect(() => {
    if (!template) return

    const nameChanged = name !== template.name
    const gradeIdsChanged =
      JSON.stringify(selectedGradeIds.sort()) !==
      JSON.stringify(template.grades.map((g) => g.id).sort())
    const jobTypeIdsChanged =
      JSON.stringify(selectedJobTypeIds.sort()) !==
      JSON.stringify((template.jobTypes?.map((jt) => jt.id) || []).sort())
    const categoriesChanged =
      JSON.stringify(
        categories.map((c) => ({
          name: c.name,
          items: c.items.map((i) => ({ content: i.content, maxScore: i.maxScore })),
        }))
      ) !==
      JSON.stringify(
        template.categories.map((c) => ({
          name: c.name,
          items: c.items.map((i) => ({ content: i.content, maxScore: i.maxScore })),
        }))
      )

    setHasChanges(nameChanged || gradeIdsChanged || jobTypeIdsChanged || categoriesChanged)
  }, [name, selectedGradeIds, selectedJobTypeIds, categories, template])

  // 等級選択切り替え
  const handleGradeToggle = (gradeId: string) => {
    setSelectedGradeIds((prev) =>
      prev.includes(gradeId)
        ? prev.filter((id) => id !== gradeId)
        : [...prev, gradeId]
    )
  }

  // 職種選択切り替え
  const handleJobTypeToggle = (jobTypeId: string) => {
    setSelectedJobTypeIds((prev) =>
      prev.includes(jobTypeId)
        ? prev.filter((id) => id !== jobTypeId)
        : [...prev, jobTypeId]
    )
  }

  // 全等級選択
  const handleSelectAllGrades = () => {
    if (gradesData) {
      setSelectedGradeIds(gradesData.map((g) => g.id))
    }
  }

  // 全職種選択
  const handleSelectAllJobTypes = () => {
    if (jobTypesData) {
      setSelectedJobTypeIds(jobTypesData.map((jt) => jt.id))
    }
  }

  // カテゴリ追加
  const handleAddCategory = () => {
    const newCategory: CategoryState = {
      name: `カテゴリ${categories.length + 1}`,
      sortOrder: categories.length,
      items: [{ content: "", maxScore: 5, sortOrder: 0 }],
      isExpanded: true,
    }
    setCategories([...categories, newCategory])
  }

  // カテゴリ削除
  const handleRemoveCategory = (catIndex: number) => {
    if (categories.length <= 1) {
      alert("最低1つのカテゴリが必要です")
      return
    }
    setCategories(categories.filter((_, i) => i !== catIndex))
  }

  // カテゴリ名変更
  const handleCategoryNameChange = (catIndex: number, newName: string) => {
    const newCategories = [...categories]
    newCategories[catIndex].name = newName
    setCategories(newCategories)
  }

  // カテゴリ展開/折りたたみ
  const handleToggleCategory = (catIndex: number) => {
    const newCategories = [...categories]
    newCategories[catIndex].isExpanded = !newCategories[catIndex].isExpanded
    setCategories(newCategories)
  }

  // 項目追加
  const handleAddItem = (catIndex: number) => {
    const newCategories = [...categories]
    const currentItems = newCategories[catIndex].items
    newCategories[catIndex].items = [
      ...currentItems,
      { content: "", maxScore: 5, sortOrder: currentItems.length },
    ]
    setCategories(newCategories)
  }

  // 項目削除
  const handleRemoveItem = (catIndex: number, itemIndex: number) => {
    const newCategories = [...categories]
    if (newCategories[catIndex].items.length <= 1) {
      alert("最低1つの項目が必要です")
      return
    }
    newCategories[catIndex].items = newCategories[catIndex].items.filter(
      (_, i) => i !== itemIndex
    )
    setCategories(newCategories)
  }

  // 項目内容変更
  const handleItemContentChange = (
    catIndex: number,
    itemIndex: number,
    newContent: string
  ) => {
    const newCategories = [...categories]
    newCategories[catIndex].items[itemIndex].content = newContent
    setCategories(newCategories)
  }

  // 項目満点変更
  const handleItemMaxScoreChange = (
    catIndex: number,
    itemIndex: number,
    newMaxScore: number
  ) => {
    const newCategories = [...categories]
    newCategories[catIndex].items[itemIndex].maxScore = newMaxScore
    setCategories(newCategories)
  }

  // バリデーション
  const validate = (forConfirm: boolean = false): string | null => {
    if (forConfirm) {
      if (!name.trim()) {
        return "テンプレート名を入力してください"
      }
      if (selectedGradeIds.length === 0) {
        return "対象等級を選択してください"
      }
      if (selectedJobTypeIds.length === 0) {
        return "対象職種を選択してください"
      }
      if (categories.length === 0) {
        return "カテゴリを追加してください"
      }
      const emptyCategory = categories.find((c) => !c.name.trim())
      if (emptyCategory) {
        return "カテゴリ名を入力してください"
      }
      for (const cat of categories) {
        const emptyItem = cat.items.find((i) => !i.content.trim())
        if (emptyItem) {
          return `「${cat.name}」カテゴリに空の項目があります`
        }
      }
    }
    return null
  }

  // 保存処理（下書き保存）
  const handleSave = async () => {
    setIsSaving(true)
    try {
      // 基本情報の更新
      const basicRes = await fetch(
        `/api/companies/${companyId}/evaluation-360-templates/${templateId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            status: "draft",
            gradeIds: selectedGradeIds,
            jobTypeIds: selectedJobTypeIds,
          }),
        }
      )

      if (!basicRes.ok) {
        const error = await basicRes.json()
        throw new Error(error.error || "基本情報の更新に失敗しました")
      }

      // カテゴリ/項目の更新
      if (categories.length > 0) {
        const contentRes = await fetch(
          `/api/companies/${companyId}/evaluation-360-templates/${templateId}/content`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categories: categories.map((cat, catIndex) => ({
                name: cat.name,
                sortOrder: catIndex,
                items: cat.items.map((item, itemIndex) => ({
                  content: item.content,
                  maxScore: item.maxScore,
                  sortOrder: itemIndex,
                })),
              })),
            }),
          }
        )

        if (!contentRes.ok) {
          const error = await contentRes.json()
          throw new Error(error.error || "コンテンツの更新に失敗しました")
        }
      }

      // クエリを無効化して再取得
      queryClient.invalidateQueries({ queryKey: ["evaluation360Template", templateId] })
      queryClient.invalidateQueries({ queryKey: ["evaluation360Templates", companyId] })

      setHasChanges(false)
      setStatus("draft")
    } catch (error) {
      console.error("保存エラー:", error)
      alert(error instanceof Error ? error.message : "保存に失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  // 確定処理
  const handleConfirm = async () => {
    const validationError = validate(true)
    if (validationError) {
      alert(validationError)
      return
    }
    setShowConfirmDialog(true)
  }

  const confirmAndSave = async () => {
    setShowConfirmDialog(false)
    setIsConfirming(true)
    try {
      // 基本情報の更新（status=confirmed）
      const basicRes = await fetch(
        `/api/companies/${companyId}/evaluation-360-templates/${templateId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            status: "confirmed",
            gradeIds: selectedGradeIds,
            jobTypeIds: selectedJobTypeIds,
          }),
        }
      )

      if (!basicRes.ok) {
        const error = await basicRes.json()
        throw new Error(error.error || "基本情報の更新に失敗しました")
      }

      // カテゴリ/項目の更新
      const contentRes = await fetch(
        `/api/companies/${companyId}/evaluation-360-templates/${templateId}/content`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: categories.map((cat, catIndex) => ({
              name: cat.name,
              sortOrder: catIndex,
              items: cat.items.map((item, itemIndex) => ({
                content: item.content,
                maxScore: item.maxScore,
                sortOrder: itemIndex,
              })),
            })),
          }),
        }
      )

      if (!contentRes.ok) {
        const error = await contentRes.json()
        throw new Error(error.error || "コンテンツの更新に失敗しました")
      }

      // クエリを無効化
      queryClient.invalidateQueries({ queryKey: ["evaluation360Template", templateId] })
      queryClient.invalidateQueries({ queryKey: ["evaluation360Templates", companyId] })

      setHasChanges(false)
      setStatus("confirmed")
      router.push(`/companies/${companyId}/evaluations`)
    } catch (error) {
      console.error("確定エラー:", error)
      alert(error instanceof Error ? error.message : "確定に失敗しました")
    } finally {
      setIsConfirming(false)
    }
  }

  // 閉じる処理
  const handleClose = () => {
    if (hasChanges) {
      setShowUnsavedDialog(true)
    } else {
      router.push(`/companies/${companyId}/evaluations`)
    }
  }

  const handleConfirmLeave = () => {
    setShowUnsavedDialog(false)
    router.push(`/companies/${companyId}/evaluations`)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8 text-muted-foreground">
          テンプレートが見つかりません
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            テンプレート編集
            <Badge variant={status === "confirmed" ? "default" : "secondary"}>
              {status === "confirmed" ? "確定" : "下書き"}
            </Badge>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            閉じる
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "保存中..." : "保存"}
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirming || status === "confirmed"}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {isConfirming ? "確定中..." : "これで確定"}
          </Button>
        </div>
      </div>

      {/* テンプレート名 */}
      <Eval360TemplateBasicInfo
        name={name}
        onNameChange={setName}
      />

      {/* 評価カテゴリ・項目 */}
      <Eval360TemplateCategoryEditor
        categories={categories}
        onAddCategory={handleAddCategory}
        onRemoveCategory={handleRemoveCategory}
        onCategoryNameChange={handleCategoryNameChange}
        onToggleCategory={handleToggleCategory}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onItemContentChange={handleItemContentChange}
        onItemMaxScoreChange={handleItemMaxScoreChange}
      />

      {/* 対象等級・職種 */}
      <Eval360TemplateTargetSelection
        grades={gradesData}
        selectedGradeIds={selectedGradeIds}
        onGradeToggle={handleGradeToggle}
        onSelectAllGrades={handleSelectAllGrades}
        jobTypes={jobTypesData}
        selectedJobTypeIds={selectedJobTypeIds}
        onJobTypeToggle={handleJobTypeToggle}
        onSelectAllJobTypes={handleSelectAllJobTypes}
      />

      {/* 未保存の変更確認ダイアログ */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>変更を破棄しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              保存されていない変更があります。このまま戻ると変更が失われます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave}>
              変更を破棄
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 確定確認ダイアログ */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テンプレートを確定しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              確定すると、このテンプレートは評価に使用できるようになります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSave}>
              確定する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
