"use client"

import { useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, ZoomIn, ZoomOut, RotateCcw, Link2, Unlink } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RoleEditModal } from "./RoleEditModal"
import { GRADE_UI_TEXT } from "@/lib/grade/constants"

interface Employee {
  id: string
  firstName: string
  lastName: string
  gradeId: string | null
  jobTypeId: string | null
  position: {
    id: string
    name: string
  } | null
}

interface GradeRole {
  id: string
  responsibilities: unknown
  positionNames: string[]
  [key: string]: unknown
}

interface Config {
  id: string
  gradeId: string
  jobTypeId: string
  isEnabled: boolean
  grade: {
    id: string
    name: string
    level: number
    employmentType: "FULL_TIME" | "CONTRACT" | "PART_TIME"
    isManagement: boolean
    [key: string]: unknown
  }
  jobType: {
    id: string
    name: string
    jobCategory: {
      id: string
      name: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  gradeRole: GradeRole | null
  [key: string]: unknown
}

type RoleData = {
  config: Config
  role: GradeRole | null
  employees: Employee[]
}

interface JobTypeGroup {
  id: string
  gradeId: string
  jobTypeIds: string[]
  grade: {
    id: string
    name: string
    level: number
  }
}

interface RoleMatrixProps {
  roles: RoleData[]
  companyId: string
}

interface RoleDataForModal {
  configId: string
  roleId: string | null
  gradeName: string
  gradeLevel: number
  jobTypeName: string
  responsibilities: string[]
  positionNames: string[]
  employees: Employee[]
}

const ZOOM_LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.25, 1.5, 1.75, 2.0]
const DEFAULT_ZOOM_INDEX = 5

export function RoleMatrix({ roles, companyId }: RoleMatrixProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string | null>(null)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())

  const zoomLevel = ZOOM_LEVELS[zoomIndex]
  const zoomPercent = Math.round(zoomLevel * 100)

