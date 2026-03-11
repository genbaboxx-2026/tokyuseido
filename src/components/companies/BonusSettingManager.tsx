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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BonusSetting } from "@/types/company";
import { Plus, Trash2, Save } from "lucide-react";

export interface BonusGanttItem {
  name: string;
  assessmentStart: { month: number; day: number } | null;
  assessmentEnd: { month: number; day: number } | null;
  paymentDate: { month: number; day: number } | null;
}

interface BonusSettingManagerProps {
  companyId: string;
  bonusSettings: BonusSetting[];
  onGanttChange?: (bonuses: BonusGanttItem[]) => void;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}月`,
}));

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}日`,
}));

interface MonthDay {
  month: string;
  day: string;
}

interface BonusFormData {
  id?: string;
  name: string;
  assessmentStart: MonthDay;
  assessmentEnd: MonthDay;
  paymentDate: MonthDay;
  isNew?: boolean;
  hasChanges?: boolean;
}

const extractMD = (date: Date | string): MonthDay => {
  const d = new Date(date);
  return {
    month: String(d.getMonth() + 1),
    day: String(d.getDate()),
  };
};

const emptyMD = (): MonthDay => ({ month: "none", day: "none" });

const buildDateStr = (md: MonthDay): string => {
  if (md.month === "none" || md.day === "none") return "";
  const m = parseInt(md.month, 10).toString().padStart(2, "0");
  const d = parseInt(md.day, 10).toString().padStart(2, "0");
  return `2000-${m}-${d}`;
};

const convertToFormData = (bs: BonusSetting): BonusFormData => ({
  id: bs.id,
  name: bs.name,
  assessmentStart: extractMD(bs.assessmentStartDate),
  assessmentEnd: extractMD(bs.assessmentEndDate),
  paymentDate: extractMD(bs.paymentDate),
  isNew: false,
  hasChanges: false,
});

const createEmptyFormData = (): BonusFormData => ({
  name: "",
  assessmentStart: emptyMD(),
  assessmentEnd: emptyMD(),
  paymentDate: emptyMD(),
  isNew: true,
  hasChanges: true,
});

