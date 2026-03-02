"use client";

import type { SalaryHistoryItem } from "@/types/employee";

interface SalaryChartProps {
  history: SalaryHistoryItem[];
}

/**
 * 給与変遷グラフ（SVGで実装）
 * 外部ライブラリを使用せず、シンプルな折れ線グラフを描画
 */
export function SalaryChart({ history }: SalaryChartProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        給与履歴はまだありません
      </div>
    );
  }

  // グラフのサイズ設定
  const width = 600;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // データの最大値・最小値を取得
  const salaries = history.map((item) => item.baseSalary);
  const maxSalary = Math.max(...salaries);
  const minSalary = Math.min(...salaries);

  // Y軸の目盛りを計算（きりの良い数字に）
  const yAxisMin = Math.floor(minSalary / 10000) * 10000;
  const yAxisMax = Math.ceil(maxSalary / 10000) * 10000;
  const yAxisRange = yAxisMax - yAxisMin || 10000;
  const yAxisStep = Math.ceil(yAxisRange / 5 / 10000) * 10000;
  const yAxisTicks: number[] = [];
  for (let v = yAxisMin; v <= yAxisMax; v += yAxisStep) {
    yAxisTicks.push(v);
  }

  // X座標を計算
  const getX = (index: number) => {
    if (history.length === 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (history.length - 1)) * chartWidth;
  };

  // Y座標を計算
  const getY = (salary: number) => {
    const ratio = (salary - yAxisMin) / yAxisRange;
    return padding.top + chartHeight - ratio * chartHeight;
  };

  // 折れ線のパスを生成
  const linePath = history
    .map((item, index) => {
      const x = getX(index);
      const y = getY(item.baseSalary);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // グラデーションエリアのパスを生成
  const areaPath =
    linePath +
    ` L ${getX(history.length - 1)} ${padding.top + chartHeight}` +
    ` L ${getX(0)} ${padding.top + chartHeight}` +
    ` Z`;

  // 日付フォーマット
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return `${d.getFullYear()}/${d.getMonth() + 1}`;
  };

  // 金額フォーマット
  const formatSalary = (salary: number) => {
    return `${(salary / 10000).toFixed(0)}万`;
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[400px]"
        style={{ maxWidth: `${width}px` }}
      >
        {/* グラデーション定義 */}
        <defs>
          <linearGradient id="salaryGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Y軸のグリッドライン */}
        {yAxisTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={getY(tick)}
              x2={width - padding.right}
              y2={getY(tick)}
              stroke="hsl(var(--border))"
              strokeDasharray="4"
            />
            <text
              x={padding.left - 10}
              y={getY(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-xs fill-muted-foreground"
            >
              {formatSalary(tick)}
            </text>
          </g>
        ))}

        {/* Y軸ラベル */}
        <text
          x={15}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90, 15, ${height / 2})`}
          className="text-xs fill-muted-foreground"
        >
          基本給
        </text>

        {/* グラデーションエリア */}
        <path d={areaPath} fill="url(#salaryGradient)" />

        {/* 折れ線 */}
        <path
          d={linePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* データポイント */}
        {history.map((item, index) => (
          <g key={item.id}>
            <circle
              cx={getX(index)}
              cy={getY(item.baseSalary)}
              r="6"
              fill="hsl(var(--background))"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />
            {/* ツールチップ用の透明な大きい円 */}
            <circle
              cx={getX(index)}
              cy={getY(item.baseSalary)}
              r="15"
              fill="transparent"
              className="cursor-pointer"
            >
              <title>
                {`${formatDate(item.effectiveDate)}\n${item.baseSalary.toLocaleString()}円\n${item.gradeName} / ${item.rank}`}
              </title>
            </circle>
          </g>
        ))}

        {/* X軸の日付ラベル */}
        {history.map((item, index) => {
          // ラベルが重ならないように間引く
          const showLabel =
            history.length <= 6 ||
            index === 0 ||
            index === history.length - 1 ||
            index % Math.ceil(history.length / 5) === 0;

          if (!showLabel) return null;

          return (
            <text
              key={item.id}
              x={getX(index)}
              y={height - padding.bottom + 20}
              textAnchor="middle"
              className="text-xs fill-muted-foreground"
            >
              {formatDate(item.effectiveDate)}
            </text>
          );
        })}
      </svg>

      {/* 凡例 */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm">
        {history.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">最新:</span>
              <span className="font-medium">
                {history[history.length - 1].baseSalary.toLocaleString()}円
              </span>
              <span className="text-muted-foreground text-xs">
                ({history[history.length - 1].gradeName} / {history[history.length - 1].rank})
              </span>
            </div>
            {history.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">変動:</span>
                <span
                  className={`font-medium ${
                    history[history.length - 1].baseSalary - history[0].baseSalary >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {history[history.length - 1].baseSalary - history[0].baseSalary >= 0 ? "+" : ""}
                  {(history[history.length - 1].baseSalary - history[0].baseSalary).toLocaleString()}円
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
