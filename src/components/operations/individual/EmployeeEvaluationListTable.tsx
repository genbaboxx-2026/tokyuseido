"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type EvaluationStatus =
  | "STARTED"
  | "PREPARING"
  | "DISTRIBUTED"
  | "COLLECTED"
  | "AGGREGATING"
  | "COMPLETED"

interface Evaluation {
  id: string
  employeeId: string
  status: EvaluationStatus
  selfCompletedAt?: string | null
  evaluatorCompletedAt?: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
    grade: { id: string; name: string } | null
    jobType: { id: string; name: string } | null
  }
  evaluator?: {
    id: string
    firstName: string
    lastName: string
  } | null
  itemStats: {
    total: number
    selfScored: number
    managerScored: number
  }
}

interface EmployeeEvaluationListTableProps {
  evaluations: Evaluation[]
}

export function EmployeeEvaluationListTable({
  evaluations,
}: EmployeeEvaluationListTableProps) {
  if (evaluations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        表示する評価がありません
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        従業員別進捗
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">氏名</TableHead>
            <TableHead className="w-[100px]">職種</TableHead>
            <TableHead className="w-[60px]">等級</TableHead>
            <TableHead className="w-[80px] text-center">自己評価</TableHead>
            <TableHead className="w-[80px] text-center">上司評価</TableHead>
            <TableHead className="w-[150px]">全体進捗</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {evaluations.map((evaluation) => {
            const selfCompleted = evaluation.selfCompletedAt !== null
            const evaluatorCompleted = evaluation.evaluatorCompletedAt !== null

            // 進捗率を計算（自己評価50% + 上司評価50%）
            const selfProgress =
              evaluation.itemStats.total > 0
                ? (evaluation.itemStats.selfScored / evaluation.itemStats.total) * 50
                : 0
            const evaluatorProgress =
              evaluation.itemStats.total > 0
                ? (evaluation.itemStats.managerScored / evaluation.itemStats.total) * 50
                : 0
            const totalProgress = selfProgress + evaluatorProgress

            return (
              <TableRow key={evaluation.id}>
                <TableCell className="font-medium">
                  {evaluation.employee.lastName} {evaluation.employee.firstName}
                </TableCell>
                <TableCell className="text-sm">
                  {evaluation.employee.jobType?.name || "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {evaluation.employee.grade?.name || "-"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={
                      selfCompleted
                        ? "bg-green-100 text-green-700 border-green-300"
                        : "bg-red-100 text-red-700 border-red-300"
                    }
                  >
                    {selfCompleted ? "提出済" : "未提出"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={
                      evaluatorCompleted
                        ? "bg-green-100 text-green-700 border-green-300"
                        : "bg-red-100 text-red-700 border-red-300"
                    }
                  >
                    {evaluatorCompleted ? "評価済" : "未評価"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={totalProgress} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {Math.round(totalProgress)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
