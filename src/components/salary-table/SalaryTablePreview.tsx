"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, ArrowUp, ArrowDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { SALARY_TABLE_UI_TEXT } from "@/lib/salary-table"
import type { SalaryTableChange } from "@/types/salary"

interface EmployeeImpact {
  employeeId: string
  employeeName: string
  gradeName: string
  currentBaseSalary: number
  currentStep: number | null
  currentRank: string | null
  newStep: number | null
  newRank: string | null
  tableBaseSalary: number | null
  difference: number
}

interface PreviewSummary {
  totalChanges: number
  affectedEmployees: number
  totalEmployees: number
}

interface SalaryTablePreviewProps {
  changes: SalaryTableChange[]
  employeeImpacts?: EmployeeImpact[]
  summary?: PreviewSummary
  maxDisplayChanges?: number
}

export function SalaryTablePreview({
  changes,
  employeeImpacts = [],
  summary,
  maxDisplayChanges = 20,
}: SalaryTablePreviewProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP").format(value)
  }

  const formatDifference = (diff: number) => {
    if (diff === 0) return <Minus className="h-4 w-4 text-muted-foreground" />
    if (diff > 0) {
      return (
        <span className="flex items-center text-green-600">
          <ArrowUp className="h-4 w-4 mr-1" />+{formatCurrency(diff)}
        </span>
      )
    }
    return (
      <span className="flex items-center text-red-600">
        <ArrowDown className="h-4 w-4 mr-1" />{formatCurrency(diff)}
      </span>
    )
  }

  const displayChanges = changes.slice(0, maxDisplayChanges)
  const hasMoreChanges = changes.length > maxDisplayChanges

  return (
    <div className="space-y-6">
      {/* サマリー */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.totalChanges}</div>
              <p className="text-xs text-muted-foreground">変更されるエントリ数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.affectedEmployees}</div>
              <p className="text-xs text-muted-foreground">影響を受ける従業員数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">全従業員数</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 変更内容 */}
      {changes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{SALARY_TABLE_UI_TEXT.PREVIEW_TITLE}</CardTitle>
            <CardDescription>
              {changes.length}件の変更があります
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{SALARY_TABLE_UI_TEXT.GRADE}</TableHead>
                    <TableHead>{SALARY_TABLE_UI_TEXT.STEP_NUMBER}</TableHead>
                    <TableHead>{SALARY_TABLE_UI_TEXT.RANK}</TableHead>
                    <TableHead className="text-right">{SALARY_TABLE_UI_TEXT.CURRENT}</TableHead>
                    <TableHead className="text-center"></TableHead>
                    <TableHead className="text-right">{SALARY_TABLE_UI_TEXT.NEW}</TableHead>
                    <TableHead className="text-right">{SALARY_TABLE_UI_TEXT.CHANGE}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayChanges.map((change, index) => (
                    <TableRow key={`${change.gradeId}-${change.stepNumber}-${index}`}>
                      <TableCell className="font-medium">{change.gradeName}</TableCell>
                      <TableCell>{change.stepNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{change.rank}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {change.currentBaseSalary !== null
                          ? formatCurrency(change.currentBaseSalary)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(change.newBaseSalary)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDifference(change.difference)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {hasMoreChanges && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                他 {changes.length - maxDisplayChanges} 件の変更があります
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 従業員への影響 */}
      {employeeImpacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">従業員への影響</CardTitle>
            <CardDescription>
              テーブル位置が変わる可能性のある従業員
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{SALARY_TABLE_UI_TEXT.EMPLOYEE}</TableHead>
                    <TableHead>{SALARY_TABLE_UI_TEXT.GRADE}</TableHead>
                    <TableHead className="text-right">{SALARY_TABLE_UI_TEXT.CURRENT_SALARY}</TableHead>
                    <TableHead className="text-center">{SALARY_TABLE_UI_TEXT.RANK}</TableHead>
                    <TableHead className="text-center"></TableHead>
                    <TableHead className="text-center">{SALARY_TABLE_UI_TEXT.NEW}</TableHead>
                    <TableHead className="text-right">{SALARY_TABLE_UI_TEXT.DIFFERENCE}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeImpacts.slice(0, 20).map((impact) => (
                    <TableRow key={impact.employeeId}>
                      <TableCell className="font-medium">{impact.employeeName}</TableCell>
                      <TableCell>{impact.gradeName}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(impact.currentBaseSalary)}
                      </TableCell>
                      <TableCell className="text-center">
                        {impact.currentRank ? (
                          <Badge variant="outline">{impact.currentRank}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        {impact.newRank ? (
                          <Badge variant="outline">{impact.newRank}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDifference(impact.difference)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {employeeImpacts.length > 20 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                他 {employeeImpacts.length - 20} 名の従業員に影響があります
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 変更なしの場合 */}
      {changes.length === 0 && employeeImpacts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            変更はありません
          </CardContent>
        </Card>
      )}
    </div>
  )
}
