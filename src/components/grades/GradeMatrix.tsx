"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Check, Save, Loader2, Plus } from "lucide-react"
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

  return (
    <>
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background min-w-[150px]">
              等級＼職種
            </TableHead>
            {allJobTypes.map((jobType) => (
              <TableHead key={jobType.id} className="text-center min-w-[100px]">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{jobType.categoryName}</span>
                  <span>{jobType.name}</span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.map((row) => (
            <TableRow key={row.grade.id}>
              <TableCell className="sticky left-0 z-10 bg-background font-medium">
                {row.grade.name}
              </TableCell>
              {row.jobTypes.map((cell) => {
                const key = `${row.grade.id}-${cell.jobType.id}`
                const isEnabled = getCellValue(row.grade.id, cell.jobType.id, cell.isEnabled)
                const isChanged = pendingChanges.has(key)

                return (
                  <TableCell key={cell.jobType.id} className="text-center">
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
            </TableRow>
          ))}
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
    </>
  )
}
