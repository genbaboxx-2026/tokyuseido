"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GRADE_UI_TEXT } from "@/lib/grade/constants"

interface ResponsibilityListProps {
  responsibilities: string[]
  onChange: (responsibilities: string[]) => void
  disabled?: boolean
}

export function ResponsibilityList({
  responsibilities,
  onChange,
  disabled = false,
}: ResponsibilityListProps) {
  const handleAdd = () => {
    onChange([...responsibilities, ""])
  }

  const handleRemove = (index: number) => {
    const newResponsibilities = responsibilities.filter((_, i) => i !== index)
    onChange(newResponsibilities)
  }

  const handleChange = (index: number, value: string) => {
    const newResponsibilities = [...responsibilities]
    newResponsibilities[index] = value
    onChange(newResponsibilities)
  }

  return (
    <div className="space-y-2">
      {responsibilities.map((responsibility, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-muted-foreground w-6 text-sm">{index + 1}.</span>
          <Input
            value={responsibility}
            onChange={(e) => handleChange(index, e.target.value)}
            placeholder="役割責任を入力"
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleRemove(index)}
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">削除</span>
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={disabled}
        className="mt-2"
      >
        <Plus className="h-4 w-4 mr-1" />
        {GRADE_UI_TEXT.ADD_ITEM}
      </Button>
    </div>
  )
}
