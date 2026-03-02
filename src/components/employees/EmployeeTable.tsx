"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmployeeWithRelations } from "@/types/employee";
import { EmploymentTypeLabels } from "@/types/employee";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface FilterOption {
  value: string;
  label: string;
}

interface EmployeeTableProps {
  employees: EmployeeWithRelations[];
  total: number;
  page: number;
  limit: number;
  companyId: string;
  basePath?: string;
  filters?: {
    departments: FilterOption[];
    grades: FilterOption[];
    jobTypes: FilterOption[];
    positions: FilterOption[];
  };
}

type SortField = "employeeCode" | "hireDate" | "baseSalary";
type SortOrder = "asc" | "desc";

const EMPLOYMENT_TYPE_OPTIONS: FilterOption[] = Object.entries(EmploymentTypeLabels).map(
  ([value, label]) => ({ value, label })
);

function SortableHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onSort,
  align = "left",
}: {
  label: string;
  field: SortField;
  currentSort: string | null;
  currentOrder: SortOrder;
  onSort: (field: SortField) => void;
  align?: "left" | "right";
}) {
  const isActive = currentSort === field;

  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 hover:text-foreground transition-colors w-full ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      <span>{label}</span>
      {isActive ? (
        currentOrder === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function FilterHeader({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [localValues, setLocalValues] = useState<string[]>(values);
  const pendingRef = useRef(values);
  const isActive = values.length > 0;
  const localActive = localValues.length > 0;

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setLocalValues(values);
      pendingRef.current = values;
    } else {
      const prev = values.slice().sort().join(",");
      const next = pendingRef.current.slice().sort().join(",");
      if (prev !== next) {
        onChange(pendingRef.current);
      }
    }
  };

  const handleToggle = (optionValue: string) => {
    setLocalValues((prev) => {
      const next = prev.includes(optionValue)
        ? prev.filter((v) => v !== optionValue)
        : [...prev, optionValue];
      pendingRef.current = next;
      return next;
    });
  };

  const handleClear = () => {
    setLocalValues([]);
    pendingRef.current = [];
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors w-full text-left">
          <span className={isActive ? "text-primary font-semibold" : ""}>{label}</span>
          {isActive ? (
            <Filter className="h-3 w-3 text-primary fill-primary" />
          ) : (
            <Filter className="h-3 w-3 opacity-40" />
          )}
          {isActive && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 leading-4">
              {values.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={localValues.includes(opt.value)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => handleToggle(opt.value)}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
        {localActive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={false}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={handleClear}
              className="text-muted-foreground"
            >
              クリア
            </DropdownMenuCheckboxItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EmployeeTable({
  employees,
  total,
  page,
  limit,
  companyId,
  basePath = "/employees",
  filters,
}: EmployeeTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / limit);

  // 評価設定の楽観的更新用state
  const [evaluationSettings, setEvaluationSettings] = useState<Record<string, { has360: boolean; hasIndividual: boolean }>>({});

  const currentSort = searchParams.get("sortBy") || "employeeCode";
  const currentOrder = (searchParams.get("sortOrder") || "asc") as SortOrder;

  const buildParams = useCallback(() => {
    return new URLSearchParams(searchParams.toString());
  }, [searchParams]);

  const navigate = useCallback(
    (params: URLSearchParams) => {
      router.push(`${basePath}?${params.toString()}`);
    },
    [router, basePath]
  );

  const handleSort = (field: SortField) => {
    const params = buildParams();
    if (currentSort === field) {
      params.set("sortOrder", currentOrder === "asc" ? "desc" : "asc");
    } else {
      params.set("sortBy", field);
      params.set("sortOrder", "asc");
    }
    params.set("page", "1");
    navigate(params);
  };

  const handleFilter = (key: string, values: string[]) => {
    const params = buildParams();
    if (values.length === 0) {
      params.delete(key);
    } else {
      params.set(key, values.join(","));
    }
    params.set("page", "1");
    navigate(params);
  };

  const getFilterValues = (key: string): string[] => {
    const param = searchParams.get(key);
    return param ? param.split(",") : [];
  };

  const handlePageChange = (newPage: number) => {
    const params = buildParams();
    params.set("page", newPage.toString());
    navigate(params);
  };

  const hasAnyFilter =
    searchParams.has("departmentId") ||
    searchParams.has("gradeId") ||
    searchParams.has("jobTypeId") ||
    searchParams.has("employmentType") ||
    searchParams.has("positionId");

  const clearAllFilters = () => {
    const params = new URLSearchParams();
    if (searchParams.has("sortBy")) params.set("sortBy", searchParams.get("sortBy")!);
    if (searchParams.has("sortOrder")) params.set("sortOrder", searchParams.get("sortOrder")!);
    params.set("page", "1");
    navigate(params);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatSalary = (salary: number | null) => {
    if (!salary) return "-";
    return `${salary.toLocaleString()}円`;
  };

  // 評価設定の更新
  const handleEvaluationChange = async (
    employeeId: string,
    type: "360" | "individual",
    checked: boolean,
    currentHas360: boolean,
    currentHasIndividual: boolean
  ) => {
    // 楽観的更新
    setEvaluationSettings((prev) => ({
      ...prev,
      [employeeId]: {
        has360: type === "360" ? checked : (prev[employeeId]?.has360 ?? currentHas360),
        hasIndividual: type === "individual" ? checked : (prev[employeeId]?.hasIndividual ?? currentHasIndividual),
      },
    }));

    try {
      const response = await fetch(`/api/employees/${employeeId}/evaluation-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          has360Evaluation: type === "360" ? checked : currentHas360,
          hasIndividualEvaluation: type === "individual" ? checked : currentHasIndividual,
        }),
      });

      if (!response.ok) {
        throw new Error("更新に失敗しました");
      }
    } catch {
      // エラー時は元に戻す
      setEvaluationSettings((prev) => ({
        ...prev,
        [employeeId]: {
          has360: currentHas360,
          hasIndividual: currentHasIndividual,
        },
      }));
    }
  };

  // 評価設定の現在値を取得
  const getEvaluationValue = (employeeId: string, type: "360" | "individual", defaultValue: boolean) => {
    const settings = evaluationSettings[employeeId];
    if (settings) {
      return type === "360" ? settings.has360 : settings.hasIndividual;
    }
    return defaultValue;
  };

  return (
    <div className="space-y-3">
      {/* ヘッダー行 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          全 <span className="text-foreground text-base">{total}</span> 件
        </h2>
        <div className="flex items-center gap-2">
          {hasAnyFilter && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" />
              フィルター解除
            </Button>
          )}
          {totalPages > 1 && (
            <p className="text-xs text-muted-foreground">
              {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 件を表示
            </p>
          )}
        </div>
      </div>

      {/* テーブル */}
      <div className="rounded-lg border overflow-hidden">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[90px]">
                <SortableHeader
                  label="社員番号"
                  field="employeeCode"
                  currentSort={currentSort}
                  currentOrder={currentOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="text-xs font-semibold w-[100px]">氏名</TableHead>
              <TableHead className="w-[90px]">
                <SortableHeader
                  label="入社日"
                  field="hireDate"
                  currentSort={currentSort}
                  currentOrder={currentOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="w-[90px]">
                {filters ? (
                  <FilterHeader
                    label="部署"
                    options={filters.departments}
                    values={getFilterValues("departmentId")}
                    onChange={(v) => handleFilter("departmentId", v)}
                  />
                ) : (
                  <span className="text-xs font-semibold">部署</span>
                )}
              </TableHead>
              <TableHead className="w-[80px]">
                {filters ? (
                  <FilterHeader
                    label="雇用形態"
                    options={EMPLOYMENT_TYPE_OPTIONS}
                    values={getFilterValues("employmentType")}
                    onChange={(v) => handleFilter("employmentType", v)}
                  />
                ) : (
                  <span className="text-xs font-semibold">雇用形態</span>
                )}
              </TableHead>
              <TableHead className="w-[100px]">
                {filters ? (
                  <FilterHeader
                    label="職種"
                    options={filters.jobTypes}
                    values={getFilterValues("jobTypeId")}
                    onChange={(v) => handleFilter("jobTypeId", v)}
                  />
                ) : (
                  <span className="text-xs font-semibold">職種</span>
                )}
              </TableHead>
              <TableHead className="w-[60px]">
                {filters ? (
                  <FilterHeader
                    label="等級"
                    options={filters.grades}
                    values={getFilterValues("gradeId")}
                    onChange={(v) => handleFilter("gradeId", v)}
                  />
                ) : (
                  <span className="text-xs font-semibold">等級</span>
                )}
              </TableHead>
              <TableHead className="w-[60px]">
                {filters ? (
                  <FilterHeader
                    label="役職"
                    options={filters.positions}
                    values={getFilterValues("positionId")}
                    onChange={(v) => handleFilter("positionId", v)}
                  />
                ) : (
                  <span className="text-xs font-semibold">役職</span>
                )}
              </TableHead>
              <TableHead className="text-right w-[120px]">
                <SortableHeader
                  label="基本給"
                  field="baseSalary"
                  currentSort={currentSort}
                  currentOrder={currentOrder}
                  onSort={handleSort}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-center w-[60px]">
                <span className="text-xs font-semibold">360</span>
              </TableHead>
              <TableHead className="text-center w-[60px]">
                <span className="text-xs font-semibold">個別</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">従業員が見つかりません</p>
                  <p className="text-xs mt-1">条件を変更して再検索してください</p>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow key={employee.id} className="group">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {employee.employeeCode}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`${basePath}/${employee.id}`}
                      className="text-sm font-medium hover:text-primary transition-colors"
                    >
                      {employee.lastName} {employee.firstName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{formatDate(employee.hireDate)}</TableCell>
                  <TableCell className="text-sm">{employee.department?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {EmploymentTypeLabels[employee.employmentType]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{employee.jobType?.name || "-"}</TableCell>
                  <TableCell>
                    {employee.grade ? (
                      <Badge variant={employee.grade.isManagement ? "default" : "secondary"} className="text-xs">
                        {employee.grade.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{employee.position?.name || "-"}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {formatSalary(employee.baseSalary)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getEvaluationValue(employee.id, "360", employee.has360Evaluation ?? false)}
                      onCheckedChange={(checked) =>
                        handleEvaluationChange(
                          employee.id,
                          "360",
                          !!checked,
                          employee.has360Evaluation ?? false,
                          employee.hasIndividualEvaluation ?? false
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getEvaluationValue(employee.id, "individual", employee.hasIndividualEvaluation ?? false)}
                      onCheckedChange={(checked) =>
                        handleEvaluationChange(
                          employee.id,
                          "individual",
                          !!checked,
                          employee.has360Evaluation ?? false,
                          employee.hasIndividualEvaluation ?? false
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="h-8"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            前へ
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            <span className="font-medium text-foreground">{page}</span> / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="h-8"
          >
            次へ
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
