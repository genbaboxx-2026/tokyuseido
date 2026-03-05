"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Calculator,
  Minus,
  Loader2,
  Save,
  Plus,
  Users,
  Pencil,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// 算定方法のランク型
interface ScoringRank {
  id?: string
  rankName: string
  sortOrder: number
  minScore: number
  maxScore: number | null
}

// 算定方法の型
interface ScoringMethod {
  id: string | null
  companyId: string
  normalizeToHundred: boolean
  ranks: ScoringRank[]
  isDefault: boolean
}

// 従業員評価設定の型
interface EmployeeWeightData {
  id: string
  employeeNumber: string
  name: string
  department: string | null
  jobType: string | null
  grade: string | null
  gradeLevel: number
  score360Max: number | null
  scoreIndividualMax: number | null
  score360MaxCustomized: boolean
  scoreIndividualMaxCustomized: boolean
  weight360: number
  weightIndividual: number
  hasCustomWeight: boolean
}

// 等級の型
interface Grade {
  id: string
  name: string
  level: number
}

// 職種の型
interface JobType {
  id: string
  name: string
}

// 使用可能なランク名（順番通り）
const RANK_NAMES = ["S", "A", "B", "C", "D", "E", "F"]

interface CompanySettingsSectionProps {
  companyId: string
}

