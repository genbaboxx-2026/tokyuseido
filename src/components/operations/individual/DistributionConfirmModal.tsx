"use client"

import React, { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Send, AlertCircle, Calendar, Mail, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface Evaluation {
  id: string
  employee: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    department?: { name: string; id?: string } | null
    grade?: { name: string; id?: string } | null
    jobType?: { name: string; id?: string } | null
  }
  evaluator?: {
    id: string
    firstName: string
    lastName: string
  } | null
  evaluatorId: string | null
  itemStats: {
    total: number
    selfScored?: number
    managerScored?: number
  }
}

interface DistributionConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  periodId: string
  evaluations: Evaluation[]
  onSuccess: () => void
}

export function DistributionConfirmModal({
  open,
  onOpenChange,
  companyId,
  periodId,
  evaluations,
  onSuccess,
}: DistributionConfirmModalProps) {
  const queryClient = useQueryClient()

  // デフォルトの回答期限: 2週間後
  const defaultDeadline = new Date()
  defaultDeadline.setDate(defaultDeadline.getDate() + 14)
  const [responseDeadline, setResponseDeadline] = useState(
    defaultDeadline.toISOString().split("T")[0]
  )

  const [error, setError] = useState<string | null>(null)

  // 配布可能な評価のみフィルタリング
  const distributableEvaluations = evaluations.filter(
    (e) => e.itemStats.total > 0 && e.evaluatorId
  )

  // 配布不可の評価
  const invalidEvaluations = evaluations.filter(
    (e) => e.itemStats.total === 0 || !e.evaluatorId
  )

  // メール送信可能な評価
  const emailableEvaluations = distributableEvaluations.filter(
    (e) => e.employee.email
  )

  const distributeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/companies/${companyId}/operations/${periodId}/individual/distribute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evaluationIds: distributableEvaluations.map((e) => e.id),
            responseDeadline,
          }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "配布に失敗しました")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["individualEvaluations", companyId, periodId],
      })
      queryClient.invalidateQueries({
        queryKey: ["individualPhaseCounts", companyId, periodId],
      })
      onSuccess()
      onOpenChange(false)
      alert(data.message)
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  const handleDistribute = () => {
    setError(null)
    distributeMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            配布確認
          </DialogTitle>
          <DialogDescription>
            自己評価依頼を配布します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* サマリー */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {distributableEvaluations.length}
              </div>
              <div className="text-xs text-muted-foreground">配布対象</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">
                {emailableEvaluations.length}
              </div>
              <div className="text-xs text-muted-foreground">メール送信</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {invalidEvaluations.length}
              </div>
              <div className="text-xs text-muted-foreground">配布不可</div>
            </div>
          </div>

          {/* 回答期限設定 */}
          <div className="space-y-2">
            <Label htmlFor="deadline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              回答期限
            </Label>
            <Input
              id="deadline"
              type="date"
              value={responseDeadline}
              onChange={(e) => setResponseDeadline(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* 配布対象リスト */}
          {distributableEvaluations.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                配布対象者
              </Label>
              <div className="max-h-40 overflow-y-auto border rounded-lg">
                {distributableEvaluations.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between px-3 py-2 border-b last:border-b-0"
                  >
                    <div>
                      <span className="font-medium">
                        {e.employee.lastName} {e.employee.firstName}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({e.employee.department?.name || "-"})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.employee.email ? (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <Mail className="h-3 w-3 mr-1" />
                          送信可
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-400">
                          メールなし
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 配布不可リスト */}
          {invalidEvaluations.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-1">以下は配布できません:</p>
                <ul className="text-sm space-y-1">
                  {invalidEvaluations.map((e) => (
                    <li key={e.id}>
                      {e.employee.lastName} {e.employee.firstName}:
                      {e.itemStats.total === 0 && " 評価項目なし"}
                      {!e.evaluatorId && " 評価者未設定"}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* エラー表示 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleDistribute}
            disabled={
              distributableEvaluations.length === 0 ||
              distributeMutation.isPending
            }
            className="bg-blue-600 hover:bg-blue-700"
          >
            {distributeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                配布中...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {distributableEvaluations.length}件を配布
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
