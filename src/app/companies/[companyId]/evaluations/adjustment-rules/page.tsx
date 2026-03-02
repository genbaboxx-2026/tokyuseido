"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Pencil } from "lucide-react"
import {
  AdjustmentRuleTable,
  AdjustmentMatrixDisplay,
} from "@/components/evaluations/AdjustmentRuleTable"
import { EVALUATION_UI_TEXT } from "@/lib/evaluation/constants"
import type { EvaluationRating } from "@/lib/evaluation/constants"

interface Grade {
  id: string
  name: string
  level: number
  employmentType: string
}

interface AdjustmentRule {
  id?: string
  currentRank: string
  rating: EvaluationRating
  stepAdjustment: number
}

interface GroupedRules {
  grade: Grade
  rules: AdjustmentRule[]
}

export default function AdjustmentRulesPage() {
  const params = useParams()
  const companyId = params.companyId as string

  const [grades, setGrades] = useState<Grade[]>([])
  const [groupedRules, setGroupedRules] = useState<GroupedRules[]>([])
  const [selectedGradeId, setSelectedGradeId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 等級一覧を取得
  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const response = await fetch(`/api/grades?companyId=${companyId}`)
        if (!response.ok) throw new Error("等級の取得に失敗しました")
        const data = await response.json()
        setGrades(data)
        if (data.length > 0) {
          setSelectedGradeId(data[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました")
      }
    }
    fetchGrades()
  }, [companyId])

  // 号俸改定基準を取得
  useEffect(() => {
    const fetchRules = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(
          `/api/evaluations/adjustment-rules?companyId=${companyId}`
        )
        if (!response.ok) throw new Error("号俸改定基準の取得に失敗しました")
        const data = await response.json()
        setGroupedRules(data.grouped || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました")
      } finally {
        setIsLoading(false)
      }
    }

    if (companyId) {
      fetchRules()
    }
  }, [companyId])

  const handleSave = async (rules: AdjustmentRule[]) => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch("/api/evaluations/adjustment-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeId: selectedGradeId,
          rules: rules.map((r) => ({
            currentRank: r.currentRank,
            rating: r.rating,
            stepAdjustment: r.stepAdjustment,
          })),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "保存に失敗しました")
      }

      setIsEditing(false)
      setSuccessMessage("号俸改定基準を保存しました")

      // データを再取得
      const fetchResponse = await fetch(
        `/api/evaluations/adjustment-rules?companyId=${companyId}`
      )
      if (fetchResponse.ok) {
        const data = await fetchResponse.json()
        setGroupedRules(data.grouped || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    } finally {
      setIsSaving(false)
    }
  }

  const selectedGrade = grades.find((g) => g.id === selectedGradeId)
  const selectedGradeRules = groupedRules.find(
    (g) => g.grade.id === selectedGradeId
  )?.rules ?? []

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
          <h1 className="text-2xl font-bold">{EVALUATION_UI_TEXT.ADJUSTMENT_RULES}</h1>
          <p className="text-muted-foreground">
            評価レートに基づく号俸の変動値を等級ごとに設定します
          </p>
        </div>
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

      {/* 等級選択 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">等級を選択</CardTitle>
          <CardDescription>
            号俸改定基準を設定する等級を選択してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Select value={selectedGradeId} onValueChange={setSelectedGradeId}>
                <SelectTrigger>
                  <SelectValue placeholder="等級を選択" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((grade) => (
                    <SelectItem key={grade.id} value={grade.id}>
                      {grade.name} (Level {grade.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedGrade && !isEditing && (
              <Button onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                編集
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 選択した等級の号俸改定基準 */}
      {selectedGrade && (
        <AdjustmentRuleTable
          grade={selectedGrade}
          initialRules={selectedGradeRules}
          isEditing={isEditing}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          isLoading={isSaving}
        />
      )}

      {/* 全等級の一覧表示 */}
      {!isEditing && groupedRules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>全等級の号俸改定基準一覧</CardTitle>
            <CardDescription>
              設定済みの全等級の号俸改定基準を表示します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdjustmentMatrixDisplay
              grades={groupedRules.map((g) => g.grade)}
              rules={groupedRules.map((g) => ({
                gradeId: g.grade.id,
                rules: g.rules,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
