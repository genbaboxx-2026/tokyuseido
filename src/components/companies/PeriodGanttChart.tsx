"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const TOTAL_DAYS = 365;

const MONTH_START_DAY: number[] = [];
let acc = 0;
for (let i = 0; i < 12; i++) {
  MONTH_START_DAY.push(acc);
  acc += DAYS_IN_MONTH[i];
}

const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

export interface GanttMonthDay {
  month: number; // 1-12
  day: number;   // 1-31
}

export interface GanttBonusData {
  name: string;
  assessmentStart: GanttMonthDay | null;
  assessmentEnd: GanttMonthDay | null;
  evaluationStart: GanttMonthDay | null;
  evaluationEnd: GanttMonthDay | null;
  paymentDate: GanttMonthDay | null;
}

export interface PeriodGanttChartProps {
  evalPeriodStart: GanttMonthDay | null;
  evalPeriodEnd: GanttMonthDay | null;
  salaryReflection: GanttMonthDay | null;
  bonuses: GanttBonusData[];
}

function toDayOfYear(md: GanttMonthDay): number {
  return MONTH_START_DAY[md.month - 1] + Math.min(md.day, DAYS_IN_MONTH[md.month - 1]) - 1;
}

function pct(dayOfYear: number): number {
  return (dayOfYear / TOTAL_DAYS) * 100;
}

function monthStartPct(month: number): number {
  return pct(MONTH_START_DAY[month - 1]);
}

function monthWidthPct(month: number): number {
  return (DAYS_IN_MONTH[month - 1] / TOTAL_DAYS) * 100;
}

function isValidMD(md: GanttMonthDay | null): md is GanttMonthDay {
  return md !== null && md.month >= 1 && md.month <= 12 && md.day >= 1 && md.day <= 31;
}

function GanttBar({ start, end, colorClass }: { start: GanttMonthDay; end: GanttMonthDay; colorClass: string }) {
  const startDay = toDayOfYear(start);
  const endDay = toDayOfYear(end);

  if (startDay <= endDay) {
    return (
      <div
        className={`absolute top-0.5 h-5 rounded-sm ${colorClass}`}
        style={{ left: `${pct(startDay)}%`, width: `${pct(endDay - startDay + 1)}%` }}
      />
    );
  }
  return (
    <>
      <div
        className={`absolute top-0.5 h-5 rounded-sm rounded-r-none ${colorClass}`}
        style={{ left: `${pct(startDay)}%`, width: `${pct(TOTAL_DAYS - startDay)}%` }}
      />
      <div
        className={`absolute top-0.5 h-5 rounded-sm rounded-l-none ${colorClass}`}
        style={{ left: "0%", width: `${pct(endDay + 1)}%` }}
      />
    </>
  );
}

function GanttMarker({ point, colorClass }: { point: GanttMonthDay; colorClass: string }) {
  return (
    <div
      className="absolute top-0 flex items-center justify-center h-6"
      style={{ left: `${pct(toDayOfYear(point))}%`, transform: "translateX(-50%)" }}
    >
      <div className={`h-4 w-4 rounded-full ${colorClass} ring-2 ring-white shadow-sm`} />
    </div>
  );
}

function GridLines() {
  return (
    <>
      {Array.from({ length: 11 }, (_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 border-l border-dashed border-gray-200 dark:border-gray-700"
          style={{ left: `${monthStartPct(i + 2)}%` }}
        />
      ))}
    </>
  );
}

function ChartRow({ label, children, indent = false }: { label: string; children: React.ReactNode; indent?: boolean }) {
  return (
    <div className="flex items-center h-7">
      <div className={`w-28 shrink-0 text-xs truncate ${indent ? "pl-3 text-muted-foreground" : "font-medium"}`}>
        {label}
      </div>
      <div className="flex-1 relative h-6">
        <GridLines />
        {children}
      </div>
    </div>
  );
}

export function PeriodGanttChart({ evalPeriodStart, evalPeriodEnd, salaryReflection, bonuses }: PeriodGanttChartProps) {
  const hasEval = isValidMD(evalPeriodStart) && isValidMD(evalPeriodEnd);
  const hasSalary = isValidMD(salaryReflection);
  const hasBonus = bonuses.length > 0;

  if (!hasEval && !hasSalary && !hasBonus) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>年間スケジュール</CardTitle>
        <CardDescription>評価・賞与の年間スケジュール</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          <div className="flex items-center mb-1">
            <div className="w-28 shrink-0" />
            <div className="flex-1 relative h-4">
              {MONTH_LABELS.map((m, i) => (
                <div
                  key={m}
                  className="absolute text-[10px] text-muted-foreground text-center"
                  style={{ left: `${monthStartPct(i + 1)}%`, width: `${monthWidthPct(i + 1)}%` }}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>

          {hasEval && (
            <ChartRow label="評価期間">
              <GanttBar start={evalPeriodStart!} end={evalPeriodEnd!} colorClass="bg-blue-500/80" />
            </ChartRow>
          )}

          {hasSalary && (
            <ChartRow label="号俸反映">
              <GanttMarker point={salaryReflection!} colorClass="bg-blue-600" />
            </ChartRow>
          )}

          {bonuses.map((bonus, i) => {
            const a = isValidMD(bonus.assessmentStart) && isValidMD(bonus.assessmentEnd);
            const e = isValidMD(bonus.evaluationStart) && isValidMD(bonus.evaluationEnd);
            const p = isValidMD(bonus.paymentDate);
            if (!a && !e && !p) return null;

            return (
              <div key={bonus.name || i}>
                <div className="flex items-center h-5">
                  <div className="w-28 shrink-0 text-xs font-medium pt-1">{bonus.name || `賞与${i + 1}`}</div>
                  <div className="flex-1 border-t border-gray-100 dark:border-gray-800 mt-1" />
                </div>
                {a && (
                  <ChartRow label="査定期間" indent>
                    <GanttBar start={bonus.assessmentStart!} end={bonus.assessmentEnd!} colorClass="bg-emerald-500/80" />
                  </ChartRow>
                )}
                {e && (
                  <ChartRow label="評価期間" indent>
                    <GanttBar start={bonus.evaluationStart!} end={bonus.evaluationEnd!} colorClass="bg-amber-500/80" />
                  </ChartRow>
                )}
                {p && (
                  <ChartRow label="支給日" indent>
                    <GanttMarker point={bonus.paymentDate!} colorClass="bg-red-500" />
                  </ChartRow>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><div className="h-3 w-6 rounded-sm bg-blue-500/80" /><span>評価期間</span></div>
          <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-blue-600" /><span>号俸反映</span></div>
          <div className="flex items-center gap-1.5"><div className="h-3 w-6 rounded-sm bg-emerald-500/80" /><span>査定期間</span></div>
          <div className="flex items-center gap-1.5"><div className="h-3 w-6 rounded-sm bg-amber-500/80" /><span>賞与評価</span></div>
          <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-red-500" /><span>支給日</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