function MonthDaySelector({
  value,
  onChange,
  label,
}: {
  value: MonthDay;
  onChange: (md: MonthDay) => void;
  label?: string;
}) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-1">
        <Select value={value.month} onValueChange={(v) => onChange({ ...value, month: v })}>
          <SelectTrigger className="w-24">
            <SelectValue placeholder="月" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">--</SelectItem>
            {MONTH_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.day} onValueChange={(v) => onChange({ ...value, day: v })}>
          <SelectTrigger className="w-24">
            <SelectValue placeholder="日" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">--</SelectItem>
            {DAY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function mdToGantt(md: MonthDay): { month: number; day: number } | null {
  const m = parseInt(md.month, 10);
  if (isNaN(m) || md.month === "none") return null;
  const d = parseInt(md.day, 10);
  return { month: m, day: isNaN(d) || md.day === "none" ? 1 : d };
}

function formsToGantt(forms: BonusFormData[]): BonusGanttItem[] {
  return forms.map((f) => ({
    name: f.name,
    assessmentStart: mdToGantt(f.assessmentStart),
    assessmentEnd: mdToGantt(f.assessmentEnd),
    paymentDate: mdToGantt(f.paymentDate),
  }));
}

export function BonusSettingManager({
  companyId,
  bonusSettings: initialBonusSettings,
  onGanttChange,
}: BonusSettingManagerProps) {
  const [bonusForms, setBonusForms] = useState<BonusFormData[]>(
    initialBonusSettings.length > 0
      ? initialBonusSettings.map(convertToFormData)
      : [createEmptyFormData()]
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const emitGantt = (forms: BonusFormData[]) => {
    onGanttChange?.(formsToGantt(forms));
  };

  const handleAddBonus = () => {
    const next = [...bonusForms, createEmptyFormData()];
    setBonusForms(next);
    emitGantt(next);
  };

  const handleNameChange = (index: number, value: string) => {
    const newForms = [...bonusForms];
    newForms[index] = { ...newForms[index], name: value, hasChanges: true };
    setBonusForms(newForms);
    emitGantt(newForms);
  };

  const handleMDChange = (index: number, field: keyof BonusFormData, md: MonthDay) => {
    const newForms = [...bonusForms];
    newForms[index] = { ...newForms[index], [field]: md, hasChanges: true };
    setBonusForms(newForms);
    emitGantt(newForms);
  };

  const handleSave = async (index: number) => {
    const form = bonusForms[index];

    if (!form.name.trim()) {
      alert("賞与名は必須です");
      return;
    }

    const tempId = form.isNew ? `temp-${index}` : form.id;
    setSavingId(tempId || null);

    try {
      const url = form.isNew
        ? `/api/companies/${companyId}/bonus-settings`
        : `/api/companies/${companyId}/bonus-settings/${form.id}`;

      const method = form.isNew ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          assessmentStartDate: buildDateStr(form.assessmentStart),
          assessmentEndDate: buildDateStr(form.assessmentEnd),
          paymentDate: buildDateStr(form.paymentDate),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "賞与設定の保存に失敗しました");
      }

      const savedBonusSetting = await response.json();
      const newForms = [...bonusForms];
      newForms[index] = convertToFormData(savedBonusSetting);
      setBonusForms(newForms);
      emitGantt(newForms);
    } catch (error) {
      console.error("賞与設定保存エラー:", error);
      alert(error instanceof Error ? error.message : "賞与設定の保存に失敗しました");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (index: number) => {
    const form = bonusForms[index];

    if (form.isNew) {
      if (bonusForms.length > 1) {
        const next = bonusForms.filter((_, i) => i !== index);
        setBonusForms(next);
        emitGantt(next);
      }
      return;
    }

    if (!confirm("この賞与設定を削除しますか？")) return;

    try {
      const response = await fetch(
        `/api/companies/${companyId}/bonus-settings/${form.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "賞与設定の削除に失敗しました");
      }

      const remaining = bonusForms.filter((_, i) => i !== index);
      const next = remaining.length > 0 ? remaining : [createEmptyFormData()];
      setBonusForms(next);
      emitGantt(next);
    } catch (error) {
      console.error("賞与設定削除エラー:", error);
      alert(error instanceof Error ? error.message : "賞与設定の削除に失敗しました");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>賞与設定</CardTitle>
            <CardDescription>賞与の査定期間・評価期間・支給日を設定</CardDescription>
          </div>
          <Button size="sm" onClick={handleAddBonus}>
            <Plus className="h-4 w-4 mr-1" />
            賞与を追加
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {bonusForms.map((form, index) => {
          const isSaving = savingId === (form.isNew ? `temp-${index}` : form.id);
          return (
            <div
              key={form.id || `new-${index}`}
              className="border rounded-lg p-4 space-y-4"
            >
              {/* 賞与名 + 操作ボタン */}
              <div className="flex items-end justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor={`name-${index}`}>賞与名 *</Label>
                  <Input
                    id={`name-${index}`}
                    placeholder="例: 夏季賞与"
                    value={form.name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleSave(index)}
                    disabled={isSaving || !form.hasChanges}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {isSaving ? "保存中..." : "保存"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(index)}
                  >
                    <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                    削除
                  </Button>
                </div>
              </div>

              {/* 支給日 */}
              <div className="space-y-2">
                <Label>支給日 *</Label>
                <MonthDaySelector
                  value={form.paymentDate}
                  onChange={(md) => handleMDChange(index, "paymentDate", md)}
                />
              </div>

              {/* 査定対象期間 */}
              <div className="space-y-2">
                <Label>査定対象期間 *</Label>
                <div className="flex items-end gap-2">
                  <MonthDaySelector
                    value={form.assessmentStart}
                    onChange={(md) => handleMDChange(index, "assessmentStart", md)}
                    label="開始日"
                  />
                  <span className="text-muted-foreground pb-2">〜</span>
                  <MonthDaySelector
                    value={form.assessmentEnd}
                    onChange={(md) => handleMDChange(index, "assessmentEnd", md)}
                    label="終了日"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
