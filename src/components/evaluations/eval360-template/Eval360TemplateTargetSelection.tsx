"use client"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { type Grade, type JobType } from "./Eval360TemplateTypes"

interface Eval360TemplateTargetSelectionProps {
  grades: Grade[] | undefined
  selectedGradeIds: string[]
  onGradeToggle: (gradeId: string) => void
  onSelectAllGrades: () => void
  jobTypes: JobType[] | undefined
  selectedJobTypeIds: string[]
  onJobTypeToggle: (jobTypeId: string) => void
  onSelectAllJobTypes: () => void
}

export function Eval360TemplateTargetSelection({
  grades,
  selectedGradeIds,
  onGradeToggle,
  onSelectAllGrades,
  jobTypes,
  selectedJobTypeIds,
  onJobTypeToggle,
  onSelectAllJobTypes,
}: Eval360TemplateTargetSelectionProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">対象等級・職種 *</h2>
      <Card>
        <CardContent className="pt-6 space-y-6">
        {/* 等級セクション */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">等級</Label>
            <Button variant="ghost" size="sm" onClick={onSelectAllGrades}>
              すべて選択
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {grades?.sort((a, b) => b.level - a.level).map((grade) => (
              <label
                key={grade.id}
                className="flex items-center gap-2 p-2 rounded border hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selectedGradeIds.includes(grade.id)}
                  onCheckedChange={() => onGradeToggle(grade.id)}
                />
                <span className="text-sm">{grade.name}</span>
              </label>
            ))}
          </div>
          {selectedGradeIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedGradeIds.length}件選択中
            </p>
          )}
        </div>

        {/* 職種セクション */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">職種</Label>
            <Button variant="ghost" size="sm" onClick={onSelectAllJobTypes}>
              すべて選択
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {jobTypes?.map((jt) => (
              <label
                key={jt.id}
                className="flex items-center gap-2 p-2 rounded border hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selectedJobTypeIds.includes(jt.id)}
                  onCheckedChange={() => onJobTypeToggle(jt.id)}
                />
                <span className="text-sm">{jt.name}</span>
              </label>
            ))}
          </div>
          {selectedJobTypeIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedJobTypeIds.length}件選択中
            </p>
          )}
        </div>
        </CardContent>
      </Card>
    </div>
  )
}
