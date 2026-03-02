/**
 * 会社基本情報編集ページ
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { CompanyForm } from "@/components/companies";
import { COMPANY_LABELS } from "@/lib/company/constants";
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
      ? `${company.name} - ${COMPANY_LABELS.EDIT} | NiNKU BOXX`
      : `${COMPANY_LABELS.EDIT} | NiNKU BOXX`,
  };
}

export default async function EditCompanySettingsPage({ params }: PageProps) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { companyId } = await params;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/companies/${company.id}/settings`}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">戻る</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {company.name} - {COMPANY_LABELS.EDIT}
          </h1>
          <p className="text-muted-foreground">
            会社の基本情報を編集します
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <CompanyForm
          initialData={company}
          isEditing
          redirectPath={`/companies/${company.id}/settings`}
        />
      </div>
    </div>
  );
}
