"use client"

import { useState, useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { SALARY_TABLE_UI_TEXT } from "@/lib/salary-table"
import { MismatchAlert } from "./MismatchAlert"
import type { EmployeeSalaryMatch, SalaryMatchStatus } from "@/types/salary"

interface Summary {
  total: number
  exactMatch: number
  approximate: number
  outOfRange: number
  gradeMismatch: number
  notAssigned: number
}

interface EmployeeMappingTableProps {
  matches: EmployeeSalaryMatch[]
  summary: Summary
  salaryTableName?: string
}

const STATUS_COLORS: Record<SalaryMatchStatus, string> = {
  EXACT_MATCH: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  APPROXIMATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  OUT_OF_RANGE: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  GRADE_MISMATCH: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  NOT_ASSIGNED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
}

const STATUS_LABELS: Record<SalaryMatchStatus, string> = {
  EXACT_MATCH: SALARY_TABLE_UI_TEXT.EXACT_MATCH,
  APPROXIMATE: SALARY_TABLE_UI_TEXT.APPROXIMATE,
  OUT_OF_RANGE: SALARY_TABLE_UI_TEXT.OUT_OF_RANGE,
  GRADE_MISMATCH: SALARY_TABLE_UI_TEXT.GRADE_MISMATCH,
  NOT_ASSIGNED: SALARY_TABLE_UI_TEXT.NOT_ASSIGNED,
}

type FilterStatus = SalaryMatchStatus | "ALL" | "ISSUES"

export function EmployeeMappingTable({
  matches,
  summary,
  salaryTableName,
}: EmployeeMappingTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL")

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP").format(value)
  }

  // フィルタリングされたマッチ
  const filteredMatches = useMemo(() => {
    let result = matches

    // ステータスフィルタ
    if (filterStatus === "ISSUES") {
      result = result.filter(
        (m) => m.status === "GRADE_MISMATCH" || m.status === "OUT_OF_RANGE"
      )
    } else if (filterStatus !== "ALL") {
      result = result.filter((m) => m.status === filterStatus)
    }

    // 検索フィルタ
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (m) =>
          m.employeeName.toLowerCase().includes(query) ||
          m.gradeName.toLowerCase().includes(query)
      )
    }

    return result
  }, [matches, filterStatus, searchQuery])

  // ミスマッチがあるかどうか
  const hasMismatch = summary.gradeMismatch > 0 || summary.outOfRange > 0

  return (
    <div className="space-y-6">
      {/* ミスマッチアラート */}
      {hasMismatch && (
        <MismatchAlert
          gradeMismatchCount={summary.gradeMismatch}
          outOfRangeCount={summary.outOfRange}
        />
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">全従業員</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{summary.exactMatch}</div>
            <p className="text-xs text-muted-foreground">{SALARY_TABLE_UI_TEXT.EXACT_MATCH}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{summary.approximate}</div>
            <p className="text-xs text-muted-foreground">{SALARY_TABLE_UI_TEXT.APPROXIMATE}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-600">{summary.outOfRange}</div>
            <p className="text-xs text-muted-foreground">{SALARY_TABLE_UI_TEXT.OUT_OF_RANGE}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{summary.gradeMismatch}</div>
            <p className="text-xs text-muted-foreground">{SALARY_TABLE_UI_TEXT.GRADE_MISMATCH}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-600">{summary.notAssigned}</div>
            <p className="text-xs text-muted-foreground">{SALARY_TABLE_UI_TEXT.NOT_ASSIGNED}</p>
          </CardContent>
        </Card>
      </div>

      {/* テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{SALARY_TABLE_UI_TEXT.EMPLOYEE_MAPPING_TITLE}</CardTitle>
          {salaryTableName && (
            <CardDescription>
              号俸テーブル: {salaryTableName}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {/* フィルタ */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="従業員名または等級で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(value) => setFilterStatus(value as FilterStatus)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="ステータスで絞り込み" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全て表示</SelectItem>
                <SelectItem value="ISSUES">問題のみ</SelectItem>
                <SelectItem value="EXACT_MATCH">{SALARY_TABLE_UI_TEXT.EXACT_MATCH}</SelectItem>
                <SelectItem value="APPROXIMATE">{SALARY_TABLE_UI_TEXT.APPROXIMATE}</SelectItem>
                <SelectItem value="OUT_OF_RANGE">{SALARY_TABLE_UI_TEXT.OUT_OF_RANGE}</SelectItem>
                <SelectItem value="GRADE_MISMATCH">{SALARY_TABLE_UI_TEXT.GRADE_MISMATCH}</SelectItem>
                <SelectItem value="NOT_ASSIGNED">{SALARY_TABLE_UI_TEXT.NOT_ASSIGNED}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* テーブル */}
          {filteredMatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery || filterStatus !== "ALL"
                ? "該当する従業員がいません"
                : SALARY_TABLE_UI_TEXT.NO_EMPLOYEES}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{SALARY_TABLE_UI_TEXT.EMPLOYEE}</TableHead>
                    <TableHead>{SALARY_TABLE_UI_TEXT.GRADE}</TableHead>
                    <TableHead className="text-right">{SALARY_TABLE_UI_TEXT.CURRENT_SALARY}</TableHead>
                    <TableHead className="text-right">{SALARY_TABLE_UI_TEXT.ANNUAL_SALARY}</TableHead>
                    <TableHead className="text-center">{SALARY_TABLE_UI_TEXT.TABLE_POSITION}</TableHead>
                    <TableHead className="text-right">{SALARY_TABLE_UI_TEXT.DIFFERENCE}</TableHead>
                    <TableHead className="text-center">{SALARY_TABLE_UI_TEXT.STATUS}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatches.map((match) => (
                    <TableRow
                      key={match.employeeId}
                      className={cn(
                        (match.status === "GRADE_MISMATCH" || match.status === "OUT_OF_RANGE") &&
                          "bg-red-50 dark:bg-red-950/30"
                      )}
                    >
                      <TableCell className="font-medium">{match.employeeName}</TableCell>
                      <TableCell>{match.gradeName || "-"}</TableCell>
                      <TableCell className="text-right">
                        {match.currentBaseSalary > 0
                          ? `${formatCurrency(match.currentBaseSalary)}${SALARY_TABLE_UI_TEXT.YEN}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {match.currentBaseSalary > 0
                          ? `${formatCurrency(match.currentBaseSalary * 12)}${SALARY_TABLE_UI_TEXT.YEN}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {match.matchedStep && match.matchedRank ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-sm">#{match.matchedStep}</span>
                            <Badge variant="outline">{match.matchedRank}</Badge>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {match.difference !== null ? (
                          <span
                            className={cn(
                              match.difference > 0 && "text-green-600",
                              match.difference < 0 && "text-red-600"
                            )}
                          >
                            {match.difference > 0 ? "+" : ""}
                            {formatCurrency(match.difference)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("font-normal", STATUS_COLORS[match.status])}>
                          {STATUS_LABELS[match.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
