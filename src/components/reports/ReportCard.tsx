/**
 * レポートカードコンポーネント
 * 各種レポートの表示用カード
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Table, FileSpreadsheet, BarChart3, Users, ClipboardCheck } from "lucide-react";

// UIテキスト定数
const UI_TEXT = {
  NO_DESCRIPTION: "説明なし",
};

// アイコンタイプからコンポーネントへのマッピング
const iconMap = {
  "file-text": FileText,
  "table": Table,
  "file-spreadsheet": FileSpreadsheet,
  "bar-chart": BarChart3,
  "users": Users,
  "clipboard-check": ClipboardCheck,
} as const;

export type IconType = keyof typeof iconMap;

interface ReportCardProps {
  title: string;
  description?: string;
  iconType: IconType;
  children: React.ReactNode;
}

export function ReportCard({ title, description, iconType, children }: ReportCardProps) {
  const Icon = iconMap[iconType] || FileText;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="text-sm">
              {description || UI_TEXT.NO_DESCRIPTION}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
