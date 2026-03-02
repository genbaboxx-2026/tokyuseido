"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { EVALUATION_UI_TEXT, EVALUATION_RATING_OPTIONS } from "@/lib/evaluation/constants"
import type { EvaluationRating } from "@/lib/evaluation/constants"

interface AdjustmentRule {
  id?: string
  currentRank: string
  rating: EvaluationRating
  stepAdjustment: number
}

interface Grade {
  id: string
  name: string
  level: number
}

interface AdjustmentRuleTableProps {
  grade: Grade
  initialRules: AdjustmentRule[]
  isEditing?: boolean
  onSave?: (rules: AdjustmentRule[]) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  ranks?: string[] // 使用可能なランク一覧（例: ["A", "B", "C"]）
}

const DEFAULT_RANKS = ["A", "B", "C"]

export function AdjustmentRuleTable({
  grade,
  initialRules,
  isEditing = false,
  onSave,
  onCancel,
  isLoading = false,
  ranks = DEFAULT_RANKS,
}: AdjustmentRuleTableProps) {
  const [rules, setRules] = useState<AdjustmentRule[]>(initialRules)

  useEffect(() => {
    setRules(initialRules)
  }, [initialRules])

  const handleRuleChange = (
    index: number,
    field: keyof AdjustmentRule,
    value: string | number
  ) => {
    setRules((prev) => {
      const newRules = [...prev]
      newRules[index] = { ...newRules[index], [field]: value }
      return newRules
    })
  }

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        currentRank: ranks[0] || "A",
        rating: "B" as EvaluationRating,
        stepAdjustment: 0,
      },
    ])
  }

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (onSave) {
      await onSave(rules)
    }
  }

  const getAdjustmentDisplay = (adjustment: number) => {
    if (adjustment > 0) return `+${adjustment}`
    if (adjustment < 0) return `${adjustment}`
    return "0"
  }

  const getAdjustmentColor = (adjustment: number) => {
    if (adjustment > 0) return "text-green-600"
    if (adjustment < 0) return "text-red-600"
    return "text-muted-foreground"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{grade.name} - {EVALUATION_UI_TEXT.ADJUSTMENT_RULES}</CardTitle>
        <CardDescription>
          評価レートとランクに応じた号俸の変動値を設定します
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>現在のランク</TableHead>
                  <TableHead>{EVALUATION_UI_TEXT.FINAL_RATING}</TableHead>
                  <TableHead>号俸変動</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Select
                        value={rule.currentRank}
                        onValueChange={(value) =>
                          handleRuleChange(index, "currentRank", value)
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ranks.map((rank) => (
                            <SelectItem key={rank} value={rank}>
                              {rank}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={rule.rating}
                        onValueChange={(value) =>
                          handleRuleChange(index, "rating", value)
                        }
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EVALUATION_RATING_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={rule.stepAdjustment}
                        onChange={(e) =>
                          handleRuleChange(
                            index,
                            "stepAdjustment",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-24"
                        min={-10}
                        max={10}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRule(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Button variant="outline" onClick={handleAddRule} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              ルールを追加
            </Button>

            <div className="flex justify-end gap-2 pt-4">
              {onCancel && (
                <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                  {EVALUATION_UI_TEXT.CANCEL}
                </Button>
              )}
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? EVALUATION_UI_TEXT.LOADING : EVALUATION_UI_TEXT.SAVE}
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>現在のランク</TableHead>
                <TableHead>{EVALUATION_UI_TEXT.FINAL_RATING}</TableHead>
                <TableHead className="text-right">号俸変動</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {EVALUATION_UI_TEXT.NO_DATA}
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{rule.currentRank}</TableCell>
                    <TableCell>{rule.rating}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        getAdjustmentColor(rule.stepAdjustment)
                      )}
                    >
                      {getAdjustmentDisplay(rule.stepAdjustment)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// 号俸改定基準のマトリクス表示
interface AdjustmentMatrixDisplayProps {
  grades: Grade[]
  rules: Array<{
    gradeId: string
    rules: AdjustmentRule[]
  }>
  ranks?: string[]
}

export function AdjustmentMatrixDisplay({
  grades,
  rules,
  ranks = DEFAULT_RANKS,
}: AdjustmentMatrixDisplayProps) {
  const RATINGS: EvaluationRating[] = ["S", "A", "B", "C", "D"]

  const getAdjustment = (
    gradeId: string,
    currentRank: string,
    rating: EvaluationRating
  ): number | null => {
    const gradeRules = rules.find((r) => r.gradeId === gradeId)
    if (!gradeRules) return null

    const rule = gradeRules.rules.find(
      (r) => r.currentRank === currentRank && r.rating === rating
    )
    return rule?.stepAdjustment ?? null
  }

  const getAdjustmentDisplay = (adjustment: number | null) => {
    if (adjustment === null) return "-"
    if (adjustment > 0) return `+${adjustment}`
    if (adjustment < 0) return `${adjustment}`
    return "0"
  }

  const getAdjustmentColor = (adjustment: number | null) => {
    if (adjustment === null) return "text-muted-foreground"
    if (adjustment > 0) return "text-green-600 font-medium"
    if (adjustment < 0) return "text-red-600 font-medium"
    return "text-muted-foreground"
  }

  return (
    <div className="space-y-6">
      {grades.map((grade) => (
        <Card key={grade.id}>
          <CardHeader>
            <CardTitle className="text-lg">{grade.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ランク＼評価</TableHead>
                    {RATINGS.map((rating) => (
                      <TableHead key={rating} className="text-center">
                        {rating}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranks.map((rank) => (
                    <TableRow key={rank}>
                      <TableCell className="font-medium">{rank}</TableCell>
                      {RATINGS.map((rating) => {
                        const adjustment = getAdjustment(grade.id, rank, rating)
                        return (
                          <TableCell
                            key={rating}
                            className={cn(
                              "text-center",
                              getAdjustmentColor(adjustment)
                            )}
                          >
                            {getAdjustmentDisplay(adjustment)}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
