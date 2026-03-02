/**
 * 新規企業登録ページ
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CompanyForm } from "@/components/companies";
import { COMPANY_LABELS } from "@/lib/company/constants";
import { MainLayout } from "@/components/layout";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: `${COMPANY_LABELS.CREATE_NEW} | NiNKU BOXX`,
};

export default async function NewCompanyPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">戻る</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{COMPANY_LABELS.CREATE_NEW}</h1>
            <p className="text-muted-foreground">
              新しいクライアント企業を登録します
            </p>
          </div>
        </div>

        <div className="max-w-2xl">
          <CompanyForm redirectPath="/dashboard" />
        </div>
      </div>
    </MainLayout>
  );
}
