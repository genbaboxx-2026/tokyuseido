/**
 * 企業コンテキスト用レイアウト
 * 企業専用のサイドバーメニューを表示
 */

import { ReactNode, cache } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MainLayout } from "@/components/layout/MainLayout";
import { getCompanyById } from "@/lib/data";

const getUserName = cache(async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return user?.name || undefined;
});

interface CompanyLayoutProps {
  children: ReactNode;
  params: Promise<{ companyId: string }>;
}

export default async function CompanyLayout({
  children,
  params,
}: CompanyLayoutProps) {
  const [session, { companyId }] = await Promise.all([
    auth(),
    params,
  ]);

  const [company, userName] = await Promise.all([
    getCompanyById(companyId),
    session?.user?.id ? getUserName(session.user.id) : undefined,
  ]);

  if (!company) {
    notFound();
  }

  return (
    <MainLayout userName={userName} companyName={company.name}>
      {children}
    </MainLayout>
  );
}
