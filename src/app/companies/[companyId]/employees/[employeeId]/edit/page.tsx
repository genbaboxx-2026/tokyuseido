/**
 * 従業員編集ページ（企業コンテキスト）
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { EmployeeForm } from "@/components/employees";
import { getEmployeeById } from "@/lib/employee";
import { ChevronLeft } from "lucide-react";

interface PageProps {
  params: Promise<{
    companyId: string;
    employeeId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { employeeId } = await params;
  const employee = await getEmployeeById(employeeId);

  return {
    title: employee
      ? `${employee.lastName} ${employee.firstName} - 編集 | NiNKU BOXX`
      : "従業員編集 | NiNKU BOXX",
  };
}

export default async function EditEmployeePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { companyId, employeeId } = await params;

  // 企業の存在確認
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });

  if (!company) {
    notFound();
  }

  const employee = await getEmployeeById(employeeId);

  if (!employee) {
    notFound();
  }

  // 従業員が指定された企業に属しているか確認
  if (employee.companyId !== companyId) {
    notFound();
  }

  // マスターデータを取得
  const [jobCategories, grades, jobTypes, positions] = await Promise.all([
    prisma.jobCategory.findMany({
      where: { companyId: employee.companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.grade.findMany({
      where: { companyId: employee.companyId },
      select: { id: true, name: true, level: true },
      orderBy: { level: "asc" },
    }),
    prisma.jobType.findMany({
      where: { jobCategory: { companyId: employee.companyId } },
      select: { id: true, name: true, jobCategoryId: true },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({
      where: { companyId: employee.companyId },
      select: { id: true, name: true, level: true },
      orderBy: { level: "desc" },
    }),
  ]);

  // 日付をフォーマット
  const formatDateForInput = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  // 従業員のjobTypeからjobCategoryIdを取得
  const employeeJobType = jobTypes.find((j) => j.id === employee.jobTypeId);
  const jobCategoryId = employeeJobType?.jobCategoryId || "";

  const initialData = {
    id: employee.id,
    employeeCode: employee.employeeCode,
    lastName: employee.lastName,
    firstName: employee.firstName,
    email: employee.email || "",
    gender: employee.gender || "",
    birthDate: formatDateForInput(employee.birthDate),
    hireDate: formatDateForInput(employee.hireDate),
    jobCategoryId,
    employmentType: employee.employmentType,
    jobTypeId: employee.jobTypeId || "",
    gradeId: employee.gradeId || "",
    positionId: employee.positionId || "",
    currentStep: employee.currentStep || undefined,
    currentRank: employee.currentRank || "",
    baseSalary: employee.baseSalary || undefined,
    status: employee.status || "ACTIVE",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ヘッダー */}
      <div className="relative flex items-center justify-center">
        <div className="absolute left-0">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/companies/${companyId}/employees/${employee.id}`}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">戻る</span>
            </Link>
          </Button>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold">従業員情報を編集</h1>
          <p className="text-muted-foreground">
            {employee.fullName}（{employee.employeeCode}）
          </p>
        </div>
      </div>

      {/* フォーム */}
      <EmployeeForm
        companyId={employee.companyId}
        jobCategories={jobCategories.map((c) => ({
          value: c.id,
          label: c.name,
        }))}
        grades={grades.map((g) => ({
          value: g.id,
          label: g.name,
        }))}
        jobTypes={jobTypes.map((j) => ({
          value: j.id,
          label: j.name,
          jobCategoryId: j.jobCategoryId,
        }))}
        positions={positions.map((p) => ({
          value: p.id,
          label: p.name,
        }))}
        initialData={initialData}
        isEdit
        redirectPath={`/companies/${companyId}/employees/${employee.id}`}
      />
    </div>
  );
}
