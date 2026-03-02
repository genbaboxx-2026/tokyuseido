"use client"

import { useState } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { EVALUATION_UI_TEXT, EVALUATOR_ORDER_LABELS } from "@/lib/evaluation/constants"

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode?: string | null
  department?: { id: string; name: string } | null
  grade?: { id: string; name: string } | null
}

interface User {
  id: string
  name: string | null
  email: string | null
}

interface Assignment {
  evaluation360Id: string
  evaluatorId: string
  order: number
}

interface Evaluation360 {
  id: string
  employee: Employee
  evaluatorAssignments: Array<{
    id: string
    evaluatorId: string
    order: number
    evaluator: User
  }>
}

interface EvaluatorAssignmentTableProps {
  evaluations: Evaluation360[]
  availableEvaluators: User[]
  onSave: (assignments: Record<string, Assignment[]>) => Promise<void>
  isLoading?: boolean
}

export function EvaluatorAssignmentTable({
  evaluations,
  availableEvaluators,
  onSave,
  isLoading = false,
}: EvaluatorAssignmentTableProps) {
  // 各評価の評価者割当を管理
  const [assignments, setAssignments] = useState<Record<string, (string | null)[]>>(() => {
    const initial: Record<string, (string | null)[]> = {}
    for (const evaluation of evaluations) {
      const evaluators: (string | null)[] = [null, null, null, null]
      for (const assignment of evaluation.evaluatorAssignments) {
        if (assignment.order >= 1 && assignment.order <= 4) {
          evaluators[assignment.order - 1] = assignment.evaluatorId
        }
      }
      initial[evaluation.id] = evaluators
    }
    return initial
  })

  const handleEvaluatorChange = (
    evaluationId: string,
    order: number,
    evaluatorId: string | null
  ) => {
    setAssignments((prev) => {
      const newAssignments = { ...prev }
      const evaluators = [...(newAssignments[evaluationId] || [null, null, null, null])]
      evaluators[order - 1] = evaluatorId === "" ? null : evaluatorId
      newAssignments[evaluationId] = evaluators
      return newAssignments
    })
  }

  const handleSave = async () => {
    // 保存用のデータを構築
    const saveData: Record<string, Assignment[]> = {}

    for (const [evaluationId, evaluators] of Object.entries(assignments)) {
      const validAssignments: Assignment[] = []
      evaluators.forEach((evaluatorId, index) => {
        if (evaluatorId) {
          validAssignments.push({
            evaluation360Id: evaluationId,
            evaluatorId,
            order: index + 1,
          })
        }
      })
      saveData[evaluationId] = validAssignments
    }

    await onSave(saveData)
  }

  // 被評価者のユーザーIDを取得（自分を評価者に設定できないようにするため）
  const getExcludedEvaluatorIds = (evaluation: Evaluation360): string[] => {
    // 従業員に紐づくユーザーIDがあれば除外（今回は簡易的に空配列を返す）
    return []
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">{EVALUATION_UI_TEXT.EVALUATEE}</TableHead>
              <TableHead className="min-w-[120px]">部署</TableHead>
              <TableHead className="min-w-[80px]">等級</TableHead>
              {[1, 2, 3, 4].map((order) => (
                <TableHead key={order} className="min-w-[180px]">
                  {EVALUATOR_ORDER_LABELS[order]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {evaluations.map((evaluation) => {
              const excludedIds = getExcludedEvaluatorIds(evaluation)
              const currentAssignments = assignments[evaluation.id] || [null, null, null, null]

              return (
                <TableRow key={evaluation.id}>
                  <TableCell className="font-medium">
                    {evaluation.employee.lastName} {evaluation.employee.firstName}
                    {evaluation.employee.employeeCode && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {evaluation.employee.employeeCode}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {evaluation.employee.department?.name ?? "-"}
                  </TableCell>
                  <TableCell>
                    {evaluation.employee.grade?.name ?? "-"}
                  </TableCell>
                  {[1, 2, 3, 4].map((order) => {
                    const selectedEvaluatorId = currentAssignments[order - 1]
                    // 他の列で選択済みの評価者を除外
                    const usedEvaluatorIds = currentAssignments
                      .filter((id, idx) => id && idx !== order - 1)
                      .filter(Boolean) as string[]

                    return (
                      <TableCell key={order}>
                        <Select
                          value={selectedEvaluatorId ?? ""}
                          onValueChange={(value) =>
                            handleEvaluatorChange(evaluation.id, order, value || null)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={EVALUATION_UI_TEXT.SELECT_PLACEHOLDER} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">未設定</SelectItem>
                            {availableEvaluators
                              .filter(
                                (user) =>
                                  !excludedIds.includes(user.id) &&
                                  !usedEvaluatorIds.includes(user.id)
                              )
                              .map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name ?? user.email}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? EVALUATION_UI_TEXT.LOADING : EVALUATION_UI_TEXT.SAVE}
        </Button>
      </div>
    </div>
  )
}

// 評価者割当状況の表示コンポーネント
interface AssignmentStatusProps {
  assignments: Array<{
    id: string
    order: number
    evaluator: User
  }>
}

export function AssignmentStatus({ assignments }: AssignmentStatusProps) {
  if (assignments.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        {EVALUATION_UI_TEXT.NO_EVALUATORS}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {assignments
        .sort((a, b) => a.order - b.order)
        .map((assignment) => (
          <Badge key={assignment.id} variant="secondary" className="text-xs">
            {assignment.order}. {assignment.evaluator.name ?? assignment.evaluator.email}
          </Badge>
        ))}
    </div>
  )
}
