"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ResponsibilityList } from "./ResponsibilityList"
import { GRADE_UI_TEXT } from "@/lib/grade/constants"

interface Employee {
  id: string
  firstName: string
  lastName: string
  position: {
    id: string
    name: string
  } | null
}

interface RoleData {
  configId: string
  roleId: string | null
  gradeName: string
  jobTypeName: string
  responsibilities: string[]
  positionNames: string[]
  employees: Employee[]
}

interface RoleEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: RoleData | null
  onSave: () => void
}

// 5項目の空テンプレート
const DEFAULT_RESPONSIBILITIES = ["", "", "", "", ""]

export function RoleEditModal({ open, onOpenChange, data, onSave }: RoleEditModalProps) {
  const [responsibilities, setResponsibilities] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      // 新規作成時または空の場合は5項目のテンプレートをセット
      if (data.responsibilities.length === 0) {
        setResponsibilities([...DEFAULT_RESPONSIBILITIES])
      } else {
        setResponsibilities(data.responsibilities)
      }
      setError(null)
    }
  }, [data])

  const handleSave = async () => {
    if (!data) return

    setIsLoading(true)
    setError(null)

    // 空の責任を除外
    const filteredResponsibilities = responsibilities.filter((r) => r.trim() !== "")

    try {
      let response: Response

      if (data.roleId) {
        // 更新（positionNamesは送信しない）
        response = await fetch(`/api/grades/roles/${data.roleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responsibilities: filteredResponsibilities,
          }),
        })
      } else {
        // 新規作成（positionNamesは空配列）
        response = await fetch("/api/grades/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gradeJobTypeConfigId: data.configId,
            responsibilities: filteredResponsibilities,
            positionNames: [],
          }),
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || GRADE_UI_TEXT.ERROR_OCCURRED)
      }

      onSave()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : GRADE_UI_TEXT.ERROR_OCCURRED)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{GRADE_UI_TEXT.ROLE_RESPONSIBILITY}</DialogTitle>
          {data && (
            <DialogDescription>
              {data.gradeName} × {data.jobTypeName}
            </DialogDescription>
          )}
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* 該当者一覧 */}
            <div>
              <Label className="text-sm font-medium">{GRADE_UI_TEXT.EMPLOYEES}</Label>
              <div className="mt-2 p-3 bg-muted rounded-md">
                {data.employees.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.employees.map((employee) => (
                      <span
                        key={employee.id}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-background border"
                      >
                        {employee.lastName} {employee.firstName}
                        {employee.position && (
                          <span className="ml-1 text-muted-foreground">
                            ({employee.position.name})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">該当者なし</span>
                )}
              </div>
            </div>

            {/* 責任内容 */}
            <div>
              <Label className="text-sm font-medium">{GRADE_UI_TEXT.RESPONSIBILITY_CONTENT}</Label>
              <div className="mt-2">
                <ResponsibilityList
                  responsibilities={responsibilities}
                  onChange={setResponsibilities}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {GRADE_UI_TEXT.CANCEL}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? GRADE_UI_TEXT.LOADING : GRADE_UI_TEXT.SAVE}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
