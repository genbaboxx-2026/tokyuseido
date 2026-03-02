/**
 * 従業員登録ページ（企業コンテキスト）
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { EmployeeForm } from "@/components/employees";
import { ChevronLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  return {
    title: company
      ? `${company.name} - 従業員登録 | NiNKU BOXX`
      : "従業員登録 | NiNKU BOXX",
  };
}

export default async function NewEmployeePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { companyId } = await params;

  // 企業の存在確認
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  if (!company) {
    notFound();
  }

  // マスターデータを取得
  const [departments, grades, jobTypes, positions] = await Promise.all([
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
      select: { id: true, name: true, jobCategory: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({
      where: { companyId },
      select: { id: true, name: true, level: true },
      orderBy: { level: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ヘッダー */}
      <div className="relative flex items-center justify-center">
        <div className="absolute left-0">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/companies/${companyId}/employees`}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">戻る</span>
            </Link>
          </Button>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold">従業員を登録</h1>
          <p className="text-muted-foreground">
            新しい従業員の情報を入力してください
          </p>
        </div>
      </div>

      {/* フォーム */}
      <EmployeeForm
        companyId={companyId}
        departments={departments.map((d) => ({
          value: d.id,
          label: d.name,
        }))}
        grades={grades.map((g) => ({
          value: g.id,
          label: g.name,
        }))}
        jobTypes={jobTypes.map((j) => ({
          value: j.id,
          label: `${j.jobCategory.name} / ${j.name}`,
        }))}
        positions={positions.map((p) => ({
          value: p.id,
          label: p.name,
        }))}
        redirectPath={`/companies/${companyId}/employees`}
      />
    </div>
  );
}
