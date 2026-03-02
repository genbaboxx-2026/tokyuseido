/**
 * 従業員詳細ページ（パーソナルシート）（企業コンテキスト）
 */

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEmployeeById } from "@/lib/employee";
import { PersonalSheet } from "@/components/employees";
import { prisma } from "@/lib/prisma";

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
      ? `${employee.lastName} ${employee.firstName} - 従業員詳細 | NiNKU BOXX`
      : "従業員詳細 | NiNKU BOXX",
  };
}

export default async function EmployeeDetailPage({ params }: PageProps) {
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

  return (
    <div className="max-w-6xl">
      <PersonalSheet
        employee={employee}
        basePath={`/companies/${companyId}/employees`}
      />
    </div>
  );
}
