'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { COMPANY_LABELS } from '@/lib/company/constants';
import { CompanyBasicInfoForm } from './CompanyBasicInfoForm';
import { PositionManagerEditable } from './PositionManagerEditable';
import { JobTypeManagerEditable } from './JobTypeManagerEditable';
import { SalarySettingsForm, type SalaryGanttData } from './SalarySettingsForm';
import { BonusSettingsForm, type BonusGanttItem } from './BonusSettingsForm';
import { PeriodGanttChart, type GanttMonthDay, type GanttBonusData } from './PeriodGanttChart';
import type { BonusSetting, CompanySalarySettings } from '@/types/company';
import type {
  PendingChanges,
  BasicInfoChanges,
  PositionChanges,
  JobCategoryChanges,
  SalarySettingsChanges,
  BonusSettingsChanges,
} from '@/types/company-settings';
import { Save, Loader2 } from 'lucide-react';

interface Position {
  id: string;
  name: string;
  level: number;
}

interface JobType {
  id: string;
  name: string;
  jobCategoryId: string;
}

interface JobCategory {
  id: string;
  name: string;
  jobTypes: JobType[];
}

interface Company {
  id: string;
  name: string;
  address: string | null;
  representative: string | null;
  establishedDate: Date | string | null;
  businessDescription: string | null;
  salaryReflectionMonth: number | null;
  salaryReflectionDay: number | null;
  evaluationPeriodStart: Date | string | null;
  evaluationPeriodEnd: Date | string | null;
  positions: Position[];
  jobCategories: JobCategory[];
}

interface CompanySettingsClientProps {
  company: Company;
  bonusSettings: BonusSetting[];
}

function toMD(month: number | null, day: number | null): GanttMonthDay | null {
  if (month == null || day == null || month < 1 || day < 1) return null;
  return { month, day };
}

function extractMD(date: Date | string | null): GanttMonthDay | null {
  if (!date) return null;
  const d = new Date(date);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (isNaN(m) || isNaN(day)) return null;
  return { month: m, day };
}

/**
 * 会社設定クライアントコンポーネント
 * 全タブの変更を一括保存する
 */
