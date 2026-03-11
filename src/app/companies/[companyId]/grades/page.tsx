/**
 * 等級制度管理ページ（企業コンテキスト）
 * 等級×職種マトリクスと役割責任を一画面で管理
 */

import { notFound } from "next/navigation";
import { Grid } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanyById } from "@/lib/data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleMatrix } from "@/components/grades/RoleMatrix";
import { GradeMatrix } from "@/components/grades/GradeMatrix";
import { GRADE_UI_TEXT } from "@/lib/grade/constants";

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  return {
    title: company
      ? `${company.name} - ${GRADE_UI_TEXT.PAGE_TITLE} | NiNKU BOXX`
      : `${GRADE_UI_TEXT.PAGE_TITLE} | NiNKU BOXX`,
  };
}

export default async function GradesPage({ params }: PageProps) {
  const { companyId } = await params;

  const [companyCheck, grades, jobCategories, configs, employees] = await Promise.all([
    getCompanyById(companyId),
    prisma.grade.findMany({
      where: { companyId },
      orderBy: [{ employmentType: "asc" }, { level: "desc" }],
    }),
    prisma.jobCategory.findMany({
      where: { companyId },
      include: {
        jobTypes: {
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.gradeJobTypeConfig.findMany({
      where: {
        grade: { companyId },
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
    }),
    prisma.employee.findMany({
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
    }),
  ]);

  if (!companyCheck) {
    notFound();
  }

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

  // 役割責任用データ（有効な組み合わせのみ）
  const enabledConfigs = configs.filter((c) => c.isEnabled);
  const roles = enabledConfigs.map((config) => ({
    config,
    role: config.gradeRole,
    employees: employeeMap.get(`${config.gradeId}-${config.jobTypeId}`) || [],
  }));

  const hasNoData =
    grades.length === 0 ||
    jobCategories.every((c) => c.jobTypes.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{GRADE_UI_TEXT.PAGE_TITLE}</h1>
        <p className="text-muted-foreground">
          等級×職種の組み合わせと役割責任を管理します
        </p>
      </div>

      {hasNoData ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Grid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              等級または職種が登録されていません
            </h3>
            <p className="text-muted-foreground mb-4">
              会社設定から職種を登録後、下記のマトリクスで等級を追加してください
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="matrix" className="space-y-4">
          <TabsList>
            <TabsTrigger value="matrix">有効/無効設定</TabsTrigger>
            <TabsTrigger value="roles">役割責任</TabsTrigger>
          </TabsList>

          <TabsContent value="matrix">
            <Card>
              <CardHeader>
                <CardTitle>等級×職種マトリクス</CardTitle>
                <CardDescription>
                  チェックを入れた組み合わせが有効になります。有効な組み合わせのみ役割責任を設定できます。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GradeMatrix
                  matrix={matrix}
                  jobCategories={jobCategories}
                  companyId={companyId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle>役割責任マトリクス</CardTitle>
                <CardDescription>
                  各等級×職種の組み合わせに対して、求められる役割責任を設定できます。
                  セルをクリックして編集してください。
                </CardDescription>
              </CardHeader>
              <CardContent>
                {roles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>有効な等級×職種の組み合わせがありません</p>
                    <p className="text-sm mt-2">
                      「有効/無効設定」タブで組み合わせを有効にしてください
                    </p>
                  </div>
                ) : (
                  <RoleMatrix roles={roles} companyId={companyId} jobCategories={jobCategories} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
