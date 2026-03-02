"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Pencil } from "lucide-react"
import { CriteriaMatrix, CriteriaExplanation } from "@/components/evaluations/CriteriaMatrix"
import { EVALUATION_UI_TEXT } from "@/lib/evaluation/constants"
import { DEFAULT_CRITERIA_MATRIX, matrixToArray } from "@/lib/evaluation/criteria"
import type { EvaluationRating } from "@/lib/evaluation/constants"

type CriteriaMatrixType = Record<EvaluationRating, Record<EvaluationRating, EvaluationRating>>

export default function EvaluationCriteriaPage() {
  const params = useParams()
  const companyId = params.companyId as string

  const [matrix, setMatrix] = useState<CriteriaMatrixType>(DEFAULT_CRITERIA_MATRIX)
  const [isDefault, setIsDefault] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 評価基準を取得
  useEffect(() => {
    const fetchCriteria = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/evaluations/criteria?companyId=${companyId}`)
        if (!response.ok) throw new Error("評価基準の取得に失敗しました")
        const data = await response.json()
        setMatrix(data.matrix)
        setIsDefault(data.isDefault)
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました")
      } finally {
        setIsLoading(false)
      }
    }

    fetchCriteria()
  }, [companyId])

  const handleSave = async (newMatrix: CriteriaMatrixType) => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)

      // マトリクスを配列形式に変換
      const criteria = matrixToArray(newMatrix)

      const response = await fetch("/api/evaluations/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          criteria,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "保存に失敗しました")
      }

      const data = await response.json()
      setMatrix(data.matrix)
      setIsDefault(false)
      setIsEditing(false)
      setSuccessMessage("評価基準を保存しました")
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${companyId}/evaluations`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{EVALUATION_UI_TEXT.EVALUATION_CRITERIA}</h1>
          <p className="text-muted-foreground">
            前期評価と後期評価から最終評価を算出するマトリクスを設定します
          </p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            編集
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => setError(null)}
          >
            閉じる
          </Button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 text-green-800 p-4 rounded-md">
          {successMessage}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => setSuccessMessage(null)}
          >
            閉じる
          </Button>
        </div>
      )}

      {isDefault && !isEditing && (
        <div className="bg-blue-50 text-blue-800 p-4 rounded-md">
          デフォルトの評価基準を使用しています。カスタマイズする場合は「編集」ボタンをクリックしてください。
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <CriteriaMatrix
          initialMatrix={matrix}
          isEditing={isEditing}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          isLoading={isSaving}
        />
        <CriteriaExplanation />
      </div>
    </div>
  )
}
