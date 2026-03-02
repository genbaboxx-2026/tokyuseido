/**
 * 会社設定ページ
 * 基本情報、部署、役職、職種、給与設定、賞与設定の管理
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCompanyById } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CompanyCard,
  DepartmentManager,
  PositionManager,
  JobTypeManager,
  SalaryTabPanel,
} from "@/components/companies";
import { COMPANY_LABELS } from "@/lib/company/constants";
import { Pencil } from "lucide-react";

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  return {
    title: company
      ? `${company.name} - ${COMPANY_LABELS.COMPANY_SETTINGS} | NiNKU BOXX`
      : `${COMPANY_LABELS.COMPANY_SETTINGS} | NiNKU BOXX`,
  };
}

export default async function CompanySettingsPage({ params }: PageProps) {
  const { companyId } = await params;

  const [company, bonusSettings] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: {
        departments: {
          orderBy: { name: "asc" },
          include: {
            parent: {
              select: { id: true, name: true },
            },
          },
        },
        positions: {
          orderBy: { level: "desc" },
        },
        jobCategories: {
          orderBy: { name: "asc" },
          include: {
            jobTypes: {
              orderBy: { name: "asc" },
            },
          },
        },
      },
    }),
    prisma.bonusSetting.findMany({
      where: { companyId },
      orderBy: { paymentDate: "asc" },
    }),
  ]);

  if (!company) {
    notFound();
  }

  // 給与設定
  const salarySettings = {
    salaryReflectionMonth: company.salaryReflectionMonth,
    salaryReflectionDay: company.salaryReflectionDay,
    evaluationPeriodStart: company.evaluationPeriodStart,
    evaluationPeriodEnd: company.evaluationPeriodEnd,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{COMPANY_LABELS.COMPANY_SETTINGS}</h1>
          <p className="text-muted-foreground">
            {company.name}の設定を管理します
          </p>
        </div>
        <Link href={`/companies/${company.id}/settings/edit`}>
          <Button variant="outline">
            <Pencil className="h-4 w-4 mr-2" />
            {COMPANY_LABELS.EDIT}
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="basic">{COMPANY_LABELS.BASIC_INFO}</TabsTrigger>
          <TabsTrigger value="departments">
            {COMPANY_LABELS.DEPARTMENTS}
          </TabsTrigger>
          <TabsTrigger value="positions">{COMPANY_LABELS.POSITIONS}</TabsTrigger>
          <TabsTrigger value="jobTypes">{COMPANY_LABELS.JOB_TYPES}</TabsTrigger>
          <TabsTrigger value="salary">給与設定</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <CompanyCard company={company} />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentManager
            companyId={company.id}
            departments={company.departments}
          />
        </TabsContent>

        <TabsContent value="positions">
          <PositionManager
            companyId={company.id}
            positions={company.positions}
          />
        </TabsContent>

        <TabsContent value="jobTypes">
          <JobTypeManager
            companyId={company.id}
            jobCategories={company.jobCategories}
          />
        </TabsContent>

        <TabsContent value="salary">
          <SalaryTabPanel
            companyId={company.id}
            salarySettings={salarySettings}
            bonusSettings={bonusSettings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
