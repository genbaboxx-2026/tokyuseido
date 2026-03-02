"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  EVALUATION_UI_TEXT,
  EVALUATION_SCORE_OPTIONS,
  EVALUATION_SCORE_DESCRIPTIONS,
} from "@/lib/evaluation/constants"

interface EvaluationScoreInputProps {
  value?: number | null
  onChange: (value: number) => void
  label?: string
  disabled?: boolean
  showLabels?: boolean
  size?: "sm" | "md" | "lg"
  comment?: string | null
  onCommentChange?: (comment: string) => void
  showComment?: boolean
}

export function EvaluationScoreInput({
  value,
  onChange,
  label,
  disabled = false,
  showLabels = true,
  size = "md",
  comment,
  onCommentChange,
  showComment = false,
}: EvaluationScoreInputProps) {
  const [hoveredScore, setHoveredScore] = useState<number | null>(null)

  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-base",
    lg: "h-12 w-12 text-lg",
  }

  const getScoreColor = (score: number, isSelected: boolean, isHovered: boolean) => {
    if (!isSelected && !isHovered) return "bg-muted hover:bg-muted/80"

    switch (score) {
      case 5:
        return "bg-green-500 text-white"
      case 4:
        return "bg-green-400 text-white"
      case 3:
        return "bg-yellow-400 text-black"
      case 1:
        return "bg-orange-400 text-white"
      case 0:
        return "bg-red-400 text-white"
      default:
        return "bg-muted"
    }
  }

  const displayScore = hoveredScore ?? value

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      <div className="flex items-center gap-2">
        {EVALUATION_SCORE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              sizeClasses[size],
              "rounded-full font-semibold transition-colors",
              getScoreColor(option.value, value === option.value, hoveredScore === option.value)
            )}
            onClick={() => onChange(option.value)}
            onMouseEnter={() => setHoveredScore(option.value)}
            onMouseLeave={() => setHoveredScore(null)}
            disabled={disabled}
          >
            {option.value}
          </Button>
        ))}
      </div>

      {showLabels && displayScore !== null && displayScore !== undefined && (
        <p className="text-sm text-muted-foreground">
          {EVALUATION_SCORE_DESCRIPTIONS[displayScore]?.short}: {EVALUATION_SCORE_DESCRIPTIONS[displayScore]?.long}
        </p>
      )}

      {showComment && onCommentChange && (
        <div className="mt-2">
          <Label className="text-sm">{EVALUATION_UI_TEXT.COMMENT}</Label>
          <Textarea
            value={comment ?? ""}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="コメントを入力..."
            className="mt-1"
            rows={2}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}

// コンパクトな表示用コンポーネント
interface ScoreBadgeProps {
  score: number | null | undefined
  size?: "sm" | "md"
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span className="text-muted-foreground text-sm">-</span>
    )
  }

  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
  }

  const getColor = (score: number) => {
    switch (score) {
      case 5:
        return "bg-green-500 text-white"
      case 4:
        return "bg-green-400 text-white"
      case 3:
        return "bg-yellow-400 text-black"
      case 1:
        return "bg-orange-400 text-white"
      case 0:
        return "bg-red-400 text-white"
      default:
        return "bg-muted"
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold",
        sizeClasses[size],
        getColor(score)
      )}
    >
      {score}
    </span>
  )
}

// 評価レート表示用コンポーネント
interface RatingBadgeProps {
  rating: "S" | "A" | "B" | "C" | "D" | null | undefined
  size?: "sm" | "md" | "lg"
}

export function RatingBadge({ rating, size = "md" }: RatingBadgeProps) {
  if (!rating) {
    return (
      <span className="text-muted-foreground text-sm">-</span>
    )
  }

  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base",
  }

  const getColor = (rating: string) => {
    switch (rating) {
      case "S":
        return "bg-purple-500 text-white"
      case "A":
        return "bg-blue-500 text-white"
      case "B":
        return "bg-green-500 text-white"
      case "C":
        return "bg-yellow-500 text-black"
      case "D":
        return "bg-red-500 text-white"
      default:
        return "bg-muted"
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold",
        sizeClasses[size],
        getColor(rating)
      )}
    >
      {rating}
    </span>
  )
}
