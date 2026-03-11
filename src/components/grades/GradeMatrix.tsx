"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Check, Save, Loader2, Plus, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { GRADE_UI_TEXT } from "@/lib/grade/constants"
import { cn } from "@/lib/utils"

const gradeCreateSchema = z.object({
  name: z.string().min(1, "等級名は必須です").max(50, "等級名は50文字以内で入力してください"),
})

type GradeCreateForm = z.infer<typeof gradeCreateSchema>

interface JobType {
  id: string
  name: string
}

interface JobCategory {
  id: string
  name: string
  jobTypes: JobType[]
}

interface Grade {
  id: string
  name: string
  level: number
  employmentType: "FULL_TIME" | "CONTRACT" | "OUTSOURCE" | "PART_TIME"
  isManagement: boolean
}

interface MatrixCell {
  jobType: JobType
  jobCategory: { id: string; name: string }
  config: {
    id: string
    isEnabled: boolean
  } | null
  isEnabled: boolean
  hasRole: boolean
}

interface MatrixRow {
  grade: Grade
  jobTypes: MatrixCell[]
}

interface GradeMatrixProps {
  matrix: MatrixRow[]
  jobCategories: JobCategory[]
  companyId: string
}

export function GradeMatrix({ matrix, jobCategories, companyId }: GradeMatrixProps) {
  const router = useRouter()
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // 等級削除関連の状態
  const [deleteTargetGrade, setDeleteTargetGrade] = useState<Grade | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // 職種削除関連の状態
  const [deleteTargetJobType, setDeleteTargetJobType] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingJobType, setIsDeletingJobType] = useState(false)
  const [deleteJobTypeError, setDeleteJobTypeError] = useState<string | null>(null)

  // indeterminateチェックボックス用のref
  const categoryCheckboxRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

  const form = useForm<GradeCreateForm>({
    resolver: zodResolver(gradeCreateSchema),
    defaultValues: {
      name: "",
    },
  })

  const openAddDialog = () => {
    form.reset()
    setCreateError(null)
    setIsAddDialogOpen(true)
  }

  const closeAddDialog = () => {
    setIsAddDialogOpen(false)
    form.reset()
    setCreateError(null)
  }

  const handleCreateGrade = async (data: GradeCreateForm) => {
    setIsCreating(true)
    setCreateError(null)

    try {
      const response = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          companyId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || GRADE_UI_TEXT.ERROR_OCCURRED)
      }

      closeAddDialog()
      router.refresh()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : GRADE_UI_TEXT.ERROR_OCCURRED)
    } finally {
      setIsCreating(false)
    }
  }

  const handleToggle = useCallback(
    (gradeId: string, jobTypeId: string, currentValue: boolean) => {
      const key = `${gradeId}-${jobTypeId}`
      const newValue = !currentValue

      setPendingChanges((prev) => {
        const next = new Map(prev)
        // 元の値に戻った場合は変更から削除
        const originalValue = matrix
          .find((row) => row.grade.id === gradeId)
          ?.jobTypes.find((cell) => cell.jobType.id === jobTypeId)?.isEnabled
        if (newValue === originalValue) {
          next.delete(key)
        } else {
          next.set(key, newValue)
        }
        return next
      })
      setError(null)
    },
    [matrix]
  )

  const handleSave = useCallback(async () => {
    if (pendingChanges.size === 0) return

    setIsSaving(true)
    setError(null)

    try {
      const updates = Array.from(pendingChanges.entries()).map(([key, isEnabled]) => {
        const [gradeId, jobTypeId] = key.split("-")
        return { gradeId, jobTypeId, isEnabled }
      })

      const response = await fetch("/api/grades/matrix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, updates }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || GRADE_UI_TEXT.ERROR_OCCURRED)
      }

      // 保存成功したら変更をクリアしてページを更新
      setPendingChanges(new Map())
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : GRADE_UI_TEXT.ERROR_OCCURRED)
    } finally {
      setIsSaving(false)
    }
  }, [pendingChanges, companyId, router])

  const getCellValue = (gradeId: string, jobTypeId: string, originalValue: boolean) => {
    const key = `${gradeId}-${jobTypeId}`
    return pendingChanges.has(key) ? pendingChanges.get(key)! : originalValue
  }

  const hasChanges = pendingChanges.size > 0

  // 等級削除ハンドラー
  const handleDeleteGrade = async () => {
    if (!deleteTargetGrade) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/grades/${deleteTargetGrade.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "等級の削除に失敗しました")
      }

      setDeleteTargetGrade(null)
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "等級の削除に失敗しました")
    } finally {
      setIsDeleting(false)
    }
  }

  // 職種削除ハンドラー
  const handleDeleteJobType = async () => {
    if (!deleteTargetJobType) return

    setIsDeletingJobType(true)
    setDeleteJobTypeError(null)

    try {
      const response = await fetch(`/api/companies/${companyId}/job-types/${deleteTargetJobType.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "職種の削除に失敗しました")
      }

      setDeleteTargetJobType(null)
      router.refresh()
    } catch (err) {
      setDeleteJobTypeError(err instanceof Error ? err.message : "職種の削除に失敗しました")
    } finally {
      setIsDeletingJobType(false)
    }
  }

  // 職種大分類単位の一括チェック状態を取得
  const getCategoryCheckState = useCallback(
    (categoryId: string): "checked" | "indeterminate" | "unchecked" => {
      const category = jobCategories.find((c) => c.id === categoryId)
      if (!category) return "unchecked"

      const jobTypeIds = category.jobTypes.map((jt) => jt.id)
      let onCount = 0
      let totalCount = 0

      matrix.forEach((row) => {
        jobTypeIds.forEach((jobTypeId) => {
          const cell = row.jobTypes.find((c) => c.jobType.id === jobTypeId)
          const isEnabled = getCellValue(row.grade.id, jobTypeId, cell?.isEnabled ?? false)
          if (isEnabled) onCount++
          totalCount++
        })
      })

      if (onCount === 0) return "unchecked"
      if (onCount === totalCount) return "checked"
      return "indeterminate"
    },
    [jobCategories, matrix, pendingChanges] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // 職種大分類単位の一括チェック切り替え
  const handleCategoryToggle = useCallback(
    (categoryId: string) => {
      const category = jobCategories.find((c) => c.id === categoryId)
      if (!category) return

      const currentState = getCategoryCheckState(categoryId)
      const newValue = currentState !== "checked" // unchecked/indeterminate → checked, checked → unchecked

      const jobTypeIds = category.jobTypes.map((jt) => jt.id)

      setPendingChanges((prev) => {
        const next = new Map(prev)

        matrix.forEach((row) => {
          jobTypeIds.forEach((jobTypeId) => {
            const key = `${row.grade.id}-${jobTypeId}`
            const cell = row.jobTypes.find((c) => c.jobType.id === jobTypeId)
            const originalValue = cell?.isEnabled ?? false

            if (newValue === originalValue) {
              next.delete(key)
            } else {
              next.set(key, newValue)
            }
          })
        })

        return next
      })
      setError(null)
    },
    [jobCategories, matrix, getCategoryCheckState]
  )

  // indeterminateの状態をDOMに反映
  useEffect(() => {
    jobCategories.forEach((category) => {
      const ref = categoryCheckboxRefs.current.get(category.id)
      if (ref) {
        const state = getCategoryCheckState(category.id)
        const input = ref.querySelector('input[type="checkbox"]') as HTMLInputElement | null
        if (input) {
          input.indeterminate = state === "indeterminate"
        }
      }
    })
  }, [jobCategories, getCategoryCheckState])

  // 全ての職種を取得（カテゴリごとにグループ化）
  const allJobTypes = jobCategories.flatMap((category) =>
    category.jobTypes.map((jobType) => ({
      ...jobType,
      categoryName: category.name,
    }))
  )

  if (allJobTypes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        職種が登録されていません。会社設定から職種を登録してください。
      </div>
    )
  }

  // カテゴリ別にグループ化（colspanを計算するため）
  const categoryColSpans = jobCategories.map((category) => ({
    id: category.id,
    name: category.name,
    colSpan: category.jobTypes.length,
  }))

  return (
    <>
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {/* カテゴリヘッダー行（一括チェックボックス付き） */}
          <TableRow>
            <TableHead
              className="sticky left-0 z-10 bg-background min-w-[150px]"
              rowSpan={3}
            >
              等級＼職種
            </TableHead>
            {categoryColSpans.map((category) => {
              const state = getCategoryCheckState(category.id)
              return (
                <TableHead
                  key={category.id}
                  colSpan={category.colSpan}
                  className="text-center border-l"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div
                      ref={(el) => {
                        categoryCheckboxRefs.current.set(category.id, el)
                      }}
                      className="inline-flex"
                    >
                      <Checkbox
                        checked={state === "checked"}
                        disabled={isSaving}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                        className={cn(
                          isSaving && "opacity-50"
                        )}
                      />
                    </div>
                    <span>{category.name}</span>
                  </div>
                </TableHead>
              )
            })}
            <TableHead className="min-w-[60px] text-center" rowSpan={3}>
              操作
            </TableHead>
          </TableRow>
          {/* 職種名ヘッダー行 */}
          <TableRow>
            {allJobTypes.map((jobType, index) => {
              // カテゴリの最初の職種かどうかを判定（border-leftを追加するため）
              const isFirstInCategory = index === 0 || allJobTypes[index - 1]?.categoryName !== jobType.categoryName
              return (
                <TableHead
                  key={jobType.id}
                  className={cn(
                    "text-center min-w-[80px]",
                    isFirstInCategory && "border-l"
                  )}
                >
                  {jobType.name}
                </TableHead>
              )
            })}
          </TableRow>
          {/* 職種削除ボタン行 */}
          <TableRow>
            {allJobTypes.map((jobType, index) => {
              const isFirstInCategory = index === 0 || allJobTypes[index - 1]?.categoryName !== jobType.categoryName
              return (
                <TableHead
                  key={`delete-${jobType.id}`}
                  className={cn(
                    "text-center p-1",
                    isFirstInCategory && "border-l"
                  )}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTargetJobType({ id: jobType.id, name: jobType.name })}
                    disabled={isSaving || isDeletingJobType}
                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title={`${jobType.name}を削除`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.map((row) => {
            return (
              <TableRow key={row.grade.id}>
                <TableCell className="sticky left-0 z-10 bg-background font-medium">
                  {row.grade.name}
                </TableCell>
                {row.jobTypes.map((cell, cellIndex) => {
                  const key = `${row.grade.id}-${cell.jobType.id}`
                  const isEnabled = getCellValue(row.grade.id, cell.jobType.id, cell.isEnabled)
                  const isChanged = pendingChanges.has(key)
                  // カテゴリの最初の職種かどうか
                  const isFirstInCategory = cellIndex === 0 || row.jobTypes[cellIndex - 1]?.jobCategory.id !== cell.jobCategory.id

                  return (
                    <TableCell
                      key={cell.jobType.id}
                      className={cn(
                        "text-center",
                        isFirstInCategory && "border-l"
                      )}
                    >
                      <div
                        className={cn(
                          "inline-flex items-center justify-center w-8 h-8 rounded cursor-pointer",
                          isChanged && "ring-2 ring-primary"
                        )}
                        onClick={() => {
                          if (!isSaving) {
                            handleToggle(row.grade.id, cell.jobType.id, isEnabled)
                          }
                        }}
                        title={`${row.grade.name} × ${cell.jobType.name}: ${isEnabled ? GRADE_UI_TEXT.ENABLED : GRADE_UI_TEXT.DISABLED}`}
                      >
                        <Checkbox
                          checked={isEnabled}
                          disabled={isSaving}
                          className={cn(
                            "pointer-events-none",
                            isSaving && "opacity-50",
                            isEnabled && "data-[state=checked]:bg-primary"
                          )}
                        />
                      </div>
                    </TableCell>
                  )
                })}
                {/* 削除ボタン */}
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTargetGrade(row.grade)}
                    disabled={isSaving || isDeleting}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title={`${row.grade.name}を削除`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary rounded flex items-center justify-center">
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
            <span>{GRADE_UI_TEXT.ENABLED}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border rounded" />
            <span>{GRADE_UI_TEXT.DISABLED}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {error && (
            <span className="text-sm text-destructive">{error}</span>
          )}
          {hasChanges && (
            <span className="text-sm text-muted-foreground">
              {pendingChanges.size}件の変更があります
            </span>
          )}
          <Button variant="outline" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            等級を追加
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                保存
              </>
            )}
          </Button>
        </div>
      </div>
    </div>

    {/* 等級追加ダイアログ */}
    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>等級を追加</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleCreateGrade)} className="space-y-4">
            {createError && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {createError}
              </div>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {GRADE_UI_TEXT.GRADE_NAME}
                    <span className="text-red-500 ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="正1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAddDialog}>
                {GRADE_UI_TEXT.CANCEL}
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    作成中...
                  </>
                ) : (
                  "追加"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* 等級削除確認ダイアログ */}
    <AlertDialog
      open={!!deleteTargetGrade}
      onOpenChange={(open) => {
        if (!open) {
          setDeleteTargetGrade(null)
          setDeleteError(null)
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>等級を削除</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              「{deleteTargetGrade?.name}」を削除してもよろしいですか？
            </span>
            <span className="block">
              この操作は取り消せません。
            </span>
            <span className="block">
              関連する役割責任設定も削除されます。
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {deleteError}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDeleteGrade()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                削除中...
              </>
            ) : (
              "削除"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* 職種削除確認ダイアログ */}
    <AlertDialog
      open={!!deleteTargetJobType}
      onOpenChange={(open) => {
        if (!open) {
          setDeleteTargetJobType(null)
          setDeleteJobTypeError(null)
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>職種を削除</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              「{deleteTargetJobType?.name}」を削除してもよろしいですか？
            </span>
            <span className="block">
              この操作は取り消せません。
            </span>
            <span className="block">
              関連する等級×職種の設定も削除されます。
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteJobTypeError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {deleteJobTypeError}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingJobType}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDeleteJobType()
            }}
            disabled={isDeletingJobType}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeletingJobType ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                削除中...
              </>
            ) : (
              "削除"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
