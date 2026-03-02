"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GRADE_UI_TEXT, EMPLOYMENT_TYPE_LABELS } from "@/lib/grade/constants"

interface Grade {
  id: string
  name: string
  level: number
  employmentType: "FULL_TIME" | "CONTRACT" | "OUTSOURCE" | "PART_TIME"
  isManagement: boolean
  _count: {
    employees: number
    gradeJobTypeConfigs: number
  }
}

interface GradeTableProps {
  grades: Grade[]
  basePath?: string
}

export function GradeTable({ grades, basePath = "/grades" }: GradeTableProps) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<Grade | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/grades/${deleteTarget.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || GRADE_UI_TEXT.ERROR_OCCURRED)
      }

      setDeleteTarget(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : GRADE_UI_TEXT.ERROR_OCCURRED)
    } finally {
      setIsDeleting(false)
    }
  }

  if (grades.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {GRADE_UI_TEXT.NO_DATA}
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{GRADE_UI_TEXT.GRADE_NAME}</TableHead>
            <TableHead>{GRADE_UI_TEXT.EMPLOYMENT_TYPE}</TableHead>
            <TableHead className="text-center">{GRADE_UI_TEXT.EMPLOYEES}</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grades.map((grade) => (
            <TableRow key={grade.id}>
              <TableCell className="font-medium">{grade.name}</TableCell>
              <TableCell>
                {EMPLOYMENT_TYPE_LABELS[grade.employmentType]}
              </TableCell>
              <TableCell className="text-center">
                {grade._count.employees}名
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link href={`${basePath}/${grade.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">{GRADE_UI_TEXT.EDIT}</span>
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(grade)}
                    disabled={grade._count.employees > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">{GRADE_UI_TEXT.DELETE}</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{GRADE_UI_TEXT.DELETE}</DialogTitle>
            <DialogDescription>
              {deleteTarget && `「${deleteTarget.name}」を削除してもよろしいですか？`}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              {GRADE_UI_TEXT.CANCEL}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? GRADE_UI_TEXT.LOADING : GRADE_UI_TEXT.DELETE}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
