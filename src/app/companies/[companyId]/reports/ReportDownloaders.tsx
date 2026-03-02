/**
 * レポートダウンローダー（クライアントコンポーネント）
 */

"use client";

import { useState } from "react";
import { DownloadButton } from "@/components/reports";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// UIテキスト定数
const UI_TEXT = {
  EVALUATION_SHEET: {
    SELECT_PLACEHOLDER: "評価を選択してください",
  },
  SALARY_TABLE: {
    SELECT_PLACEHOLDER: "号俸テーブルを選択してください",
  },
  STATUS: {
    NOT_STARTED: "未開始",
    IN_PROGRESS: "評価中",
    COMPLETED: "集計完了",
    FEEDBACK_DONE: "FB完了",
    ACTIVE: "有効",
    INACTIVE: "無効",
  },
};

// ステータスラベル変換
const statusLabels: Record<string, string> = {
  NOT_STARTED: UI_TEXT.STATUS.NOT_STARTED,
  IN_PROGRESS: UI_TEXT.STATUS.IN_PROGRESS,
  COMPLETED: UI_TEXT.STATUS.COMPLETED,
  FEEDBACK_DONE: UI_TEXT.STATUS.FEEDBACK_DONE,
};

// 評価シートダウンローダー
interface EvaluationData {
  id: string;
  status: string;
  periodName: string;
  employeeFullName: string;
  employeeCode: string;
  evaluatorName: string;
}

interface EvaluationSheetDownloaderProps {
  evaluations: EvaluationData[];
}

export function EvaluationSheetDownloader({ evaluations }: EvaluationSheetDownloaderProps) {
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string>("");

  return (
    <div className="space-y-4">
      <Select value={selectedEvaluationId} onValueChange={setSelectedEvaluationId}>
        <SelectTrigger>
          <SelectValue placeholder={UI_TEXT.EVALUATION_SHEET.SELECT_PLACEHOLDER} />
        </SelectTrigger>
        <SelectContent>
          {evaluations.map((evaluation) => (
            <SelectItem key={evaluation.id} value={evaluation.id}>
              <div className="flex items-center gap-2">
                <span>
                  {evaluation.periodName} - {evaluation.employeeFullName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {statusLabels[evaluation.status] || evaluation.status}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DownloadButton
        url={`/api/pdf/evaluation-sheet/${selectedEvaluationId}`}
        filename={`evaluation-sheet-${selectedEvaluationId}.pdf`}
        disabled={!selectedEvaluationId}
      />
    </div>
  );
}

// 号俸テーブルダウンローダー
interface SalaryTableData {
  id: string;
  name: string;
  isActive: boolean;
}

interface SalaryTableDownloaderProps {
  salaryTables: SalaryTableData[];
}

export function SalaryTableDownloader({ salaryTables }: SalaryTableDownloaderProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>("");

  return (
    <div className="space-y-4">
      <Select value={selectedTableId} onValueChange={setSelectedTableId}>
        <SelectTrigger>
          <SelectValue placeholder={UI_TEXT.SALARY_TABLE.SELECT_PLACEHOLDER} />
        </SelectTrigger>
        <SelectContent>
          {salaryTables.map((table) => (
            <SelectItem key={table.id} value={table.id}>
              <div className="flex items-center gap-2">
                <span>{table.name}</span>
                <Badge variant={table.isActive ? "default" : "secondary"} className="text-xs">
                  {table.isActive ? UI_TEXT.STATUS.ACTIVE : UI_TEXT.STATUS.INACTIVE}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DownloadButton
        url={`/api/pdf/salary-table/${selectedTableId}`}
        filename={`salary-table-${selectedTableId}.pdf`}
        disabled={!selectedTableId}
      />
    </div>
  );
}
