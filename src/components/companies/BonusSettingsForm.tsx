'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BonusSetting } from '@/types/company';
import type { BonusSettingsChanges } from '@/types/company-settings';
import { generateTempId } from '@/types/company-settings';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BonusGanttItem {
  name: string;
  assessmentStart: { month: number; day: number } | null;
  assessmentEnd: { month: number; day: number } | null;
  evaluationStart: { month: number; day: number } | null;
  evaluationEnd: { month: number; day: number } | null;
  paymentDate: { month: number; day: number } | null;
}

interface BonusSettingsFormProps {
  companyId: string;
  initialBonusSettings: BonusSetting[];
  onChange: (data: BonusSettingsChanges | null) => void;
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
  id: string; // 既存のIDまたはtempId
  name: string;
  assessmentStart: MonthDay;
  assessmentEnd: MonthDay;
  evaluationStart: MonthDay;
  evaluationEnd: MonthDay;
  paymentDate: MonthDay;
  isNew: boolean;
  isUpdated: boolean;
  isDeleted: boolean;
}

const extractMD = (date: Date | string): MonthDay => {
  const d = new Date(date);
  return {
    month: String(d.getMonth() + 1),
    day: String(d.getDate()),
  };
};

const emptyMD = (): MonthDay => ({ month: 'none', day: 'none' });

const buildDateStr = (md: MonthDay): string => {
  if (md.month === 'none' || md.day === 'none') return '';
  const m = parseInt(md.month, 10).toString().padStart(2, '0');
  const d = parseInt(md.day, 10).toString().padStart(2, '0');
  return `2000-${m}-${d}`;
};

const convertToFormData = (bs: BonusSetting): BonusFormData => ({
  id: bs.id,
  name: bs.name,
  assessmentStart: extractMD(bs.assessmentStartDate),
  assessmentEnd: extractMD(bs.assessmentEndDate),
  evaluationStart: extractMD(bs.evaluationStartDate),
  evaluationEnd: extractMD(bs.evaluationEndDate),
  paymentDate: extractMD(bs.paymentDate),
  isNew: false,
  isUpdated: false,
  isDeleted: false,
});

const createEmptyFormData = (): BonusFormData => ({
  id: generateTempId(),
  name: '',
  assessmentStart: emptyMD(),
  assessmentEnd: emptyMD(),
  evaluationStart: emptyMD(),
  evaluationEnd: emptyMD(),
  paymentDate: emptyMD(),
  isNew: true,
  isUpdated: false,
  isDeleted: false,
});

