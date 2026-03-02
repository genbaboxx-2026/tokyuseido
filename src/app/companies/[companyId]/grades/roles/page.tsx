/**
 * 役割責任設定ページ（企業コンテキスト）
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RoleMatrix } from "@/components/grades/RoleMatrix";
import { GRADE_UI_TEXT } from "@/lib/grade/constants";
import { TooltipProvider } from "@/components/ui/tooltip";

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
      ? `${company.name} - ${GRADE_UI_TEXT.ROLE_RESPONSIBILITY} | NiNKU BOXX`
      : `${GRADE_UI_TEXT.ROLE_RESPONSIBILITY} | NiNKU BOXX`,
  };
}

export default async function GradeRolesPage({ params }: PageProps) {
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

  // 有効な等級×職種設定と役割責任を取得
  const configs = await prisma.gradeJobTypeConfig.findMany({
    where: {
      grade: { companyId },
      isEnabled: true,
    },
    include: {
      grade: true,
      jobType: {
        include: {
          jobCategory: true,
        },
      },
      gradeRole: true,
    },
    orderBy: [{ grade: { level: "desc" } }, { jobType: { name: "asc" } }],
  });

  // 該当従業員を取得
  const employees = await prisma.employee.findMany({
    where: { companyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gradeId: true,
      jobTypeId: true,
      position: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // 等級×職種ごとに該当従業員をマッピング
  const employeeMap = new Map<string, typeof employees>();
  employees.forEach((employee) => {
    if (employee.gradeId && employee.jobTypeId) {
      const key = `${employee.gradeId}-${employee.jobTypeId}`;
      const existing = employeeMap.get(key) || [];
      existing.push(employee);
      employeeMap.set(key, existing);
    }
  });

  const roles = configs.map((config) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: config as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: config.gradeRole as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employees: (employeeMap.get(`${config.gradeId}-${config.jobTypeId}`) || []) as any[],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${companyId}/grades`}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">戻る</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {GRADE_UI_TEXT.ROLE_RESPONSIBILITY}
          </h1>
          <p className="text-muted-foreground">
            等級×職種ごとの役割責任を設定します
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>役割責任一覧</CardTitle>
          <CardDescription>
            有効な等級×職種の組み合わせに対して、役割責任を設定できます。
            セルの編集ボタンをクリックして編集してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <RoleMatrix roles={roles} companyId={companyId} />
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}