export function CompanySettingsSection({ companyId }: CompanySettingsSectionProps) {
  const queryClient = useQueryClient()

  // 算定方法の状態
  const [ranks, setRanks] = useState<ScoringRank[]>([])
  const [isScoringDirty, setIsScoringDirty] = useState(false)

  // 従業員設定の状態（入力中は空文字も許可）
  const [employeeWeights, setEmployeeWeights] = useState<Record<string, number | string>>({})
  const [modifiedEmployees, setModifiedEmployees] = useState<Set<string>>(new Set())

  // 一括設定モーダル
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [bulkGrades, setBulkGrades] = useState<string[]>([])
  const [bulkJobTypes, setBulkJobTypes] = useState<string[]>([])
  const [bulkWeight360, setBulkWeight360] = useState(100)

  // ランク設定アコーディオン（初期状態で閉じる）
  const [isRankSettingsOpen, setIsRankSettingsOpen] = useState(false)

  // 算定方法データ取得
  const { data: scoringData, isLoading: isScoringLoading } = useQuery<ScoringMethod>({
    queryKey: ["scoringMethod", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/evaluation-scoring-method`)
      if (!res.ok) throw new Error("算定方法の取得に失敗しました")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  // 従業員評価設定取得
  const { data: employeeData, isLoading: isEmployeeLoading } = useQuery<{
    employees: EmployeeWeightData[]
  }>({
    queryKey: ["employeeEvaluationWeights", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/employee-evaluation-weights`)
      if (!res.ok) throw new Error("従業員評価設定の取得に失敗しました")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  // 等級一覧取得
  const { data: gradesData } = useQuery<Grade[]>({
    queryKey: ["grades", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/grades?companyId=${companyId}`)
      if (!res.ok) return []
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  // 職種一覧取得
  const { data: jobTypesData } = useQuery<JobType[]>({
    queryKey: ["jobTypes", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/job-categories`)
      if (!res.ok) return []
      const data = await res.json()
      const jobTypes: JobType[] = []
      data.jobCategories?.forEach((cat: { jobTypes?: JobType[] }) => {
        cat.jobTypes?.forEach((jt) => {
          jobTypes.push({ id: jt.id, name: jt.name })
        })
      })
      return jobTypes
    },
    staleTime: 5 * 60 * 1000,
  })

  const employees = employeeData?.employees || []
  const grades = gradesData || []
  const jobTypes = jobTypesData || []

  // 従業員データが取得されたら初期化
  useEffect(() => {
    if (employees.length > 0) {
      const initialWeights: Record<string, number> = {}
      employees.forEach((emp) => {
        initialWeights[emp.id] = emp.weight360
      })
      setEmployeeWeights(initialWeights)
      setModifiedEmployees(new Set())
    }
  }, [employees])

  // 算定方法データ取得後にフォーム状態を初期化
  useEffect(() => {
    if (scoringData) {
      setRanks(scoringData.ranks.map((r) => ({ ...r })))
      setIsScoringDirty(false)
    }
  }, [scoringData])

  // 算定方法保存mutation
  const saveScoringMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/evaluation-scoring-method`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          normalizeToHundred: true,
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
      alert("ランク設定を保存しました")
      setIsScoringDirty(false)
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  // 従業員設定保存mutation
  const saveEmployeeWeightsMutation = useMutation({
    mutationFn: async () => {
      const weights = Object.entries(employeeWeights).map(([employeeId, weight360]) => ({
        employeeId,
        weight360: typeof weight360 === "string" ? (parseInt(weight360, 10) || 0) : weight360,
      }))
      const res = await fetch(`/api/companies/${companyId}/employee-evaluation-weights`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "保存に失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeEvaluationWeights", companyId] })
      alert("評価設定を保存しました")
      setModifiedEmployees(new Set())
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  // 下限値を変更（半角数字のみ許可）
  const handleMinScoreChange = (index: number, value: string) => {
    const sanitized = value.replace(/[^0-9]/g, "")
    const numValue = sanitized === "" ? 0 : Math.max(0, Math.min(100, parseInt(sanitized, 10)))
    const newRanks = [...ranks]
    newRanks[index].minScore = numValue

    if (index > 0) {
      newRanks[index - 1].maxScore = numValue
    }

    setRanks(newRanks)
    setIsScoringDirty(true)
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

    const usedRankNames = new Set(ranks.map((r) => r.rankName))
    const nextRankName = RANK_NAMES.find((name) => !usedRankNames.has(name))

    if (!nextRankName) {
      alert("これ以上ランクを追加できません")
      return
    }

    const newRanks = [...ranks]
    const lastRank = newRanks[newRanks.length - 1]

    if (!lastRank) {
      return
    }

    const secondLastRank = newRanks.length >= 2 ? newRanks[newRanks.length - 2] : null
    const currentLastMaxScore = secondLastRank ? secondLastRank.minScore : 50

    const middleScore = Math.round(currentLastMaxScore / 2)
    lastRank.minScore = middleScore
    lastRank.maxScore = currentLastMaxScore

    newRanks.push({
      rankName: nextRankName,
      sortOrder: ranks.length,
      minScore: 0,
      maxScore: middleScore,
    })

    setRanks(newRanks)
    setIsScoringDirty(true)
  }

  // 最下位ランクを削除
  const handleRemoveRank = () => {
    if (ranks.length <= 2) {
      alert("ランクは最低2段階必要です")
      return
    }

    const newRanks = ranks.slice(0, -1)
    newRanks[newRanks.length - 1].minScore = 0

    setRanks(newRanks)
    setIsScoringDirty(true)
  }

  // 従業員の360度割合を変更
  const handleWeight360Change = (employeeId: string, value: string) => {
    // 半角数字のみ許可
    const sanitized = value.replace(/[^0-9]/g, "")
    setEmployeeWeights((prev) => ({ ...prev, [employeeId]: sanitized }))
    setModifiedEmployees((prev) => new Set(prev).add(employeeId))
  }

  // 入力欄を離れた時に値を正規化（0-100の範囲）
  const handleWeight360Blur = (employeeId: string) => {
    const currentValue = employeeWeights[employeeId]
    const numValue = typeof currentValue === "string" ? parseInt(currentValue, 10) : currentValue
    const clampedValue = isNaN(numValue) ? 0 : Math.max(0, Math.min(100, numValue))
    setEmployeeWeights((prev) => ({ ...prev, [employeeId]: clampedValue }))
  }

  // 数値として取得（表示用）
  const getWeight360AsNumber = (employeeId: string, defaultValue: number): number => {
    const val = employeeWeights[employeeId]
    if (val === undefined) return defaultValue
    if (typeof val === "string") {
      const num = parseInt(val, 10)
      return isNaN(num) ? 0 : num
    }
    return val
  }

  // 一括設定の等級チェックボックス切り替え
  const handleBulkGradeToggle = (gradeName: string) => {
    setBulkGrades((prev) =>
      prev.includes(gradeName)
        ? prev.filter((g) => g !== gradeName)
        : [...prev, gradeName]
    )
  }

  // 一括設定の職種チェックボックス切り替え
  const handleBulkJobTypeToggle = (jobTypeName: string) => {
    setBulkJobTypes((prev) =>
      prev.includes(jobTypeName)
        ? prev.filter((jt) => jt !== jobTypeName)
        : [...prev, jobTypeName]
    )
  }

  // 一括設定の全等級選択
  const handleBulkSelectAllGrades = () => {
    if (bulkGrades.length === grades.length) {
      setBulkGrades([])
    } else {
      setBulkGrades(grades.map((g) => g.name))
    }
  }

  // 一括設定の全職種選択
  const handleBulkSelectAllJobTypes = () => {
    if (bulkJobTypes.length === jobTypes.length) {
      setBulkJobTypes([])
    } else {
      setBulkJobTypes(jobTypes.map((jt) => jt.name))
    }
  }

  // 一括設定を適用
  const handleApplyBulkSetting = () => {
    const targetEmployees = employees.filter((emp) => {
      const gradeMatch = bulkGrades.length === 0 || bulkGrades.includes(emp.grade || "")
      const jobTypeMatch = bulkJobTypes.length === 0 || bulkJobTypes.includes(emp.jobType || "")
      return gradeMatch && jobTypeMatch
    })

    const newWeights = { ...employeeWeights }
    const newModified = new Set(modifiedEmployees)

    targetEmployees.forEach((emp) => {
      newWeights[emp.id] = bulkWeight360
      newModified.add(emp.id)
    })

    setEmployeeWeights(newWeights)
    setModifiedEmployees(newModified)
    setIsBulkDialogOpen(false)
    setBulkGrades([])
    setBulkJobTypes([])
    setBulkWeight360(100)
  }

  const hasUnsavedChanges = modifiedEmployees.size > 0

  return (
    <div className="space-y-6">
      {/* セクション1: ランク設定（アコーディオン） */}
      <Collapsible open={isRankSettingsOpen} onOpenChange={setIsRankSettingsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    ランク設定
                  </CardTitle>
                  <CardDescription>
                    360度評価と個別評価の合算スコア（100点満点）に基づいてランク判定を行います
                  </CardDescription>
                </div>
                {isRankSettingsOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {isScoringLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">
                      ランク閾値
                      <span className="text-xs text-muted-foreground ml-2">（100点満点中）</span>
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
                              <TableCell className="font-bold text-lg">{rank.rankName}</TableCell>
                              <TableCell>
                                {index === ranks.length - 1 ? (
                                  <span className="text-muted-foreground">0</span>
                                ) : (
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
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

                    <div className="flex items-center justify-between">
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
                      <Button
                        onClick={() => saveScoringMutation.mutate()}
                        disabled={!isScoringDirty || saveScoringMutation.isPending}
                      >
                        {saveScoringMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        ランク設定を保存
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* セクション2: 従業員別 評価設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            従業員別 評価設定
          </CardTitle>
          <CardDescription>
            各従業員の360度評価・個別評価の満点と割合を設定します。
            満点はテンプレートから自動取得されます。
            個人カスタマイズ済みの場合はカスタマイズ後の値が表示されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEmployeeLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* 一括設定ボタンと保存ボタン */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="outline" onClick={() => setIsBulkDialogOpen(true)}>
                  等級×職種で一括設定
                </Button>
                <Button
                  onClick={() => saveEmployeeWeightsMutation.mutate()}
                  disabled={!hasUnsavedChanges || saveEmployeeWeightsMutation.isPending}
                >
                  {saveEmployeeWeightsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  設定を保存
                </Button>
              </div>

              {/* 従業員テーブル */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px] text-center">ID</TableHead>
                      <TableHead className="w-[120px] text-center">氏名</TableHead>
                      <TableHead className="w-[100px] text-center">所属</TableHead>
                      <TableHead className="w-[100px] text-center">職種</TableHead>
                      <TableHead className="w-[80px] text-center">等級</TableHead>
                      <TableHead className="w-[80px] text-center">360度満点</TableHead>
                      <TableHead className="w-[100px] text-center">360度割合</TableHead>
                      <TableHead className="w-[80px] text-center">個別満点</TableHead>
                      <TableHead className="w-[80px] text-center">個別割合</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          該当する従業員がいません
                        </TableCell>
                      </TableRow>
                    ) : (
                      employees.map((emp) => {
                        return (
                          <TableRow key={emp.id}>
                            <TableCell className="text-sm text-muted-foreground text-center">
                              {emp.employeeNumber}
                            </TableCell>
                            <TableCell className="font-medium text-center">{emp.name}</TableCell>
                            <TableCell className="text-sm text-center">{emp.department || "-"}</TableCell>
                            <TableCell className="text-sm text-center">{emp.jobType || "-"}</TableCell>
                            <TableCell className="text-sm text-center">{emp.grade || "-"}</TableCell>
                            <TableCell className="text-center">
                              {emp.score360Max !== null ? (
                                <span className="flex items-center justify-center gap-1">
                                  {emp.score360Max}
                                  {emp.score360MaxCustomized && (
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={employeeWeights[emp.id] ?? emp.weight360}
                                  onChange={(e) => handleWeight360Change(emp.id, e.target.value)}
                                  onBlur={() => handleWeight360Blur(emp.id)}
                                  className="w-16 h-8 text-center"
                                />
                                <span className="text-sm">%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {emp.scoreIndividualMax !== null ? (
                                <span className="flex items-center justify-center gap-1">
                                  {emp.scoreIndividualMax}
                                  {emp.scoreIndividualMaxCustomized && (
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <span>{100 - getWeight360AsNumber(emp.id, emp.weight360)}%</span>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground">
                ※ 個別満点が「-」の従業員は個別評価テンプレートが未設定です
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 一括設定ダイアログ */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>等級×職種で一括設定</DialogTitle>
            <DialogDescription>
              対象の等級と職種を選択し、360度評価の割合を設定してください。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 対象等級 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>対象等級 *</Label>
                <Button variant="ghost" size="sm" onClick={handleBulkSelectAllGrades}>
                  {bulkGrades.length === grades.length ? "選択解除" : "すべて選択"}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {grades
                  .sort((a, b) => b.level - a.level)
                  .map((grade) => (
                    <label
                      key={grade.id}
                      className="flex items-center gap-2 p-2 rounded border hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={bulkGrades.includes(grade.name)}
                        onCheckedChange={() => handleBulkGradeToggle(grade.name)}
                      />
                      <span className="text-sm">{grade.name}</span>
                    </label>
                  ))}
              </div>
              {bulkGrades.length === 0 && (
                <p className="text-xs text-muted-foreground">未選択 = 全等級</p>
              )}
            </div>

            {/* 対象職種 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>対象職種 *</Label>
                <Button variant="ghost" size="sm" onClick={handleBulkSelectAllJobTypes}>
                  {bulkJobTypes.length === jobTypes.length ? "選択解除" : "すべて選択"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {jobTypes.map((jt) => (
                  <label
                    key={jt.id}
                    className="flex items-center gap-2 p-2 rounded border hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={bulkJobTypes.includes(jt.name)}
                      onCheckedChange={() => handleBulkJobTypeToggle(jt.name)}
                    />
                    <span className="text-sm">{jt.name}</span>
                  </label>
                ))}
              </div>
              {bulkJobTypes.length === 0 && (
                <p className="text-xs text-muted-foreground">未選択 = 全職種</p>
              )}
            </div>

            {/* 360度割合 */}
            <div className="space-y-2">
              <Label>360度割合</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={bulkWeight360}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/[^0-9]/g, "")
                    const num = parseInt(sanitized, 10) || 0
                    setBulkWeight360(Math.max(0, Math.min(100, num)))
                  }}
                  className="w-24"
                />
                <span className="text-sm">%</span>
                <span className="text-sm text-muted-foreground ml-4">
                  → 個別評価: {100 - bulkWeight360}%
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              ※ 該当する従業員の360度割合が一括で上書きされます
              <br />
              ※ 個別に変更済みの値も上書きされます
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleApplyBulkSetting}>一括設定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
