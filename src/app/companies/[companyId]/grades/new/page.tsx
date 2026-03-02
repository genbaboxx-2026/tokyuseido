/**
 * 等級作成ページ（企業コンテキスト）
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { GradeForm } from "@/components/grades/GradeForm";
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
      ? `${company.name} - ${GRADE_UI_TEXT.CREATE_GRADE} | NiNKU BOXX`
      : `${GRADE_UI_TEXT.CREATE_GRADE} | NiNKU BOXX`,
  };
}

export default async function NewGradePage({ params }: PageProps) {
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
          <h1 className="text-2xl font-bold">{GRADE_UI_TEXT.CREATE_GRADE}</h1>
          <p className="text-muted-foreground">新しい等級を作成します</p>
        </div>
      </div>

      <div className="max-w-xl">
        <GradeForm
          companyId={companyId}
          redirectPath={`/companies/${companyId}/grades`}
        />
      </div>
    </div>
  );
}
