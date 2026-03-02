/**
 * 企業ダッシュボード（概要）ページ
 */

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCompanyById } from "@/lib/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, TrendingUp, Calendar, ClipboardCheck, Building2, Briefcase } from "lucide-react";

// UIテキスト定数
const UI_TEXT = {
  PAGE_TITLE: "企業概要",
  BASIC_INFO: "基本情報",
  EVALUATION_PERIOD: "評価期間",
  REPRESENTATIVE: "代表者",
  GRADE_DISTRIBUTION: "等級分布",
  RECENT_ACTIVITY: "最近のアクティビティ",
  NOT_SET: "未設定",
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  return {
    title: company
      ? `${company.name} - ${UI_TEXT.PAGE_TITLE} | NiNKU BOXX`
      : `${UI_TEXT.PAGE_TITLE} | NiNKU BOXX`,
  };
}

export default async function CompanyDashboardPage({ params }: PageProps) {
  const { companyId } = await params;

  const [company, gradeDistribution, jobTypesCount] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: {
            employees: true,
            departments: true,
            grades: true,
          },
        },
      },
    }),
    prisma.grade.findMany({
      where: { companyId },
      orderBy: { level: "desc" },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    }),
    prisma.jobType.count({
      where: { jobCategory: { companyId } },
    }),
  ]);

  if (!company) {
    notFound();
  }

  const formatDate = (date: Date | null) => {
    if (!date) return UI_TEXT.NOT_SET;
    return new Date(date).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* ページタイトル */}
      <div>
        <h1 className="text-2xl font-bold">{company.name}</h1>
        <p className="text-muted-foreground">{UI_TEXT.PAGE_TITLE}</p>
      </div>

      {/* 統計サマリー */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center justify-between p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">従業員数</p>
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{company._count.employees}</p>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">部署数</p>
          </div>
          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{company._count.departments}</p>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300">等級数</p>
          </div>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{company._count.grades}</p>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
              <Briefcase className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-sm font-medium text-orange-700 dark:text-orange-300">職種数</p>
          </div>
          <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{jobTypesCount}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle>{UI_TEXT.BASIC_INFO}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {UI_TEXT.REPRESENTATIVE}
              </p>
              <p className="font-medium">{company.representative || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {UI_TEXT.EVALUATION_PERIOD}
              </p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {company.evaluationPeriodStart && company.evaluationPeriodEnd ? (
                  <span>
                    {formatDate(company.evaluationPeriodStart)} 〜 {formatDate(company.evaluationPeriodEnd)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{UI_TEXT.NOT_SET}</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 等級分布 */}
        <Card>
          <CardHeader>
            <CardTitle>{UI_TEXT.GRADE_DISTRIBUTION}</CardTitle>
            <CardDescription>
              各等級に所属する従業員数
            </CardDescription>
          </CardHeader>
          <CardContent>
            {gradeDistribution.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                等級が登録されていません
              </p>
            ) : (
              <div className="space-y-2">
                {gradeDistribution.map((grade) => (
                  <div
                    key={grade.id}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{grade.name}</span>
                    <span className="text-sm font-medium">
                      {grade._count.employees}名
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 最近のアクティビティ */}
      <Card>
        <CardHeader>
          <CardTitle>{UI_TEXT.RECENT_ACTIVITY}</CardTitle>
          <CardDescription>
            直近の評価・改定に関する履歴
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">評価期間が設定されました</p>
                <p className="text-xs text-muted-foreground">2時間前</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">従業員3名が追加されました</p>
                <p className="text-xs text-muted-foreground">昨日</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">号俸テーブルが更新されました</p>
                <p className="text-xs text-muted-foreground">3日前</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