export function CompanySettingsClient({
  company,
  bonusSettings,
}: CompanySettingsClientProps) {
  // ペンディング変更の状態管理
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    basicInfo: null,
    positions: null,
    jobCategories: null,
    salarySettings: null,
    bonusSettings: null,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const router = useRouter();

  // hasChangesをrefでも保持（beforeunloadイベントで使用）
  const hasChangesRef = useRef(false);

  // Ganttチャート用の状態
  const [evalStart, setEvalStart] = useState<GanttMonthDay | null>(
    extractMD(company.evaluationPeriodStart)
  );
  const [evalEnd, setEvalEnd] = useState<GanttMonthDay | null>(
    extractMD(company.evaluationPeriodEnd)
  );
  const [salaryReflection, setSalaryReflection] = useState<GanttMonthDay | null>(
    company.salaryReflectionMonth && company.salaryReflectionDay
      ? { month: company.salaryReflectionMonth, day: company.salaryReflectionDay }
      : null
  );
  const [ganttBonuses, setGanttBonuses] = useState<GanttBonusData[]>(
    bonusSettings.map((bs) => ({
      name: bs.name,
      assessmentStart: extractMD(bs.assessmentStartDate),
      assessmentEnd: extractMD(bs.assessmentEndDate),
      paymentDate: extractMD(bs.paymentDate),
    }))
  );

  // 変更があるかどうか
  const hasChanges = useMemo(() => {
    return Object.values(pendingChanges).some((v) => v !== null);
  }, [pendingChanges]);

  // hasChangesをrefに同期
  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  // ブラウザの戻る/進む/リロード/タブ閉じる時の警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Next.jsのルーティング（リンククリック等）時の警告
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor && hasChangesRef.current) {
        const href = anchor.getAttribute('href');
        // 内部リンクかつ現在のページと異なる場合
        if (href && href.startsWith('/') && !href.startsWith(window.location.pathname)) {
          e.preventDefault();
          setPendingNavigation(href);
          setShowLeaveDialog(true);
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  // 離脱確認後の処理
  const handleLeaveWithoutSaving = () => {
    setShowLeaveDialog(false);
    if (pendingNavigation) {
      router.push(pendingNavigation);
    }
  };

  const handleSaveAndLeave = async () => {
    setShowLeaveDialog(false);
    await handleSave();
    // handleSaveでリロードされるので、ナビゲーションは不要
  };

  const handleCancelLeave = () => {
    setShowLeaveDialog(false);
    setPendingNavigation(null);
  };

  // 給与設定（初期値）
  const salarySettings: CompanySalarySettings = {
    salaryReflectionMonth: company.salaryReflectionMonth,
    salaryReflectionDay: company.salaryReflectionDay,
    evaluationPeriodStart: company.evaluationPeriodStart,
    evaluationPeriodEnd: company.evaluationPeriodEnd,
  };

  // 各セクションのonChangeハンドラ
  const handleBasicInfoChange = useCallback((data: BasicInfoChanges | null) => {
    setPendingChanges((prev) => ({ ...prev, basicInfo: data }));
  }, []);

  const handlePositionsChange = useCallback((data: PositionChanges | null) => {
    setPendingChanges((prev) => ({ ...prev, positions: data }));
  }, []);

  const handleJobCategoriesChange = useCallback((data: JobCategoryChanges | null) => {
    setPendingChanges((prev) => ({ ...prev, jobCategories: data }));
  }, []);

  const handleSalarySettingsChange = useCallback((data: SalarySettingsChanges | null) => {
    setPendingChanges((prev) => ({ ...prev, salarySettings: data }));
  }, []);

  const handleBonusSettingsChange = useCallback((data: BonusSettingsChanges | null) => {
    setPendingChanges((prev) => ({ ...prev, bonusSettings: data }));
  }, []);

  // Ganttチャート用のコールバック
  const handleSalaryGanttChange = useCallback((data: SalaryGanttData) => {
    setEvalStart(toMD(data.evalStartMonth, data.evalStartDay));
    setEvalEnd(toMD(data.evalEndMonth, data.evalEndDay));
    setSalaryReflection(toMD(data.salaryReflectionMonth, data.salaryReflectionDay));
  }, []);

  const handleBonusGanttChange = useCallback((bonuses: BonusGanttItem[]) => {
    setGanttBonuses(bonuses);
  }, []);

  // 保存処理
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/companies/${company.id}/settings-bulk`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingChanges),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '設定の保存に失敗しました');
      }

      // 成功時はリロードして最新データを取得
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{COMPANY_LABELS.COMPANY_SETTINGS}</h1>
          <p className="text-muted-foreground">{company.name}の設定を管理します</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="min-w-[100px]"
        >
          {isSaving ? (
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

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="basic">{COMPANY_LABELS.BASIC_INFO}</TabsTrigger>
          <TabsTrigger value="organization">組織管理</TabsTrigger>
          <TabsTrigger value="salary">給与設定</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <CompanyBasicInfoForm
            company={{
              name: company.name,
              address: company.address,
              representative: company.representative,
              establishedDate: company.establishedDate,
              businessDescription: company.businessDescription,
            }}
            onChange={handleBasicInfoChange}
          />
        </TabsContent>

        <TabsContent value="organization">
          <div className="space-y-6">
            <PositionManagerEditable
              companyId={company.id}
              initialPositions={company.positions}
              onChange={handlePositionsChange}
            />
            <JobTypeManagerEditable
              companyId={company.id}
              initialJobCategories={company.jobCategories}
              onChange={handleJobCategoriesChange}
            />
          </div>
        </TabsContent>

        <TabsContent value="salary">
          <div className="space-y-6">
            <PeriodGanttChart
              evalPeriodStart={evalStart}
              evalPeriodEnd={evalEnd}
              salaryReflection={salaryReflection}
              bonuses={ganttBonuses}
            />
            <SalarySettingsForm
              companyId={company.id}
              initialSettings={salarySettings}
              onChange={handleSalarySettingsChange}
              onGanttChange={handleSalaryGanttChange}
            />
            <BonusSettingsForm
              companyId={company.id}
              initialBonusSettings={bonusSettings}
              onChange={handleBonusSettingsChange}
              onGanttChange={handleBonusGanttChange}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* エラーダイアログ */}
      <AlertDialog open={!!error} onOpenChange={() => setError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>エラーが発生しました</AlertDialogTitle>
            <AlertDialogDescription>{error}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setError(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ページ離脱確認ダイアログ */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存されていない変更があります</AlertDialogTitle>
            <AlertDialogDescription>
              変更内容を保存せずにこのページを離れますか？保存していない変更は失われます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCancelLeave}>
              キャンセル
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleLeaveWithoutSaving}>
              保存せずに離れる
            </Button>
            <AlertDialogAction onClick={handleSaveAndLeave} disabled={isSaving}>
              {isSaving ? '保存中...' : '保存して離れる'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
