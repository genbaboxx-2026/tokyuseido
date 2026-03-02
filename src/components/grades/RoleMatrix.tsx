"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
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
  responsibilities: unknown // Prisma Json type
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
    [key: string]: unknown // 追加のPrismaフィールドを許容
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RoleData = {
  config: Config
  role: GradeRole | null
  employees: Employee[]
}

interface RoleMatrixProps {
  roles: RoleData[]
  companyId: string
}

interface ModalData {
  configId: string
  roleId: string | null
  gradeName: string
  jobTypeName: string
  responsibilities: string[]
  positionNames: string[]
  employees: Employee[]
}

export function RoleMatrix({ roles, companyId }: RoleMatrixProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalData, setModalData] = useState<ModalData | null>(null)

  // 等級でグループ化
  const gradeMap = new Map<string, { grade: Config["grade"]; roles: RoleData[] }>()
  roles.forEach((roleData) => {
    const gradeId = roleData.config.grade.id
    const existing = gradeMap.get(gradeId)
    if (existing) {
      existing.roles.push(roleData)
    } else {
      gradeMap.set(gradeId, {
        grade: roleData.config.grade,
        roles: [roleData],
      })
    }
  })

  // 等級をレベル順にソート
  const sortedGrades = Array.from(gradeMap.values()).sort(
    (a, b) => b.grade.level - a.grade.level
  )

  // 全ての職種を取得（重複排除）
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
  const allJobTypes = Array.from(jobTypeMap.values())

  const handleEditClick = useCallback((roleData: RoleData) => {
    setModalData({
      configId: roleData.config.id,
      roleId: roleData.role?.id || null,
      gradeName: roleData.config.grade.name,
      jobTypeName: roleData.config.jobType.name,
      responsibilities: (roleData.role?.responsibilities as string[]) || [],
      positionNames: roleData.role?.positionNames || [],
      employees: roleData.employees,
    })
    setModalOpen(true)
  }, [])

  const handleSave = useCallback(() => {
    router.refresh()
  }, [router])

  // 等級×職種のマトリクスを作成
  const getCell = (gradeId: string, jobTypeId: string): RoleData | null => {
    return (
      roles.find(
        (r) => r.config.grade.id === gradeId && r.config.jobType.id === jobTypeId
      ) || null
    )
  }

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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background min-w-[150px]">
                等級
              </TableHead>
              {allJobTypes.map((jobType) => (
                <TableHead key={jobType.id} className="text-center min-w-[200px]">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      {jobType.categoryName}
                    </span>
                    <span>{jobType.name}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGrades.map(({ grade }) => (
              <TableRow key={grade.id} className="[&>td]:align-top">
                <TableCell className="sticky left-0 z-10 bg-background font-medium align-middle py-4">
                  {grade.name}
                </TableCell>
                {allJobTypes.map((jobType) => {
                  const cellData = getCell(grade.id, jobType.id)

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

                  const responsibilities =
                    (cellData.role?.responsibilities as string[]) || []
                  const employeeCount = cellData.employees.length

                  return (
                    <TableCell key={jobType.id} className="p-2">
                      <div
                        className="flex flex-col p-3 rounded border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer min-h-[120px]"
                        onClick={() => handleEditClick(cellData)}
                      >
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between mb-2 pb-2 border-b">
                          <span className="text-xs font-medium">
                            {GRADE_UI_TEXT.EMPLOYEES}: {employeeCount}名
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditClick(cellData)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                            <span className="sr-only">{GRADE_UI_TEXT.EDIT}</span>
                          </Button>
                        </div>

                        {/* 責任内容（全て表示） */}
                        <div>
                          {responsibilities.length > 0 ? (
                            <ul className="space-y-1 text-sm">
                              {responsibilities.map((r, idx) => (
                                <li
                                  key={idx}
                                  className="text-foreground leading-relaxed"
                                >
                                  <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                                  {r || "（未入力）"}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">
                              未設定
                            </span>
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

      <RoleEditModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        data={modalData}
        onSave={handleSave}
      />
    </>
  )
}
