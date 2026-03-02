"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { CompanySalarySettings } from "@/types/company";

export interface SalaryGanttData {
  salaryReflectionMonth: number | null;
  salaryReflectionDay: number | null;
  evalStartMonth: number | null;
  evalStartDay: number | null;
  evalEndMonth: number | null;
  evalEndDay: number | null;
}

interface SalarySettingManagerProps {
  companyId: string;
  settings: CompanySalarySettings;
  onGanttChange?: (data: SalaryGanttData) => void;
}

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}日`,
}));

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}月`,
}));

const extractMonth = (date: Date | string | null): string => {
  if (!date) return "none";
  const d = new Date(date);
  return String(d.getMonth() + 1);
};

const extractDay = (date: Date | string | null): string => {
  if (!date) return "none";
  const d = new Date(date);
  return String(d.getDate());
};

const buildDate = (month: string | null, day: string | null): string | null => {
  if (!month || month === "none" || !day || day === "none") return null;
  const m = parseInt(month, 10).toString().padStart(2, "0");
  const d = parseInt(day, 10).toString().padStart(2, "0");
  return `2000-${m}-${d}`;
};

interface EvalPeriodMD {
  startMonth: string;
  startDay: string;
  endMonth: string;
  endDay: string;
}

function toNum(s: string): number | null {
  if (s === "none") return null;
  return parseInt(s, 10);
}

export function SalarySettingManager({
  companyId,
  settings: initialSettings,
  onGanttChange,
}: SalarySettingManagerProps) {
  const [settings, setSettings] = useState({
    salaryReflectionMonth: initialSettings.salaryReflectionMonth,
    salaryReflectionDay: initialSettings.salaryReflectionDay,
  });

  const [evalPeriod, setEvalPeriod] = useState<EvalPeriodMD>({
    startMonth: extractMonth(initialSettings.evaluationPeriodStart),
    startDay: extractDay(initialSettings.evaluationPeriodStart),
    endMonth: extractMonth(initialSettings.evaluationPeriodEnd),
    endDay: extractDay(initialSettings.evaluationPeriodEnd),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        salaryReflectionMonth: settings.salaryReflectionMonth,
        salaryReflectionDay: settings.salaryReflectionDay,
        evaluationPeriodStart: buildDate(evalPeriod.startMonth, evalPeriod.startDay),
        evaluationPeriodEnd: buildDate(evalPeriod.endMonth, evalPeriod.endDay),
      };

      const response = await fetch(`/api/companies/${companyId}/salary-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "給与設定の更新に失敗しました");
      }

      setHasChanges(false);
      alert("給与設定を更新しました");
    } catch (error) {
      console.error("給与設定更新エラー:", error);
      alert(error instanceof Error ? error.message : "給与設定の更新に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const emitGantt = (
    s: typeof settings,
    ep: EvalPeriodMD,
  ) => {
    onGanttChange?.({
      salaryReflectionMonth: s.salaryReflectionMonth,
      salaryReflectionDay: s.salaryReflectionDay,
      evalStartMonth: toNum(ep.startMonth),
      evalStartDay: toNum(ep.startDay),
      evalEndMonth: toNum(ep.endMonth),
      evalEndDay: toNum(ep.endDay),
    });
  };

  const handleSelectChange = (field: "salaryReflectionMonth" | "salaryReflectionDay", value: string) => {
    const numValue = value === "none" ? null : parseInt(value, 10);
    const next = { ...settings, [field]: numValue };
    setSettings(next);
    setHasChanges(true);
    emitGantt(next, evalPeriod);
  };

  const handleEvalPeriodChange = (field: keyof EvalPeriodMD, value: string) => {
    const next = { ...evalPeriod, [field]: value };
    setEvalPeriod(next);
    setHasChanges(true);
    emitGantt(settings, next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>給与設定</CardTitle>
        <CardDescription>号俸反映日と査定対象期間を設定</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>号俸反映日</Label>
            <div className="flex items-center gap-2">
              <Select
                value={settings.salaryReflectionMonth?.toString() || "none"}
                onValueChange={(value) => handleSelectChange("salaryReflectionMonth", value)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="月" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未設定</SelectItem>
                  {MONTH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={settings.salaryReflectionDay?.toString() || "none"}
                onValueChange={(value) => handleSelectChange("salaryReflectionDay", value)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="日" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未設定</SelectItem>
                  {DAY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              号俸が給与に反映される月日（例：4月1日）
            </p>
          </div>

          <div className="space-y-2">
            <Label>査定対象期間</Label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Select value={evalPeriod.startMonth} onValueChange={(v) => handleEvalPeriodChange("startMonth", v)}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="月" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未設定</SelectItem>
                    {MONTH_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={evalPeriod.startDay} onValueChange={(v) => handleEvalPeriodChange("startDay", v)}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="日" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未設定</SelectItem>
                    {DAY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground">〜</span>
              <div className="flex items-center gap-1">
                <Select value={evalPeriod.endMonth} onValueChange={(v) => handleEvalPeriodChange("endMonth", v)}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="月" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未設定</SelectItem>
                    {MONTH_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={evalPeriod.endDay} onValueChange={(v) => handleEvalPeriodChange("endDay", v)}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="日" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未設定</SelectItem>
                    {DAY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              評価対象となる期間（例：5月1日 〜 4月30日）
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
