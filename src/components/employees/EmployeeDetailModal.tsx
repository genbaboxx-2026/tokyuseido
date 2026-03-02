"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { EmployeeDetailResponse } from "@/types/employee"
import { EmploymentTypeLabels, EmployeeStatusLabels, GenderLabels } from "@/types/employee"

interface EmployeeDetailModalProps {
  employeeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmployeeDetailModal({
  employeeId,
  open,
  onOpenChange,
}: EmployeeDetailModalProps) {
  const { data: employee, isLoading } = useQuery<EmployeeDetailResponse>({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}`)
      if (!res.ok) throw new Error("従業員の取得に失敗しました")
      return res.json()
    },
    enabled: !!employeeId && open,
  })

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("ja-JP")
  }

  const formatSalary = (salary: number | null) => {
    if (!salary) return "-"
    return `¥${salary.toLocaleString()}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>従業員詳細</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
        ) : employee ? (
          <div className="space-y-6">
            {/* ヘッダー部 */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {employee.lastName.charAt(0)}{employee.firstName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-bold">
                  {employee.lastName} {employee.firstName}
                </h2>
                <p className="text-sm text-muted-foreground font-mono">
                  {employee.employeeCode}
                </p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline">
                    {EmploymentTypeLabels[employee.employmentType as keyof typeof EmploymentTypeLabels]}
                  </Badge>
                  <Badge variant={employee.status === "ACTIVE" ? "default" : "secondary"}>
                    {EmployeeStatusLabels[employee.status as keyof typeof EmployeeStatusLabels]}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* 基本情報 */}
            <div>
              <h3 className="font-semibold mb-3">基本情報</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">性別</dt>
                  <dd className="font-medium">
                    {employee.gender ? GenderLabels[employee.gender as keyof typeof GenderLabels] : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">生年月日</dt>
                  <dd className="font-medium">{formatDate(employee.birthDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">入社日</dt>
                  <dd className="font-medium">{formatDate(employee.hireDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">勤続年数</dt>
                  <dd className="font-medium">{employee.yearsOfService}年</dd>
                </div>
              </dl>
            </div>

            <Separator />

            {/* 所属・等級情報 */}
            <div>
              <h3 className="font-semibold mb-3">所属・等級</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">部署</dt>
                  <dd className="font-medium">{employee.department?.name || "-"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">職種</dt>
                  <dd className="font-medium">{employee.jobType?.name || "-"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">等級</dt>
                  <dd className="font-medium">
                    {employee.grade ? (
                      <Badge variant={employee.grade.isManagement ? "default" : "secondary"}>
                        {employee.grade.name}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">役職</dt>
                  <dd className="font-medium">{employee.position?.name || "-"}</dd>
                </div>
              </dl>
            </div>

            <Separator />

            {/* 給与情報 */}
            <div>
              <h3 className="font-semibold mb-3">給与</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">基本給（月額）</dt>
                  <dd className="font-medium text-lg">{formatSalary(employee.baseSalary)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">年収</dt>
                  <dd className="font-medium text-lg">{formatSalary(employee.annualSalary)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">現在の号俸</dt>
                  <dd className="font-medium">{employee.currentStep ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">現在のランク</dt>
                  <dd className="font-medium">{employee.currentRank || "-"}</dd>
                </div>
              </dl>
            </div>

            {/* 等級変遷履歴 */}
            {employee.gradeHistory && employee.gradeHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3">等級変遷履歴</h3>
                  <div className="space-y-2">
                    {employee.gradeHistory.slice(0, 5).map((history, index) => (
                      <div
                        key={history.id}
                        className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{history.gradeName}</Badge>
                          {history.reason && (
                            <span className="text-muted-foreground">{history.reason}</span>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {formatDate(history.effectiveDate)}
                        </span>
                      </div>
                    ))}
                    {employee.gradeHistory.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">
                        他 {employee.gradeHistory.length - 5} 件の履歴
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            従業員情報を取得できませんでした
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
