"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Grade {
  id: string
  name: string
  level: number
}

interface GradeBandAssignment {
  gradeId: string
  startBand: number
  bandsPerGrade: number
  rankBands: { rank: string; bandNumber: number }[]
}

interface GradeBandMappingTableProps {
  grades: Grade[]
  totalBands: number
  bandsPerGrade: number
  rankLetters: string[] // ["S", "A", "B", "C", "D"] など
  gradeBandAssignments: GradeBandAssignment[]
  onGradeStartBandChange?: (gradeId: string, startBand: number) => void
  readOnly?: boolean
}

// ランク文字の色マッピング
const RANK_COLORS: Record<string, string> = {
  S: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  A: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  B: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  C: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  D: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  E: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
}

export function GradeBandMappingTable({
  grades,
  totalBands,
  bandsPerGrade,
  rankLetters,
  gradeBandAssignments,
  onGradeStartBandChange,
  readOnly = false,
}: GradeBandMappingTableProps) {
  // 等級をレベルの降順でソート
  const sortedGrades = useMemo(() => {
    return [...grades].sort((a, b) => b.level - a.level)
  }, [grades])

  // 号俸帯番号の配列を生成（1〜totalBands）
  const bandNumbers = useMemo(() => {
    return Array.from({ length: totalBands }, (_, i) => i + 1)
  }, [totalBands])

  // 各等級の号俸帯マッピングを取得
  const getGradeBandMapping = (gradeId: string) => {
    const assignment = gradeBandAssignments.find(a => a.gradeId === gradeId)
    if (!assignment) return new Map<number, string>()

    const mapping = new Map<number, string>()

    // ランク文字をDからSの順で逆順にする
    const reversedRanks = [...rankLetters].reverse()

    for (let i = 0; i < reversedRanks.length; i++) {
      const bandNum = assignment.startBand + i
      if (bandNum <= totalBands) {
        mapping.set(bandNum, reversedRanks[i])
      }
    }

    // 範囲外（上の号俸帯）は↓で表示
    for (let bandNum = assignment.startBand + reversedRanks.length; bandNum <= totalBands; bandNum++) {
      mapping.set(bandNum, "↓")
    }

    return mapping
  }

  // 開始号俸帯の選択肢を生成
  const getStartBandOptions = () => {
    return bandNumbers.filter(band => band + bandsPerGrade - 1 <= totalBands)
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">等級×号俸帯マッピング</h3>
      <div className="overflow-auto">
        <table className="w-full text-xs border-collapse border border-gray-300 dark:border-gray-600">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="px-2 py-1.5 text-left font-semibold border border-gray-300 dark:border-gray-600 min-w-[60px]">
                等級
              </th>
              {bandNumbers.map((band) => (
                <th
                  key={band}
                  className="px-1 py-1.5 text-center font-semibold border border-gray-300 dark:border-gray-600 min-w-[32px]"
                >
                  {band}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedGrades.map((grade) => {
              const bandMapping = getGradeBandMapping(grade.id)
              const assignment = gradeBandAssignments.find(a => a.gradeId === grade.id)

              return (
                <tr
                  key={grade.id}
                  className="border-b border-dashed border-gray-300 dark:border-gray-600"
                >
                  <td className="px-2 py-1 font-medium border border-gray-300 dark:border-gray-600">
                    {!readOnly && onGradeStartBandChange ? (
                      <div className="flex items-center gap-1">
                        <span className="min-w-[32px]">{grade.name}</span>
                        <Select
                          value={assignment?.startBand?.toString() || ""}
                          onValueChange={(value) => {
                            onGradeStartBandChange(grade.id, parseInt(value))
                          }}
                        >
                          <SelectTrigger className="h-6 w-16 text-xs">
                            <SelectValue placeholder="帯" />
                          </SelectTrigger>
                          <SelectContent>
                            {getStartBandOptions().map((band) => (
                              <SelectItem key={band} value={band.toString()}>
                                帯{band}〜
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      grade.name
                    )}
                  </td>
                  {bandNumbers.map((band) => {
                    const rankLetter = bandMapping.get(band)
                    const colorClass = rankLetter && rankLetter !== "↓" ? RANK_COLORS[rankLetter] : ""

                    return (
                      <td
                        key={band}
                        className={cn(
                          "px-1 py-1 text-center border border-gray-300 dark:border-gray-600",
                          colorClass
                        )}
                      >
                        {rankLetter === "↓" ? (
                          <span className="text-gray-400">↓</span>
                        ) : (
                          rankLetter || ""
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {/* 最下行: 号俸帯番号を再表示 */}
            <tr className="bg-gray-50 dark:bg-gray-900/50">
              <td className="px-2 py-1 text-center text-muted-foreground border border-gray-300 dark:border-gray-600">
                ↓
              </td>
              {bandNumbers.map((band) => (
                <td
                  key={band}
                  className="px-1 py-1 text-center text-muted-foreground border border-gray-300 dark:border-gray-600"
                >
                  ↓
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
