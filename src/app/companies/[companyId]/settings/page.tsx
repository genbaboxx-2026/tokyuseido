/**
 * 会社設定ページ
 * 基本情報、部署、役職、職種、給与設定、賞与設定の管理
 * 全ての変更を1つの「保存」ボタンで一括保存
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCompanyById } from '@/lib/data';
import { CompanySettingsClient } from '@/components/companies';
import { COMPANY_LABELS } from '@/lib/company/constants';

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
        positions: {
          orderBy: { level: 'desc' },
        },
        jobCategories: {
          orderBy: { name: 'asc' },
          include: {
            jobTypes: {
              orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
            },
          },
        },
      },
    }),
    prisma.bonusSetting.findMany({
      where: { companyId },
      orderBy: { paymentDate: 'asc' },
    }),
  ]);

  if (!company) {
    notFound();
  }

  return (
    <CompanySettingsClient
      company={company}
      bonusSettings={bonusSettings}
    />
  );
}
