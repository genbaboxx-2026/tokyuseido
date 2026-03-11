"use client";

import { useState, useCallback } from "react";
import { SalarySettingManager, type SalaryGanttData } from "./SalarySettingManager";
import { BonusSettingManager, type BonusGanttItem } from "./BonusSettingManager";
import { PeriodGanttChart, type GanttMonthDay, type GanttBonusData } from "./PeriodGanttChart";
import type { CompanySalarySettings, BonusSetting } from "@/types/company";

interface SalaryTabPanelProps {
  companyId: string;
  salarySettings: CompanySalarySettings;
  bonusSettings: BonusSetting[];
}

function extractMD(date: Date | string | null): GanttMonthDay | null {
  if (!date) return null;
  const d = new Date(date);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (isNaN(m) || isNaN(day)) return null;
  return { month: m, day };
}

function buildInitialSalary(s: CompanySalarySettings): {
  evalStart: GanttMonthDay | null;
  evalEnd: GanttMonthDay | null;
  salaryReflection: GanttMonthDay | null;
} {
  return {
    evalStart: extractMD(s.evaluationPeriodStart),
    evalEnd: extractMD(s.evaluationPeriodEnd),
    salaryReflection:
      s.salaryReflectionMonth && s.salaryReflectionDay
        ? { month: s.salaryReflectionMonth, day: s.salaryReflectionDay }
        : null,
  };
}

function buildInitialBonuses(bonuses: BonusSetting[]): GanttBonusData[] {
  return bonuses.map((bs) => ({
    name: bs.name,
    assessmentStart: extractMD(bs.assessmentStartDate),
    assessmentEnd: extractMD(bs.assessmentEndDate),
    paymentDate: extractMD(bs.paymentDate),
  }));
}

function toMD(month: number | null, day: number | null): GanttMonthDay | null {
  if (month == null || day == null || month < 1 || day < 1) return null;
  return { month, day };
}

export function SalaryTabPanel({ companyId, salarySettings, bonusSettings }: SalaryTabPanelProps) {
  const initial = buildInitialSalary(salarySettings);

  const [evalStart, setEvalStart] = useState<GanttMonthDay | null>(initial.evalStart);
  const [evalEnd, setEvalEnd] = useState<GanttMonthDay | null>(initial.evalEnd);
  const [salaryReflection, setSalaryReflection] = useState<GanttMonthDay | null>(initial.salaryReflection);
  const [ganttBonuses, setGanttBonuses] = useState<GanttBonusData[]>(buildInitialBonuses(bonusSettings));

  const handleSalaryChange = useCallback((data: SalaryGanttData) => {
    setEvalStart(toMD(data.evalStartMonth, data.evalStartDay));
    setEvalEnd(toMD(data.evalEndMonth, data.evalEndDay));
    setSalaryReflection(toMD(data.salaryReflectionMonth, data.salaryReflectionDay));
  }, []);

  const handleBonusChange = useCallback((bonuses: BonusGanttItem[]) => {
    setGanttBonuses(bonuses);
  }, []);

  return (
    <div className="space-y-6">
      <PeriodGanttChart
        evalPeriodStart={evalStart}
        evalPeriodEnd={evalEnd}
        salaryReflection={salaryReflection}
        bonuses={ganttBonuses}
      />
      <SalarySettingManager
        companyId={companyId}
        settings={salarySettings}
        onGanttChange={handleSalaryChange}
      />
      <BonusSettingManager
        companyId={companyId}
        bonusSettings={bonusSettings}
        onGanttChange={handleBonusChange}
      />
    </div>
  );
}
