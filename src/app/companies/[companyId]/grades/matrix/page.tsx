/**
 * 等級×職種マトリクス設定ページ（企業コンテキスト）
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
import { GradeMatrix } from "@/components/grades/GradeMatrix";
import { GRADE_UI_TEXT } from "@/lib/grade/constants";

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
      ? `${company.name} - ${GRADE_UI_TEXT.MATRIX_SETTINGS} | NiNKU BOXX`
      : `${GRADE_UI_TEXT.MATRIX_SETTINGS} | NiNKU BOXX`,
  };
}

export default async function GradeMatrixPage({ params }: PageProps) {
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

  // 等級一覧を取得
  const grades = await prisma.grade.findMany({
    where: { companyId },
    orderBy: [{ employmentType: "asc" }, { level: "desc" }],
  });

  // 職種大分類と小分類を取得
  const jobCategories = await prisma.jobCategory.findMany({
    where: { companyId },
    include: {
      jobTypes: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // 全ての等級×職種設定を取得
  const configs = await prisma.gradeJobTypeConfig.findMany({
    where: {
      grade: { companyId },
    },
    include: {
      gradeRole: true,
    },
  });

  // マトリクス形式にデータを整形
  const configMap = new Map(
    configs.map((config) => [`${config.gradeId}-${config.jobTypeId}`, config])
  );

  const matrix = grades.map((grade) => ({
    grade,
    jobTypes: jobCategories.flatMap((category) =>
      category.jobTypes.map((jobType) => {
        const configKey = `${grade.id}-${jobType.id}`;
        const config = configMap.get(configKey);
        return {
          jobType,
          jobCategory: { id: category.id, name: category.name },
          config: config ? { id: config.id, isEnabled: config.isEnabled } : null,
          isEnabled: config?.isEnabled ?? false,
          hasRole: config?.gradeRole !== null && config?.gradeRole !== undefined,
        };
      })
    ),
  }));

  const hasNoData =
    grades.length === 0 ||
    jobCategories.every((c) => c.jobTypes.length === 0);

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
          <h1 className="text-2xl font-bold">{GRADE_UI_TEXT.MATRIX_SETTINGS}</h1>
          <p className="text-muted-foreground">
            等級と職種の組み合わせの有効/無効を設定します
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>マトリクス設定</CardTitle>
          <CardDescription>
            チェックを入れた組み合わせが有効になります。変更は即座に保存されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasNoData ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>等級または職種が登録されていません。</p>
              <p className="text-sm mt-2">
                先に等級と職種を登録してください。
              </p>
            </div>
          ) : (
            <GradeMatrix
              matrix={matrix}
              jobCategories={jobCategories}
              companyId={companyId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
