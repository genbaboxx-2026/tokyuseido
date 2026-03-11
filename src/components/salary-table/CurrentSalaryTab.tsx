"use client"

import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Save, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

interface EmployeeCurrentSalaryData {
  employeeId: string
  employeeNumber: string
  name: string
  gradeId: string | null
  gradeName: string
  gradeLevel: number
  jobTypeName: string
  currentSalary: number | null
}

interface CurrentSalaryTabProps {
  salaryTableId: string
}

// 3桁カンマ区切りフォーマット
function formatCurrency(value: number | null): string {
  if (value === null || value === 0) return ""
  return new Intl.NumberFormat("ja-JP").format(value)
}

// カンマを除去して数値に変換
function parseCurrency(value: string): number {
  const cleaned = value.replace(/,/g, "").replace(/[^0-9]/g, "")
  return cleaned === "" ? 0 : parseInt(cleaned, 10)
}

export function CurrentSalaryTab({ salaryTableId }: CurrentSalaryTabProps) {
  const queryClient = useQueryClient()
  const [editedSalaries, setEditedSalaries] = useState<Map<string, number>>(new Map())
  const [gradeFilter, setGradeFilter] = useState<string>("all")
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // データ取得
  const { data, isLoading, error } = useQuery<{
    employees: EmployeeCurrentSalaryData[]
    salaryTable: { id: string; name: string }
  }>({
    queryKey: ["current-salaries", salaryTableId],
    queryFn: async () => {
      const res = await fetch(`/api/salary-tables/${salaryTableId}/current-salaries`)
      if (!res.ok) throw new Error("現基本給データの取得に失敗しました")
      return res.json()
    },
  })

  // 保存ミューテーション
  const saveMutation = useMutation({
    mutationFn: async (salaries: { employeeId: string; currentSalary: number }[]) => {
      const res = await fetch(`/api/salary-tables/${salaryTableId}/current-salaries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salaries }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "保存に失敗しました")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-salaries", salaryTableId] })
      setEditedSalaries(new Map())
      setSaveStatus({ type: "success", message: "現基本給を保存しました" })
      setTimeout(() => setSaveStatus(null), 3000)
    },
    onError: (error: Error) => {
      setSaveStatus({ type: "error", message: error.message })
    },
  })

  // 等級一覧（フィルター用）
  const grades = useMemo(() => {
    if (!data?.employees) return []
    const gradeMap = new Map<string, { id: string; name: string; level: number }>()
    data.employees.forEach((emp) => {
      if (emp.gradeId && !gradeMap.has(emp.gradeId)) {
        gradeMap.set(emp.gradeId, {
          id: emp.gradeId,
          name: emp.gradeName,
          level: emp.gradeLevel,
        })
      }
    })
    return Array.from(gradeMap.values()).sort((a, b) => b.level - a.level)
  }, [data?.employees])

  // フィルタリングされた従業員
  const filteredEmployees = useMemo(() => {
    if (!data?.employees) return []
    if (gradeFilter === "all") return data.employees
    return data.employees.filter((emp) => emp.gradeId === gradeFilter)
  }, [data?.employees, gradeFilter])

  // 値変更ハンドラー
  const handleSalaryChange = useCallback((employeeId: string, value: string) => {
    const numValue = parseCurrency(value)
    setEditedSalaries((prev) => {
      const next = new Map(prev)
      next.set(employeeId, numValue)
      return next
    })
  }, [])

  // 現在の表示値を取得
  const getCurrentValue = useCallback(
    (emp: EmployeeCurrentSalaryData): number | null => {
      if (editedSalaries.has(emp.employeeId)) {
        return editedSalaries.get(emp.employeeId) || null
      }
      return emp.currentSalary
    },
    [editedSalaries]
  )

  // 保存ハンドラー
  const handleSave = useCallback(() => {
    if (editedSalaries.size === 0) return

    const salaries = Array.from(editedSalaries.entries()).map(([employeeId, currentSalary]) => ({
      employeeId,
      currentSalary,
    }))

    saveMutation.mutate(salaries)
  }, [editedSalaries, saveMutation])

  // 変更件数
  const changedCount = editedSalaries.size

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">データの取得に失敗しました</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 右上の保存ボタン */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={changedCount === 0 || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              保存
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>現基本給設定</CardTitle>
          <CardDescription>
            号俸テーブル設計のため、従業員の現在の基本給を入力してください
          </CardDescription>
        </CardHeader>
      <CardContent>
        {/* 保存結果メッセージ */}
        {saveStatus && (
          <Alert variant={saveStatus.type === "error" ? "destructive" : "default"} className="mb-4">
            {saveStatus.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{saveStatus.message}</AlertDescription>
          </Alert>
        )}

        {/* フィルター */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">等級:</span>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全て" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade.id} value={grade.id}>
                    {grade.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredEmployees.length}名を表示
          </div>
        </div>

        {/* テーブル */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">社員番号</TableHead>
                <TableHead className="w-32">氏名</TableHead>
                <TableHead className="w-24">等級</TableHead>
                <TableHead className="w-32">職種</TableHead>
                <TableHead className="w-48 text-right">現基本給</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    従業員がいません
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp) => {
                  const currentValue = getCurrentValue(emp)
                  const isEdited = editedSalaries.has(emp.employeeId)
                  const displayValue = formatCurrency(currentValue)

                  return (
                    <TableRow key={emp.employeeId}>
                      <TableCell className="font-mono text-sm">{emp.employeeNumber}</TableCell>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>
                        {emp.gradeName ? (
                          <Badge variant="outline">{emp.gradeName}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {emp.jobTypeName || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={displayValue}
                            onChange={(e) => handleSalaryChange(emp.employeeId, e.target.value)}
                            className={`w-32 text-right ${isEdited ? "border-orange-400" : ""}`}
                            placeholder="0"
                          />
                          <span className="text-sm text-muted-foreground">円</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isEdited && (
                          <Badge variant="outline" className="text-orange-500 border-orange-300">
                            未保存
                          </Badge>
                        )}
                        {!isEdited && currentValue && currentValue > 0 && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    </div>
  )
}
