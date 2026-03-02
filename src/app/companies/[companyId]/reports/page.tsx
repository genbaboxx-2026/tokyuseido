/**
 * レポート出力ページ
 * 評価シートPDF、号俸テーブルPDFの出力機能を提供
 */

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCompanyById } from "@/lib/data";
import { ReportCard } from "@/components/reports";
import { EvaluationSheetDownloader, SalaryTableDownloader } from "./ReportDownloaders";

// UIテキスト定数
const UI_TEXT = {
  PAGE_TITLE: "レポート出力",
  PAGE_DESCRIPTION: "各種レポートのPDF出力を行います。",
  EVALUATION_SHEET: {
    TITLE: "評価シートPDF",
    DESCRIPTION: "従業員の評価結果をPDF形式で出力します。評価期間、被評価者情報、評価項目、スコア、コメントを含みます。",
    NO_EVALUATIONS: "出力可能な評価がありません。評価を作成してください。",
  },
  SALARY_TABLE: {
    TITLE: "号俸テーブルPDF",
    DESCRIPTION: "号俸テーブルをPDF形式で出力します。等級×ランクのマトリクス形式で表示されます。",
    NO_TABLES: "出力可能な号俸テーブルがありません。号俸テーブルを作成してください。",
  },
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function ReportsPage({ params }: PageProps) {
  const { companyId } = await params;

  const [company, evaluations, salaryTables] = await Promise.all([
    getCompanyById(companyId),
    prisma.individualEvaluation.findMany({
      where: {
        evaluationPeriod: {
          companyId,
        },
      },
      include: {
        evaluationPeriod: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        evaluator: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { evaluationPeriod: { startDate: 'desc' } },
        { employee: { lastName: 'asc' } },
      ],
    }),
    prisma.salaryTable.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!company) {
    notFound();
  }

  // シリアライズ可能なデータに変換
  const evaluationsData = evaluations.map((e) => ({
    id: e.id,
    status: e.status,
    periodName: e.evaluationPeriod.name,
    employeeFullName: `${e.employee.lastName} ${e.employee.firstName}`,
    employeeCode: e.employee.employeeCode,
    evaluatorName: e.evaluator.name || '評価者',
  }));

  const salaryTablesData = salaryTables.map((t) => ({
    id: t.id,
    name: t.name,
    isActive: t.isActive,
  }));

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">{UI_TEXT.PAGE_TITLE}</h1>
        <p className="text-muted-foreground mt-1">{UI_TEXT.PAGE_DESCRIPTION}</p>
      </div>

      {/* レポートカード一覧 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 評価シートPDF */}
        <ReportCard
          title={UI_TEXT.EVALUATION_SHEET.TITLE}
          description={UI_TEXT.EVALUATION_SHEET.DESCRIPTION}
          iconType="file-text"
        >
          {evaluationsData.length > 0 ? (
            <EvaluationSheetDownloader evaluations={evaluationsData} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {UI_TEXT.EVALUATION_SHEET.NO_EVALUATIONS}
            </p>
          )}
        </ReportCard>

        {/* 号俸テーブルPDF */}
        <ReportCard
          title={UI_TEXT.SALARY_TABLE.TITLE}
          description={UI_TEXT.SALARY_TABLE.DESCRIPTION}
          iconType="table"
        >
          {salaryTablesData.length > 0 ? (
            <SalaryTableDownloader salaryTables={salaryTablesData} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {UI_TEXT.SALARY_TABLE.NO_TABLES}
            </p>
          )}
        </ReportCard>
      </div>
    </div>
  );
}