function MonthDaySelector({
  value,
  onChange,
  label,
  disabled,
}: {
  value: MonthDay;
  onChange: (md: MonthDay) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      {label && (
        <Label className="text-xs text-muted-foreground">{label}</Label>
      )}
      <div className="flex items-center gap-1">
        <Select
          value={value.month}
          onValueChange={(v) => onChange({ ...value, month: v })}
          disabled={disabled}
        >
          <SelectTrigger className="w-24">
            <SelectValue placeholder="月" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">--</SelectItem>
            {MONTH_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={value.day}
          onValueChange={(v) => onChange({ ...value, day: v })}
          disabled={disabled}
        >
          <SelectTrigger className="w-24">
            <SelectValue placeholder="日" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">--</SelectItem>
            {DAY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function mdToGantt(md: MonthDay): { month: number; day: number } | null {
  const m = parseInt(md.month, 10);
  if (isNaN(m) || md.month === 'none') return null;
  const d = parseInt(md.day, 10);
  return { month: m, day: isNaN(d) || md.day === 'none' ? 1 : d };
}

function formsToGantt(forms: BonusFormData[]): BonusGanttItem[] {
  return forms
    .filter((f) => !f.isDeleted)
    .map((f) => ({
      name: f.name,
      assessmentStart: mdToGantt(f.assessmentStart),
      assessmentEnd: mdToGantt(f.assessmentEnd),
      evaluationStart: mdToGantt(f.evaluationStart),
      evaluationEnd: mdToGantt(f.evaluationEnd),
      paymentDate: mdToGantt(f.paymentDate),
    }));
}

/**
 * 賞与設定フォーム（ペンディング状態管理、onChangeで変更を通知）
 */
export function BonusSettingsForm({
  initialBonusSettings,
  onChange,
  onGanttChange,
}: BonusSettingsFormProps) {
  // 初期データを保存
  const initialFormsRef = useRef<BonusFormData[]>(
    initialBonusSettings.length > 0
      ? initialBonusSettings.map(convertToFormData)
      : []
  );

  const [bonusForms, setBonusForms] = useState<BonusFormData[]>(
    initialBonusSettings.length > 0
      ? initialBonusSettings.map(convertToFormData)
      : []
  );

  // 変更を検出して親に通知
  const notifyChanges = useCallback(
    (forms: BonusFormData[]) => {
      const added = forms
        .filter((f) => f.isNew && !f.isDeleted)
        .map((f) => ({
          tempId: f.id,
          name: f.name,
          paymentDate: buildDateStr(f.paymentDate),
          assessmentStartDate: buildDateStr(f.assessmentStart),
          assessmentEndDate: buildDateStr(f.assessmentEnd),
          evaluationStartDate: buildDateStr(f.evaluationStart),
          evaluationEndDate: buildDateStr(f.evaluationEnd),
        }));

      const updated = forms
        .filter((f) => !f.isNew && f.isUpdated && !f.isDeleted)
        .map((f) => ({
          id: f.id,
          name: f.name,
          paymentDate: buildDateStr(f.paymentDate),
          assessmentStartDate: buildDateStr(f.assessmentStart),
          assessmentEndDate: buildDateStr(f.assessmentEnd),
          evaluationStartDate: buildDateStr(f.evaluationStart),
          evaluationEndDate: buildDateStr(f.evaluationEnd),
        }));

      const deleted = forms
        .filter((f) => !f.isNew && f.isDeleted)
        .map((f) => f.id);

      const hasChanges =
        added.length > 0 || updated.length > 0 || deleted.length > 0;

      if (hasChanges) {
        onChange({ added, updated, deleted });
      } else {
        onChange(null);
      }

      // Ganttチャート用データも通知
      onGanttChange?.(formsToGantt(forms));
    },
    [onChange, onGanttChange]
  );

  // 初回マウント時にGanttデータを通知
  useEffect(() => {
    onGanttChange?.(formsToGantt(bonusForms));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddBonus = () => {
    const next = [...bonusForms, createEmptyFormData()];
    setBonusForms(next);
    notifyChanges(next);
  };

  const handleNameChange = (index: number, value: string) => {
    const newForms = [...bonusForms];
    const form = newForms[index];
    newForms[index] = {
      ...form,
      name: value,
      isUpdated: !form.isNew ? true : form.isUpdated,
    };
    setBonusForms(newForms);
    notifyChanges(newForms);
  };

  const handleMDChange = (
    index: number,
    field: keyof BonusFormData,
    md: MonthDay
  ) => {
    const newForms = [...bonusForms];
    const form = newForms[index];
    newForms[index] = {
      ...form,
      [field]: md,
      isUpdated: !form.isNew ? true : form.isUpdated,
    };
    setBonusForms(newForms);
    notifyChanges(newForms);
  };

  const handleDelete = (index: number) => {
    const form = bonusForms[index];

    if (form.isNew) {
      // 新規追加項目は配列から削除
      const next = bonusForms.filter((_, i) => i !== index);
      setBonusForms(next);
      notifyChanges(next);
    } else {
      // 既存項目は削除フラグを立てる
      const newForms = [...bonusForms];
      newForms[index] = { ...form, isDeleted: true };
      setBonusForms(newForms);
      notifyChanges(newForms);
    }
  };

  const handleUndoDelete = (index: number) => {
    const newForms = [...bonusForms];
    const form = newForms[index];
    // 元の状態に戻す
    const originalForm = initialFormsRef.current.find((f) => f.id === form.id);
    if (originalForm) {
      newForms[index] = { ...originalForm };
    } else {
      newForms[index] = { ...form, isDeleted: false };
    }
    setBonusForms(newForms);
    notifyChanges(newForms);
  };

  // 表示用にフィルタ（削除済みも含めて表示するが、スタイルを変える）
  const displayForms = bonusForms;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>賞与設定</CardTitle>
            <CardDescription>
              賞与の査定期間・評価期間・支給日を設定
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleAddBonus}>
            <Plus className="h-4 w-4 mr-1" />
            賞与を追加
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {displayForms.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            賞与設定がありません。「賞与を追加」ボタンで追加してください。
          </p>
        ) : (
          displayForms.map((form, index) => (
            <div
              key={form.id}
              className={cn(
                'border rounded-lg p-4 space-y-4 transition-colors',
                form.isNew && 'bg-green-50 dark:bg-green-950/20',
                form.isUpdated &&
                  !form.isNew &&
                  'bg-yellow-50 dark:bg-yellow-950/20',
                form.isDeleted && 'bg-red-50 dark:bg-red-950/20 opacity-60'
              )}
            >
              {/* 賞与名 + 操作ボタン */}
              <div className="flex items-end justify-between gap-4">
                <div className="flex-1">
                  <Label
                    htmlFor={`name-${index}`}
                    className={cn(form.isDeleted && 'line-through')}
                  >
                    賞与名 *
                  </Label>
                  <Input
                    id={`name-${index}`}
                    placeholder="例: 夏季賞与"
                    value={form.name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    className={cn('mt-1', form.isDeleted && 'line-through')}
                    disabled={form.isDeleted}
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  {form.isDeleted ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUndoDelete(index)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      取り消し
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(index)}
                    >
                      <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                      削除
                    </Button>
                  )}
                </div>
              </div>

              {/* 支給日 */}
              <div className="space-y-2">
                <Label className={cn(form.isDeleted && 'line-through')}>
                  支給日 *
                </Label>
                <MonthDaySelector
                  value={form.paymentDate}
                  onChange={(md) => handleMDChange(index, 'paymentDate', md)}
                  disabled={form.isDeleted}
                />
              </div>

              {/* 査定対象期間 */}
              <div className="space-y-2">
                <Label className={cn(form.isDeleted && 'line-through')}>
                  査定対象期間 *
                </Label>
                <div className="flex items-end gap-2">
                  <MonthDaySelector
                    value={form.assessmentStart}
                    onChange={(md) =>
                      handleMDChange(index, 'assessmentStart', md)
                    }
                    label="開始日"
                    disabled={form.isDeleted}
                  />
                  <span className="text-muted-foreground pb-2">〜</span>
                  <MonthDaySelector
                    value={form.assessmentEnd}
                    onChange={(md) =>
                      handleMDChange(index, 'assessmentEnd', md)
                    }
                    label="終了日"
                    disabled={form.isDeleted}
                  />
                </div>
              </div>

              {/* 評価実施期間 */}
              <div className="space-y-2">
                <Label className={cn(form.isDeleted && 'line-through')}>
                  評価実施期間 *
                </Label>
                <div className="flex items-end gap-2">
                  <MonthDaySelector
                    value={form.evaluationStart}
                    onChange={(md) =>
                      handleMDChange(index, 'evaluationStart', md)
                    }
                    label="開始日"
                    disabled={form.isDeleted}
                  />
                  <span className="text-muted-foreground pb-2">〜</span>
                  <MonthDaySelector
                    value={form.evaluationEnd}
                    onChange={(md) =>
                      handleMDChange(index, 'evaluationEnd', md)
                    }
                    label="終了日"
                    disabled={form.isDeleted}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
