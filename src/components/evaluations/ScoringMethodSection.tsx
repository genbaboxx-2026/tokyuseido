"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Loader2,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface ScoringMethodSectionProps {
  companyId: string
}

interface Rank {
  id?: string
  rankName: string
  sortOrder: number
  minScore: number
  maxScore: number | null
}

interface ScoringMethod {
  id: string | null
  companyId: string
  normalizeToHundred: boolean
  ranks: Rank[]
  isDefault: boolean
}

// 使用可能なランク名（順番通り）
const RANK_NAMES = ["S", "A", "B", "C", "D", "E", "F"]

export function ScoringMethodSection({ companyId }: ScoringMethodSectionProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [normalizeToHundred, setNormalizeToHundred] = useState(true)
  const [ranks, setRanks] = useState<Rank[]>([])
  const [isDirty, setIsDirty] = useState(false)

  // データ取得
  const { data, isLoading } = useQuery<ScoringMethod>({
    queryKey: ["scoringMethod", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/evaluation-scoring-method`)
      if (!res.ok) throw new Error("算定方法の取得に失敗しました")
      return res.json()
    },
  })

  // データ取得後にフォーム状態を初期化
  useEffect(() => {
    if (data) {
      setNormalizeToHundred(data.normalizeToHundred)
      setRanks(data.ranks.map(r => ({ ...r })))
      setIsDirty(false)
    }
  }, [data])

  // 保存mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/evaluation-scoring-method`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          normalizeToHundred,
          ranks,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "保存に失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoringMethod", companyId] })
      alert("算定方法を保存しました")
      setIsDirty(false)
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  // 下限値を変更
  const handleMinScoreChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0
    const newRanks = [...ranks]
    newRanks[index].minScore = numValue

    // 上のランク（index - 1）のmaxScoreを自動更新
    if (index > 0) {
      newRanks[index - 1].maxScore = numValue
    }

    setRanks(newRanks)
    setIsDirty(true)
  }

  // ランクを追加（最下位に）
  const handleAddRank = () => {
    if (ranks.length >= 7) {
      alert("ランクは最大7段階です")
      return
    }

    if (ranks.length === 0) {
      alert("ランクが読み込まれていません")
      return
    }

    // 次のランク名を決定
    const usedRankNames = new Set(ranks.map(r => r.rankName))
    const nextRankName = RANK_NAMES.find(name => !usedRankNames.has(name))

    if (!nextRankName) {
      alert("これ以上ランクを追加できません")
      return
    }

    const newRanks = [...ranks]
    const lastRank = newRanks[newRanks.length - 1]

    if (!lastRank) {
      return
    }

    // 現在の最下位ランクのmaxScoreを取得（1つ上のランクのminScoreと同じ）
    const secondLastRank = newRanks.length >= 2 ? newRanks[newRanks.length - 2] : null
    const currentLastMaxScore = secondLastRank ? secondLastRank.minScore : 50

    // 最後のランクの下限を更新（中間に）
    const middleScore = Math.round(currentLastMaxScore / 2)
    lastRank.minScore = middleScore
    lastRank.maxScore = currentLastMaxScore

    // 新しいランクを追加
    newRanks.push({
      rankName: nextRankName,
      sortOrder: ranks.length,
      minScore: 0,
      maxScore: middleScore,
    })

    setRanks(newRanks)
    setIsDirty(true)
  }

  // 最下位ランクを削除
  const handleRemoveRank = () => {
    if (ranks.length <= 2) {
      alert("ランクは最低2段階必要です")
      return
    }

    const newRanks = ranks.slice(0, -1)
    // 新しい最下位ランクのminScoreを0に、maxScoreをnullに
    newRanks[newRanks.length - 1].minScore = 0

    setRanks(newRanks)
    setIsDirty(true)
  }

  // 正規化設定変更
  const handleNormalizeChange = (checked: boolean) => {
    setNormalizeToHundred(checked)
    setIsDirty(true)
  }

  // 合計点の計算（素点上限）
  const totalMaxScore = 100 // 正規化ONの場合は100点満点

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  算定方法
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* 正規化設定 */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">正規化設定</h4>
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor="normalize-switch" className="font-medium">
                        素点を100点満点に正規化する
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {normalizeToHundred
                          ? "ONの場合、素点合計をテンプレート満点合計で割り100を掛けた値でランク判定を行います"
                          : "OFFの場合、素点合計のままランク判定を行います（ランク閾値もテンプレート満点合計に合わせて設定してください）"}
                      </p>
                    </div>
                    <Switch
                      id="normalize-switch"
                      checked={normalizeToHundred}
                      onCheckedChange={handleNormalizeChange}
                    />
                  </div>
                </div>

                {/* ランク設定 */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">
                    ランク設定
                    {normalizeToHundred && (
                      <span className="text-xs text-muted-foreground ml-2">（100点満点中）</span>
                    )}
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">ランク</TableHead>
                          <TableHead className="w-[150px]">下限（以上）</TableHead>
                          <TableHead className="w-[150px]">上限（未満）</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ranks.map((rank, index) => (
                          <TableRow key={rank.rankName}>
                            <TableCell className="font-bold text-lg">
                              {rank.rankName}
                            </TableCell>
                            <TableCell>
                              {index === ranks.length - 1 ? (
                                // 最下位ランクの下限は0固定
                                <span className="text-muted-foreground">0</span>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  max={normalizeToHundred ? 100 : undefined}
                                  step="0.1"
                                  value={rank.minScore}
                                  onChange={(e) => handleMinScoreChange(index, e.target.value)}
                                  className="w-24"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {rank.maxScore === null ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <span className="text-muted-foreground">{rank.maxScore}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* ランク追加・削除ボタン */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddRank}
                      disabled={ranks.length === 0 || ranks.length >= 7}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      ランクを追加
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveRank}
                      disabled={ranks.length <= 2}
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      最下位ランクを削除
                    </Button>
                  </div>
                </div>

                {/* 保存ボタン */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={!isDirty || saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    保存
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
