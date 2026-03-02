"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { SALARY_TABLE_UI_TEXT } from "@/lib/salary-table"

interface MismatchAlertProps {
  gradeMismatchCount: number
  outOfRangeCount: number
}

export function MismatchAlert({ gradeMismatchCount, outOfRangeCount }: MismatchAlertProps) {
  const totalIssues = gradeMismatchCount + outOfRangeCount

  if (totalIssues === 0) {
    return null
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{SALARY_TABLE_UI_TEXT.MISMATCH_ALERT}</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc list-inside space-y-1">
          {gradeMismatchCount > 0 && (
            <li>
              <strong>{gradeMismatchCount}名</strong>の従業員の給与が、現在の等級の給与レンジと一致していません。
              等級の見直しが必要な可能性があります。
            </li>
          )}
          {outOfRangeCount > 0 && (
            <li>
              <strong>{outOfRangeCount}名</strong>の従業員の給与が、号俸テーブルの範囲外です。
              給与または号俸テーブルの設定を確認してください。
            </li>
          )}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
