/**
 * 従業員一覧ページ（企業コンテキスト）
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCompanyById } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { EmployeeTable } from "@/components/employees";
import { getEmployees } from "@/lib/employee";
import type { EmploymentType } from "@/types/employee";
import { Plus } from "lucide-react";

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    search?: string;
    departmentId?: string;
    gradeId?: string;
    jobTypeId?: string;
    employmentType?: string;
    positionId?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  return {
    title: company
      ? `${company.name} - 従業員管理 | NiNKU BOXX`
      : "従業員管理 | NiNKU BOXX",
  };
}

export default async function EmployeesPage({
  params,
  searchParams,
}: PageProps) {
  const [{ companyId }, searchParamsResolved] = await Promise.all([
    params,
    searchParams,
  ]);

  const [companyCheck, departments, grades, jobTypes, , positions] = await Promise.all([
    getCompanyById(companyId),
    prisma.department.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.grade.findMany({
      where: { companyId },
      select: { id: true, name: true, level: true },
      orderBy: { level: "asc" },
    }),
    prisma.jobType.findMany({
      where: { jobCategory: { companyId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.jobType.count({
      where: { jobCategory: { companyId } },
    }),
    prisma.position.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { level: "asc" },
    }),
  ]);

  if (!companyCheck) {
    notFound();
  }

  const parseMultiParam = (value: string | undefined): string[] | undefined => {
    if (!value) return undefined;
    const parts = value.split(",").filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  };

  // 従業員一覧を取得
  const query = {
    companyId,
    keyword: searchParamsResolved.search || undefined,
    departmentId: parseMultiParam(searchParamsResolved.departmentId),
    gradeId: parseMultiParam(searchParamsResolved.gradeId),
    jobTypeId: parseMultiParam(searchParamsResolved.jobTypeId),
    employmentType: parseMultiParam(searchParamsResolved.employmentType) as EmploymentType[] | undefined,
    positionId: parseMultiParam(searchParamsResolved.positionId),
    page: parseInt(searchParamsResolved.page || "1", 10),
    limit: parseInt(searchParamsResolved.limit || "20", 10),
    sortBy: (searchParamsResolved.sortBy || "employeeCode") as
      | "employeeCode"
      | "lastName"
      | "hireDate"
      | "gradeLevel"
      | "baseSalary"
      | "createdAt",
    sortOrder: (searchParamsResolved.sortOrder || "asc") as "asc" | "desc",
  };

  const result = await getEmployees(query);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">従業員管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            従業員情報の確認と管理を行います
          </p>
        </div>
        <Button asChild>
          <Link href={`/companies/${companyId}/employees/new`}>
            <Plus className="h-4 w-4 mr-2" />
            従業員を登録
          </Link>
        </Button>
      </div>

      {/* 従業員一覧 */}
      <EmployeeTable
        employees={result.employees}
        total={result.total}
        page={result.page}
        limit={result.limit}
        companyId={companyId}
        basePath={`/companies/${companyId}/employees`}
        filters={{
          departments: departments.map((d) => ({ value: d.id, label: d.name })),
          grades: grades.map((g) => ({ value: g.id, label: g.name })),
          jobTypes: jobTypes.map((j) => ({ value: j.id, label: j.name })),
          positions: positions.map((p) => ({ value: p.id, label: p.name })),
        }}
      />
    </div>
  );
}
