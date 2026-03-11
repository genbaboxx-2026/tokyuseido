"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import {
  ChevronDown,
  ChevronRight,
  Save,
  Users,
  Loader2,
  Plus,
  X,
  Search,
} from "lucide-react"

interface Employee {
  id: string
  firstName: string
  lastName: string
  position: {
    id: string
    name: string
  } | null
}

export interface CompanyEmployee {
  id: string
  firstName: string
  lastName: string
  gradeId: string | null
  jobTypeId: string | null
  grade: { id: string; name: string } | null
  jobType: { id: string; name: string } | null
  position: { id: string; name: string } | null
}

export interface RoleData {
  configId: string
  gradeId: string
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
  gradeId: string
  configId: string
  roleId: string | null
  responsibilities: string[]
  employees: Employee[]
  originalEmployeeIds: string[]
  isExpanded: boolean
  isSaving: boolean
  isDirty: boolean
  isAddingEmployee: boolean
  jobTypeFilter: string
  searchQuery: string
}

interface RoleEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allRoles: RoleData[]
  jobTypeName: string
  categoryName: string
  onSave: () => void
  companyId: string
  allEmployees: CompanyEmployee[]
  targetJobTypeId: string
}

const DEFAULT_RESPONSIBILITIES = ["", "", "", "", ""]

