"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { ChevronDown, ChevronRight, Save, Users } from "lucide-react"

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
  gradeLevel: number
  jobTypeName: string
  responsibilities: string[]
  positionNames: string[]
  employees: Employee[]
}

interface GradeState {
  gradeLevel: number
  gradeName: string
  configId: string
  roleId: string | null
  responsibilities: string[]
  employees: Employee[]
  isExpanded: boolean
  isSaving: boolean
  isDirty: boolean
}

interface RoleEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allRoles: RoleData[]
  jobTypeName: string
  categoryName: string
  onSave: () => void
}

// 5項目の空テンプレート
const DEFAULT_RESPONSIBILITIES = ["", "", "", "", ""]

export function RoleEditModal({
  open,
  onOpenChange,
  allRoles,
  jobTypeName,
  categoryName,
  onSave,
}: RoleEditModalProps) {
  const [gradeStates, setGradeStates] = useState<GradeState[]>([])
  const [error, setError] = useState<string | null>(null)

  // 役割データからGradeStateを初期化
  useEffect(() => {
    if (open && allRoles.length > 0) {
      const states: GradeState[] = allRoles
        .sort((a, b) => b.gradeLevel - a.gradeLevel)
        .map((role) => ({
          gradeLevel: role.gradeLevel,
          gradeName: role.gradeName,
          configId: role.configId,
          roleId: role.roleId,
          responsibilities:
            role.responsibilities.length > 0
              ? [...role.responsibilities]
              : [...DEFAULT_RESPONSIBILITIES],
          employees: role.employees,
          isExpanded: true,
          isSaving: false,
          isDirty: false,
        }))
      setGradeStates(states)
      setError(null)
    }
    if (!open) {
      setGradeStates([])
    }
  }, [open, allRoles])

  const toggleExpand = useCallback((gradeLevel: number) => {
    setGradeStates((prev) =>
      prev.map((s) =>
        s.gradeLevel === gradeLevel ? { ...s, isExpanded: !s.isExpanded } : s
      )
    )
  }, [])

  const handleResponsibilityChange = useCallback(
    (gradeLevel: number, newResponsibilities: string[]) => {
      setGradeStates((prev) =>
        prev.map((s) =>
          s.gradeLevel === gradeLevel
            ? { ...s, responsibilities: newResponsibilities, isDirty: true }
            : s
        )
      )
    },
    []
  )

  const handleSave = useCallback(
    async (gradeLevel: number) => {
      const state = gradeStates.find((s) => s.gradeLevel === gradeLevel)
      if (!state) return

      setGradeStates((prev) =>
        prev.map((s) =>
          s.gradeLevel === gradeLevel ? { ...s, isSaving: true } : s
        )
      )
      setError(null)

      // 空の責任を除外
      const filteredResponsibilities = state.responsibilities.filter(
        (r) => r.trim() !== ""
      )

      try {
        let response: Response

        if (state.roleId) {
          // 更新
          response = await fetch(`/api/grades/roles/${state.roleId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              responsibilities: filteredResponsibilities,
            }),
          })
        } else {
          // 新規作成
          response = await fetch("/api/grades/roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gradeJobTypeConfigId: state.configId,
              responsibilities: filteredResponsibilities,
              positionNames: [],
            }),
          })
        }

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || GRADE_UI_TEXT.ERROR_OCCURRED)
        }

        const savedData = await response.json()

        // ステートを更新
        setGradeStates((prev) =>
          prev.map((s) =>
            s.gradeLevel === gradeLevel
              ? { ...s, isSaving: false, isDirty: false, roleId: savedData.id }
              : s
          )
        )

        onSave()
      } catch (err) {
        setError(err instanceof Error ? err.message : GRADE_UI_TEXT.ERROR_OCCURRED)
        setGradeStates((prev) =>
          prev.map((s) =>
            s.gradeLevel === gradeLevel ? { ...s, isSaving: false } : s
          )
        )
      }
    },
    [gradeStates, onSave]
  )

  if (allRoles.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[calc(100vw-80px)] w-[calc(100vw-80px)] h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
          <DialogTitle>{GRADE_UI_TEXT.ROLE_RESPONSIBILITY}</DialogTitle>
          <DialogDescription>
            {categoryName} / {jobTypeName} - 全等級
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 mx-6 rounded-md text-sm flex-shrink-0">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {gradeStates.map((state) => (
            <div key={state.gradeLevel} className="border rounded-lg overflow-hidden">
              {/* 等級ヘッダー */}
              <div className="w-full flex items-center justify-between p-3 bg-muted/50">
                <div
                  className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity flex-1"
                  onClick={() => toggleExpand(state.gradeLevel)}
                >
                  {state.isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-bold text-lg">{state.gradeName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {state.responsibilities.filter((r) => r.trim()).length}項目
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {state.employees.length}名
                  </span>
                  {state.isDirty && (
                    <Badge variant="outline" className="text-xs text-orange-500 border-orange-300">
                      未保存
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave(state.gradeLevel)}
                  disabled={state.isSaving}
                >
                  <Save className="h-3 w-3 mr-1" />
                  {state.isSaving ? "..." : "保存"}
                </Button>
              </div>

              {/* 内容 */}
              {state.isExpanded && (
                <div className="p-4 space-y-4">
                  {/* 該当者一覧 */}
                  <div>
                    <Label className="text-sm font-medium">{GRADE_UI_TEXT.EMPLOYEES}</Label>
                    <div className="mt-2 p-3 bg-muted/30 rounded-md">
                      {state.employees.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {state.employees.map((employee) => (
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
                        responsibilities={state.responsibilities}
                        onChange={(newResp) =>
                          handleResponsibilityChange(state.gradeLevel, newResp)
                        }
                        disabled={state.isSaving}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="flex-shrink-0 border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