  // グループデータ取得
  const { data: groups = [] } = useQuery<JobTypeGroup[]>({
    queryKey: ["jobTypeGroups", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/job-type-groups`)
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  // グループ作成
  const createGroupMutation = useMutation({
    mutationFn: async ({ gradeId, jobTypeIds }: { gradeId: string; jobTypeIds: string[] }) => {
      const res = await fetch(`/api/companies/${companyId}/job-type-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeId, jobTypeIds }),
      })
      if (!res.ok) throw new Error("グループ作成に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobTypeGroups", companyId] })
      setSelectedCells(new Set())
    },
  })

  // グループ解除
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const res = await fetch(`/api/companies/${companyId}/job-type-groups?groupId=${groupId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("グループ解除に失敗しました")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobTypeGroups", companyId] })
    },
  })

  const handleZoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoomIndex(DEFAULT_ZOOM_INDEX)
  }, [])

  // 等級でグループ化
  const gradeMap = useMemo(() => {
    const map = new Map<string, { grade: Config["grade"]; roles: RoleData[] }>()
    roles.forEach((roleData) => {
      const gradeId = roleData.config.grade.id
      const existing = map.get(gradeId)
      if (existing) {
        existing.roles.push(roleData)
      } else {
        map.set(gradeId, {
          grade: roleData.config.grade,
          roles: [roleData],
        })
      }
    })
    return map
  }, [roles])

  // 等級をレベル順にソート
  const sortedGrades = useMemo(
    () => Array.from(gradeMap.values()).sort((a, b) => b.grade.level - a.grade.level),
    [gradeMap]
  )

  // 全ての職種を取得（重複排除）
  const allJobTypes = useMemo(() => {
    const jobTypeMap = new Map<string, { id: string; name: string; categoryName: string }>()
    roles.forEach((roleData) => {
      const jobType = roleData.config.jobType
      if (!jobTypeMap.has(jobType.id)) {
        jobTypeMap.set(jobType.id, {
          id: jobType.id,
          name: jobType.name,
          categoryName: jobType.jobCategory.name,
        })
      }
    })
    return Array.from(jobTypeMap.values())
  }, [roles])

  // 等級×職種のマトリクスを作成
  const getCell = useCallback(
    (gradeId: string, jobTypeId: string): RoleData | null => {
      return (
        roles.find(
          (r) => r.config.grade.id === gradeId && r.config.jobType.id === jobTypeId
        ) || null
      )
    },
    [roles]
  )

  // グループ情報を取得
  const getGroupForGrade = useCallback(
    (gradeId: string, jobTypeId: string): JobTypeGroup | null => {
      return groups.find(
        (g) => g.gradeId === gradeId && (g.jobTypeIds as string[]).includes(jobTypeId)
      ) || null
    },
    [groups]
  )

  // セルがグループの先頭かどうか
  const isGroupLeader = useCallback(
    (gradeId: string, jobTypeId: string): boolean => {
      const group = getGroupForGrade(gradeId, jobTypeId)
      if (!group) return false
      const jobTypeIds = group.jobTypeIds as string[]
      // allJobTypesの順序で最初に来るものがリーダー
      const sortedGroupJobTypes = allJobTypes
        .filter((jt) => jobTypeIds.includes(jt.id))
        .map((jt) => jt.id)
      return sortedGroupJobTypes[0] === jobTypeId
    },
    [getGroupForGrade, allJobTypes]
  )

  // グループのcolSpan計算
  const getGroupColSpan = useCallback(
    (gradeId: string, jobTypeId: string): number => {
      const group = getGroupForGrade(gradeId, jobTypeId)
      if (!group) return 1
      const jobTypeIds = group.jobTypeIds as string[]
      // allJobTypesに存在する職種のみカウント
      return allJobTypes.filter((jt) => jobTypeIds.includes(jt.id)).length
    },
    [getGroupForGrade, allJobTypes]
  )

  // セルがグループに属していてリーダーでないか
  const isGroupMember = useCallback(
    (gradeId: string, jobTypeId: string): boolean => {
      const group = getGroupForGrade(gradeId, jobTypeId)
      if (!group) return false
      return !isGroupLeader(gradeId, jobTypeId)
    },
    [getGroupForGrade, isGroupLeader]
  )

  const handleEditClick = useCallback((roleData: RoleData, group?: JobTypeGroup) => {
    // グループの場合は最初の職種IDを使用
    const jobTypeId = group
      ? (group.jobTypeIds as string[])[0]
      : roleData.config.jobType.id
    setSelectedJobTypeId(jobTypeId)
    setModalOpen(true)
  }, [])

  // 選択された職種の全等級データを取得
  const selectedJobTypeRoles = useMemo((): RoleDataForModal[] => {
    if (!selectedJobTypeId) return []

    // グループに属している場合、グループ内の全職種の従業員を集める
    const group = groups.find((g) =>
      (g.jobTypeIds as string[]).includes(selectedJobTypeId)
    )
    const targetJobTypeIds = group
      ? (group.jobTypeIds as string[])
      : [selectedJobTypeId]

    // 等級ごとにデータをまとめる
    const gradeDataMap = new Map<string, RoleDataForModal>()

    roles
      .filter((r) => targetJobTypeIds.includes(r.config.jobType.id))
      .forEach((r) => {
        const gradeId = r.config.grade.id
        const existing = gradeDataMap.get(gradeId)

        if (existing) {
          // 同じ等級の従業員を追加
          existing.employees = [...existing.employees, ...r.employees]
        } else {
          gradeDataMap.set(gradeId, {
            configId: r.config.id,
            roleId: r.role?.id || null,
            gradeName: r.config.grade.name,
            gradeLevel: r.config.grade.level,
            jobTypeName: group
              ? allJobTypes
                  .filter((jt) => targetJobTypeIds.includes(jt.id))
                  .map((jt) => jt.name)
                  .join("・")
              : r.config.jobType.name,
            responsibilities: (r.role?.responsibilities as string[]) || [],
            positionNames: r.role?.positionNames || [],
            employees: [...r.employees],
          })
        }
      })

    return Array.from(gradeDataMap.values()).sort((a, b) => b.gradeLevel - a.gradeLevel)
  }, [selectedJobTypeId, roles, groups, allJobTypes])

  const handleSave = useCallback(() => {
    router.refresh()
  }, [router])

  // セル選択トグル
  const toggleCellSelection = useCallback((gradeId: string, jobTypeId: string) => {
    const key = `${gradeId}-${jobTypeId}`
    setSelectedCells((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        // 同じ等級のセルのみ選択可能
        const currentGradeId = key.split("-")[0]
        const filtered = Array.from(next).filter((k) => k.startsWith(currentGradeId + "-"))
        if (filtered.length === 0 || filtered[0].startsWith(currentGradeId + "-")) {
          next.add(key)
        }
      }
      return next
    })
  }, [])

  // 選択されたセルからグループ作成
  const handleCreateGroup = useCallback(() => {
    if (selectedCells.size < 2) return
    const cells = Array.from(selectedCells)
    const gradeId = cells[0].split("-")[0]
    const jobTypeIds = cells.map((c) => c.split("-")[1])
    createGroupMutation.mutate({ gradeId, jobTypeIds })
  }, [selectedCells, createGroupMutation])

  if (roles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{GRADE_UI_TEXT.NO_DATA}</p>
        <p className="text-sm mt-2">
          等級×職種マトリクスで有効な組み合わせを設定してください。
        </p>
      </div>
    )
  }

  return (
    <>
      {/* ズームコントロール */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {selectedCells.size >= 2 && (
            <Button
              size="sm"
              onClick={handleCreateGroup}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Link2 className="h-4 w-4 mr-1" />
              選択した{selectedCells.size}職種をグループ化
            </Button>
          )}
          {selectedCells.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedCells(new Set())}
            >
              選択解除
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-2">表示倍率: {zoomPercent}%</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoomIndex === 0}
            className="h-7 w-7 p-0"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomReset}
            disabled={zoomIndex === DEFAULT_ZOOM_INDEX}
            className="h-7 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            リセット
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            className="h-7 w-7 p-0"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="overflow-auto border rounded-lg">
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "top left",
            width: `${100 / zoomLevel}%`,
          }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background w-[60px]">
                  等級
                </TableHead>
                {allJobTypes.map((jobType) => (
                  <TableHead key={jobType.id} className="text-center w-[180px]">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">
                        {jobType.categoryName}
                      </span>
                      <span className="text-xs font-medium">{jobType.name}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGrades.map(({ grade }) => (
                <TableRow key={grade.id}>
                  <TableCell className="sticky left-0 z-10 bg-background font-medium py-1 text-center align-top">
                    <span className="text-sm">{grade.name}</span>
                  </TableCell>
                  {allJobTypes.map((jobType) => {
                    const cellData = getCell(grade.id, jobType.id)
                    const group = getGroupForGrade(grade.id, jobType.id)
                    const cellKey = `${grade.id}-${jobType.id}`
                    const isSelected = selectedCells.has(cellKey)

                    // グループメンバーの場合はスキップ（リーダーのみレンダリング）
                    if (isGroupMember(grade.id, jobType.id)) {
                      return null
                    }

                    if (!cellData) {
                      return (
                        <TableCell
                          key={jobType.id}
                          className="text-center text-muted-foreground"
                        >
                          -
                        </TableCell>
                      )
                    }

                    const colSpan = getGroupColSpan(grade.id, jobType.id)
                    const responsibilities =
                      (cellData.role?.responsibilities as string[]) || []

                    // グループの場合、全ての従業員をカウント
                    let employeeCount = cellData.employees.length
                    if (group) {
                      const groupJobTypeIds = group.jobTypeIds as string[]
                      employeeCount = roles
                        .filter(
                          (r) =>
                            r.config.grade.id === grade.id &&
                            groupJobTypeIds.includes(r.config.jobType.id)
                        )
                        .reduce((sum, r) => sum + r.employees.length, 0)
                    }

                    return (
                      <TableCell
                        key={jobType.id}
                        colSpan={colSpan}
                        className={`p-1 align-top ${
                          isSelected ? "bg-blue-100" : ""
                        } ${colSpan > 1 ? "bg-blue-50/50" : ""}`}
                      >
                        <div
                          className={`flex flex-col p-2 rounded border transition-colors cursor-pointer ${
                            colSpan > 1
                              ? "bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200"
                              : "bg-muted/30 hover:bg-muted/50"
                          }`}
                          onClick={() => handleEditClick(cellData, group || undefined)}
                        >
                          {/* ヘッダー */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">
                                {employeeCount}名
                              </span>
                              {group && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                  <Link2 className="h-2 w-2 mr-0.5" />
                                  {colSpan}職種共通
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5">
                              {group && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="h-5 w-5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Unlink className="h-2.5 w-2.5 text-orange-500" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        deleteGroupMutation.mutate(group.id)
                                      }}
                                    >
                                      グループを解除
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              {!group && (
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className={`h-5 w-5 ${isSelected ? "bg-blue-200" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleCellSelection(grade.id, jobType.id)
                                  }}
                                >
                                  <Link2 className={`h-2.5 w-2.5 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="h-5 w-5"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditClick(cellData, group || undefined)
                                }}
                              >
                                <Pencil className="h-2.5 w-2.5" />
                                <span className="sr-only">{GRADE_UI_TEXT.EDIT}</span>
                              </Button>
                            </div>
                          </div>

                          {/* 責任内容（全項目表示） */}
                          <div className="space-y-0.5">
                            {responsibilities.length > 0 ? (
                              responsibilities.map((r, idx) => (
                                <p key={idx} className="text-[10px] leading-tight text-foreground/80">
                                  <span className="text-muted-foreground">{idx + 1}.</span> {r}
                                </p>
                              ))
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">未設定</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <RoleEditModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setSelectedJobTypeId(null)
        }}
        allRoles={selectedJobTypeRoles}
        jobTypeName={selectedJobTypeRoles[0]?.jobTypeName || ""}
        categoryName={
          selectedJobTypeId
            ? allJobTypes.find((jt) => jt.id === selectedJobTypeId)?.categoryName || ""
            : ""
        }
        onSave={handleSave}
      />
    </>
  )
}
