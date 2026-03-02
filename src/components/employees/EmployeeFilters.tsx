"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EmployeeStatusLabels } from "@/types/employee";
import { Search, SlidersHorizontal, X } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface EmployeeFiltersProps {
  departments: FilterOption[];
  grades: FilterOption[];
  jobTypes: FilterOption[];
  companyId: string;
  basePath?: string;
}

// ステータスオプション
const statusOptions = Object.entries(EmployeeStatusLabels).map(([value, label]) => ({
  value,
  label,
}));

export function EmployeeFilters({
  departments,
  grades,
  jobTypes,
  companyId,
  basePath = "/employees",
}: EmployeeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [departmentId, setDepartmentId] = useState(
    searchParams.get("departmentId") || "all"
  );
  const [gradeId, setGradeId] = useState(searchParams.get("gradeId") || "all");
  const [jobTypeId, setJobTypeId] = useState(
    searchParams.get("jobTypeId") || "all"
  );
  const [status, setStatus] = useState(
    searchParams.get("status") || "all"
  );

  const applyFilters = () => {
    const params = new URLSearchParams();
    params.set("companyId", companyId);
    if (search) params.set("search", search);
    if (departmentId && departmentId !== "all") params.set("departmentId", departmentId);
    if (gradeId && gradeId !== "all") params.set("gradeId", gradeId);
    if (jobTypeId && jobTypeId !== "all") params.set("jobTypeId", jobTypeId);
    if (status && status !== "all") params.set("status", status);
    params.set("page", "1");

    router.push(`${basePath}?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch("");
    setDepartmentId("all");
    setGradeId("all");
    setJobTypeId("all");
    setStatus("all");
    router.push(basePath);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      applyFilters();
    }
  };

  const hasActiveFilter =
    search !== "" ||
    departmentId !== "all" ||
    gradeId !== "all" ||
    jobTypeId !== "all" ||
    status !== "all";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <SlidersHorizontal className="h-4 w-4" />
        絞り込み検索
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        {/* 検索 */}
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground mb-1.5 block">キーワード</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="氏名・社員番号で検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 bg-background"
            />
          </div>
        </div>

        {/* セレクト群 */}
        <div className="grid grid-cols-2 gap-3 lg:flex lg:gap-3">
          <div className="w-full lg:w-36">
            <Label className="text-xs text-muted-foreground mb-1.5 block">部署</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.value} value={dept.value}>
                    {dept.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full lg:w-36">
            <Label className="text-xs text-muted-foreground mb-1.5 block">等級</Label>
            <Select value={gradeId} onValueChange={setGradeId}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade.value} value={grade.value}>
                    {grade.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full lg:w-36">
            <Label className="text-xs text-muted-foreground mb-1.5 block">職種</Label>
            <Select value={jobTypeId} onValueChange={setJobTypeId}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {jobTypes.map((jt) => (
                  <SelectItem key={jt.value} value={jt.value}>
                    {jt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full lg:w-36">
            <Label className="text-xs text-muted-foreground mb-1.5 block">ステータス</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ボタン */}
        <div className="flex gap-2 shrink-0">
          <Button onClick={applyFilters} size="sm">
            <Search className="h-3.5 w-3.5 mr-1.5" />
            検索
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className={hasActiveFilter ? "visible" : "invisible"}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            クリア
          </Button>
        </div>
      </div>
    </div>
  );
}