export function RoleEditModal({
  open,
  onOpenChange,
  allRoles,
  jobTypeName,
  categoryName,
  onSave,
  companyId,
  allEmployees,
  targetJobTypeId,
}: RoleEditModalProps) {
  const [gradeStates, setGradeStates] = useState<GradeState[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isBulkSaving, setIsBulkSaving] = useState(false)

  const hasAnyChanges = useMemo(() => {
    return gradeStates.some((s) => s.isDirty)
  }, [gradeStates])

  useEffect(() => {
    if (open && allRoles.length > 0) {
      const states: GradeState[] = allRoles
        .sort((a, b) => b.gradeLevel - a.gradeLevel)
        .map((role) => ({
          gradeLevel: role.gradeLevel,
          gradeName: role.gradeName,
          gradeId: role.gradeId,
          configId: role.configId,
          roleId: role.roleId,
          responsibilities:
            role.responsibilities.length > 0
              ? [...role.responsibilities]
              : [...DEFAULT_RESPONSIBILITIES],
          employees: role.employees,
          originalEmployeeIds: role.employees.map((e) => e.id),
          isExpanded: true,
          isSaving: false,
          isDirty: false,
          isAddingEmployee: false,
          jobTypeFilter: "all",
          searchQuery: "",
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

  const toggleAddEmployee = useCallback((gradeLevel: number) => {
    setGradeStates((prev) =>
      prev.map((s) =>
        s.gradeLevel === gradeLevel
          ? { ...s, isAddingEmployee: !s.isAddingEmployee, searchQuery: "" }
          : s
      )
    )
  }, [])

  const setJobTypeFilter = useCallback((gradeLevel: number, filter: string) => {
    setGradeStates((prev) =>
      prev.map((s) =>
        s.gradeLevel === gradeLevel ? { ...s, jobTypeFilter: filter } : s
      )
    )
  }, [])

  const setSearchQuery = useCallback((gradeLevel: number, query: string) => {
    setGradeStates((prev) =>
      prev.map((s) =>
        s.gradeLevel === gradeLevel ? { ...s, searchQuery: query } : s
      )
    )
  }, [])

  const handleAddEmployee = useCallback(
    (gradeLevel: number, employee: CompanyEmployee) => {
      setGradeStates((prev) =>
        prev.map((s) => {
          if (s.gradeLevel === gradeLevel) {
            if (s.employees.some((e) => e.id === employee.id)) return s
            return {
              ...s,
              employees: [
                ...s.employees,
                {
                  id: employee.id,
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                  position: employee.position,
                },
              ],
              isDirty: true,
            }
          }
          // 他の等級セクションから削除（移動）
          const hadEmployee = s.employees.some((e) => e.id === employee.id)
          if (hadEmployee) {
            return {
              ...s,
              employees: s.employees.filter((e) => e.id !== employee.id),
              isDirty: true,
            }
          }
          return s
        })
      )
    },
    []
  )

  const handleRemoveEmployee = useCallback(
    (gradeLevel: number, employeeId: string) => {
      setGradeStates((prev) =>
        prev.map((s) => {
          if (s.gradeLevel === gradeLevel) {
            return {
              ...s,
              employees: s.employees.filter((e) => e.id !== employeeId),
              isDirty: true,
            }
          }
          return s
        })
      )
    },
    []
  )

  // 等級セクションごとの追加可能な従業員リスト
  const getAvailableEmployees = useCallback(
    (gradeLevel: number) => {
      const currentGradeEmployeeIds = new Set(
        gradeStates
          .find((s) => s.gradeLevel === gradeLevel)
          ?.employees.map((e) => e.id) || []
      )
      return allEmployees.filter((e) => !currentGradeEmployeeIds.has(e.id))
    },
    [gradeStates, allEmployees]
  )

  // 全社の職種一覧（フィルタ用）
  const jobTypeOptions = useMemo(() => {
    const jobTypes = new Map<string, string>()
    allEmployees.forEach((e) => {
      if (e.jobType) {
        jobTypes.set(e.jobType.id, e.jobType.name)
      }
    })
    return Array.from(jobTypes.entries()).map(([id, name]) => ({ id, name }))
  }, [allEmployees])

  // フィルタリングされた従業員リスト
  const getFilteredEmployees = useCallback(
    (gradeLevel: number) => {
      const state = gradeStates.find((s) => s.gradeLevel === gradeLevel)
      if (!state) return []

      let available = getAvailableEmployees(gradeLevel)

      if (state.jobTypeFilter !== "all") {
        if (state.jobTypeFilter === "unassigned") {
          available = available.filter((e) => !e.jobTypeId)
        } else {
          available = available.filter(
            (e) => e.jobTypeId === state.jobTypeFilter
          )
        }
      }

      if (state.searchQuery.trim()) {
        const q = state.searchQuery.trim().toLowerCase()
        available = available.filter(
          (e) =>
            `${e.lastName}${e.firstName}`.toLowerCase().includes(q) ||
            `${e.lastName} ${e.firstName}`.toLowerCase().includes(q)
        )
      }

      return available
    },
    [gradeStates, getAvailableEmployees]
  )

  const handleBulkSave = useCallback(async () => {
    const dirtyStates = gradeStates.filter((s) => s.isDirty)
    if (dirtyStates.length === 0) return

    setIsBulkSaving(true)
    setError(null)

    try {
      // 1. 責任内容の保存
      const roleResults: { gradeLevel: number; roleId: string }[] = []

      for (const state of dirtyStates) {
        const filteredResponsibilities = state.responsibilities.filter(
          (r) => r.trim() !== ""
        )

        const hasResponsibilityChanges =
          JSON.stringify(
            allRoles.find((r) => r.gradeLevel === state.gradeLevel)
              ?.responsibilities || []
          ) !==
          JSON.stringify(filteredResponsibilities)

        if (hasResponsibilityChanges) {
          let response: Response

          if (state.roleId) {
            response = await fetch(`/api/grades/roles/${state.roleId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                responsibilities: filteredResponsibilities,
              }),
            })
          } else {
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
            throw new Error(
              `${state.gradeName}: ${errorData.error || GRADE_UI_TEXT.ERROR_OCCURRED}`
            )
          }

          const savedData = await response.json()
          roleResults.push({
            gradeLevel: state.gradeLevel,
            roleId: savedData.id,
          })
        }
      }

      // 2. 従業員割り当ての保存
      const addAssignments: {
        employeeId: string
        gradeId: string
        jobTypeId: string
      }[] = []
      const removeAssignments: {
        employeeId: string
        gradeId: null
        jobTypeId: null
      }[] = []
      const allAddedIds = new Set<string>()

      for (const state of gradeStates) {
        const originalIds = new Set(state.originalEmployeeIds)
        const currentIds = new Set(state.employees.map((e) => e.id))

        for (const emp of state.employees) {
          if (!originalIds.has(emp.id)) {
            allAddedIds.add(emp.id)
            addAssignments.push({
              employeeId: emp.id,
              gradeId: state.gradeId,
              jobTypeId: targetJobTypeId,
            })
          }
        }

        for (const id of state.originalEmployeeIds) {
          if (!currentIds.has(id)) {
            removeAssignments.push({
              employeeId: id,
              gradeId: null,
              jobTypeId: null,
            })
          }
        }
      }

      const finalRemoves = removeAssignments.filter(
        (r) => !allAddedIds.has(r.employeeId)
      )
      const allAssignments = [
        ...addAssignments,
        ...finalRemoves,
      ]

      if (allAssignments.length > 0) {
        const assignResponse = await fetch(
          `/api/companies/${companyId}/employees/bulk-assign-grade`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignments: allAssignments }),
          }
        )

        if (!assignResponse.ok) {
          const errorData = await assignResponse.json()
          throw new Error(
            errorData.error || "従業員の割り当て更新に失敗しました"
          )
        }
      }

      // 状態更新
      setGradeStates((prev) =>
        prev.map((s) => {
          const result = roleResults.find(
            (r) => r.gradeLevel === s.gradeLevel
          )
          return {
            ...s,
            isDirty: false,
            roleId: result ? result.roleId : s.roleId,
            originalEmployeeIds: s.employees.map((e) => e.id),
            isAddingEmployee: false,
          }
        })
      )

      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : GRADE_UI_TEXT.ERROR_OCCURRED)
    } finally {
      setIsBulkSaving(false)
    }
  }, [gradeStates, allRoles, companyId, targetJobTypeId, onSave])

  if (allRoles.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[calc(100vw-80px)] w-[calc(100vw-80px)] h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{GRADE_UI_TEXT.ROLE_RESPONSIBILITY}</DialogTitle>
              <DialogDescription>
                {categoryName} / {jobTypeName} - 全等級
              </DialogDescription>
            </div>
            <Button
              onClick={handleBulkSave}
              disabled={!hasAnyChanges || isBulkSaving}
              className="ml-4"
            >
              {isBulkSaving ? (
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
              <div
                className="w-full flex items-center gap-3 p-3 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
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
                  <Badge
                    variant="outline"
                    className="text-xs text-orange-500 border-orange-300"
                  >
                    未保存
                  </Badge>
                )}
              </div>

              {/* 内容 */}
              {state.isExpanded && (
                <div className="p-4 space-y-4">
                  {/* 該当者一覧 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">
                        {GRADE_UI_TEXT.EMPLOYEES}
                      </Label>
                      <Button
                        variant={state.isAddingEmployee ? "secondary" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleAddEmployee(state.gradeLevel)
                        }}
                      >
                        {state.isAddingEmployee ? (
                          <>
                            <X className="h-3 w-3 mr-1" />
                            閉じる
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            従業員を追加
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="p-3 bg-muted/30 rounded-md">
                      {state.employees.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {state.employees.map((employee) => (
                            <span
                              key={employee.id}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-background border group"
                            >
                              {employee.lastName} {employee.firstName}
                              {employee.position && (
                                <span className="text-muted-foreground">
                                  ({employee.position.name})
                                </span>
                              )}
                              <button
                                type="button"
                                className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveEmployee(
                                    state.gradeLevel,
                                    employee.id
                                  )
                                }}
                                disabled={isBulkSaving}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          該当者なし
                        </span>
                      )}
                    </div>

                    {/* 従業員追加パネル */}
                    {state.isAddingEmployee && (
                      <EmployeeAddPanel
                        gradeLevel={state.gradeLevel}
                        jobTypeFilter={state.jobTypeFilter}
                        searchQuery={state.searchQuery}
                        jobTypeOptions={jobTypeOptions}
                        filteredEmployees={getFilteredEmployees(
                          state.gradeLevel
                        )}
                        onFilterChange={(filter) =>
                          setJobTypeFilter(state.gradeLevel, filter)
                        }
                        onSearchChange={(query) =>
                          setSearchQuery(state.gradeLevel, query)
                        }
                        onAdd={(employee) =>
                          handleAddEmployee(state.gradeLevel, employee)
                        }
                        disabled={isBulkSaving}
                        targetJobTypeName={jobTypeName}
                        targetGradeName={state.gradeName}
                      />
                    )}
                  </div>

                  {/* 責任内容 */}
                  <div>
                    <Label className="text-sm font-medium">
                      {GRADE_UI_TEXT.RESPONSIBILITY_CONTENT}
                    </Label>
                    <div className="mt-2">
                      <ResponsibilityList
                        responsibilities={state.responsibilities}
                        onChange={(newResp) =>
                          handleResponsibilityChange(
                            state.gradeLevel,
                            newResp
                          )
                        }
                        disabled={isBulkSaving}
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

function EmployeeAddPanel({
  gradeLevel,
  jobTypeFilter,
  searchQuery,
  jobTypeOptions,
  filteredEmployees,
  onFilterChange,
  onSearchChange,
  onAdd,
  disabled,
  targetJobTypeName,
  targetGradeName,
}: {
  gradeLevel: number
  jobTypeFilter: string
  searchQuery: string
  jobTypeOptions: { id: string; name: string }[]
  filteredEmployees: CompanyEmployee[]
  onFilterChange: (filter: string) => void
  onSearchChange: (query: string) => void
  onAdd: (employee: CompanyEmployee) => void
  disabled: boolean
  targetJobTypeName: string
  targetGradeName: string
}) {
  // 職種でグループ化
  const groupedEmployees = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; employees: CompanyEmployee[] }
    >()

    filteredEmployees.forEach((emp) => {
      const key = emp.jobType?.id || "unassigned"
      const label = emp.jobType?.name || "未設定"
      const group = groups.get(key) || { label, employees: [] }
      group.employees.push(emp)
      groups.set(key, group)
    })

    return Array.from(groups.values()).sort((a, b) =>
      a.label === "未設定" ? 1 : b.label === "未設定" ? -1 : a.label.localeCompare(b.label)
    )
  }, [filteredEmployees])

  return (
    <div className="mt-3 border border-sky-200 rounded-md bg-sky-50/60 shadow-md">
      <div className="p-3 border-b border-sky-200 bg-sky-100/50">
        <p className="text-xs text-muted-foreground mb-2">
          選択した従業員は{" "}
          <span className="font-medium text-foreground">
            {targetGradeName} / {targetJobTypeName}
          </span>{" "}
          に割り当てられます
        </p>
        <div className="flex gap-2">
          <select
            value={jobTypeFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            disabled={disabled}
          >
            <option value="all">すべての職種</option>
            {jobTypeOptions.map((jt) => (
              <option key={jt.id} value={jt.id}>
                {jt.name}
              </option>
            ))}
            <option value="unassigned">未設定</option>
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="名前で検索..."
              className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <div className="max-h-[200px] overflow-y-auto bg-white rounded-b-md">
        {groupedEmployees.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            該当する従業員がいません
          </div>
        ) : (
          groupedEmployees.map((group) => (
            <div key={group.label}>
              <div className="sticky top-0 bg-sky-100/80 backdrop-blur-sm px-3 py-1 text-[10px] font-medium text-sky-700 border-b border-sky-200">
                {group.label}（{group.employees.length}名）
              </div>
              {group.employees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-sky-50 transition-colors text-sm disabled:opacity-50"
                  onClick={() => onAdd(emp)}
                  disabled={disabled}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">
                      {emp.lastName} {emp.firstName}
                    </span>
                    {emp.position && (
                      <span className="text-[10px] text-muted-foreground">
                        ({emp.position.name})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {emp.grade && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {emp.grade.name}
                      </Badge>
                    )}
                    {emp.jobType && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {emp.jobType.name}
                      </Badge>
                    )}
                    {!emp.grade && !emp.jobType && (
                      <span className="text-[10px] text-muted-foreground">
                        未設定
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
