"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { EVALUATION_UI_TEXT, EVALUATION_RATING_OPTIONS } from "@/lib/evaluation/constants"
import type { EvaluationRating } from "@/lib/evaluation/constants"

type CriteriaMatrix = Record<EvaluationRating, Record<EvaluationRating, EvaluationRating>>

interface CriteriaMatrixProps {
  initialMatrix: CriteriaMatrix
  isEditing?: boolean
  onSave?: (matrix: CriteriaMatrix) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

const RATINGS: EvaluationRating[] = ["S", "A", "B", "C", "D"]

export function CriteriaMatrix({
  initialMatrix,
  isEditing = false,
  onSave,
  onCancel,
  isLoading = false,
}: CriteriaMatrixProps) {
  const [matrix, setMatrix] = useState<CriteriaMatrix>(initialMatrix)

  useEffect(() => {
    setMatrix(initialMatrix)
  }, [initialMatrix])

  const handleCellChange = (
    firstHalf: EvaluationRating,
    secondHalf: EvaluationRating,
    value: EvaluationRating
  ) => {
    setMatrix((prev) => ({
      ...prev,
      [firstHalf]: {
        ...prev[firstHalf],
        [secondHalf]: value,
      },
    }))
  }

  const handleSave = async () => {
    if (onSave) {
      await onSave(matrix)
    }
  }

  const getRatingColor = (rating: EvaluationRating) => {
    switch (rating) {
      case "S":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "A":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "B":
        return "bg-green-100 text-green-800 border-green-200"
      case "C":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "D":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-muted"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{EVALUATION_UI_TEXT.EVALUATION_CRITERIA}</CardTitle>
        <CardDescription>
          前期評価と後期評価の組み合わせによる最終評価を設定します
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2 bg-muted text-sm">
                  {EVALUATION_UI_TEXT.FIRST_HALF}＼{EVALUATION_UI_TEXT.SECOND_HALF}
                </th>
                {RATINGS.map((rating) => (
                  <th
                    key={rating}
                    className={cn(
                      "border p-2 text-center font-bold w-16",
                      getRatingColor(rating)
                    )}
                  >
                    {rating}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RATINGS.map((firstHalf) => (
                <tr key={firstHalf}>
                  <td
                    className={cn(
                      "border p-2 text-center font-bold w-16",
                      getRatingColor(firstHalf)
                    )}
                  >
                    {firstHalf}
                  </td>
                  {RATINGS.map((secondHalf) => {
                    const cellValue = matrix[firstHalf][secondHalf]
                    return (
                      <td key={secondHalf} className="border p-1 text-center">
                        {isEditing ? (
                          <Select
                            value={cellValue}
                            onValueChange={(value) =>
                              handleCellChange(
                                firstHalf,
                                secondHalf,
                                value as EvaluationRating
                              )
                            }
                          >
                            <SelectTrigger className="w-full h-8">
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
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center justify-center h-8 w-8 rounded-full font-bold",
                              getRatingColor(cellValue)
                            )}
                          >
                            {cellValue}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isEditing && onSave && (
          <div className="flex justify-end gap-2 mt-4">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                {EVALUATION_UI_TEXT.CANCEL}
              </Button>
            )}
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? EVALUATION_UI_TEXT.LOADING : EVALUATION_UI_TEXT.SAVE}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 評価基準の説明コンポーネント
export function CriteriaExplanation() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">評価基準について</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          最終評価は、前期評価と後期評価の組み合わせにより決定されます。
          マトリクスの縦軸が前期評価、横軸が後期評価を表します。
        </p>

        <div className="grid grid-cols-5 gap-2">
          {EVALUATION_RATING_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="text-center p-2 rounded border"
            >
              <span className="font-bold text-lg">{option.label}</span>
            </div>
          ))}
        </div>

        <ul className="text-sm space-y-1 text-muted-foreground">
          <li><strong>S</strong>: 非常に優秀な成績</li>
          <li><strong>A</strong>: 優秀な成績</li>
          <li><strong>B</strong>: 標準的な成績</li>
          <li><strong>C</strong>: やや改善が必要</li>
          <li><strong>D</strong>: 大幅な改善が必要</li>
        </ul>
      </CardContent>
    </Card>
  )
}
