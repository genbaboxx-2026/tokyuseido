/**
 * 等級編集ページ（企業コンテキスト）
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
  params: Promise<{ companyId: string; gradeId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { gradeId } = await params;
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: { name: true },
  });

  return {
    title: grade
      ? `${grade.name} - ${GRADE_UI_TEXT.EDIT} | NiNKU BOXX`
      : `${GRADE_UI_TEXT.EDIT} | NiNKU BOXX`,
  };
}

export default async function EditGradePage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { companyId, gradeId } = await params;

  // 企業の存在確認
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  if (!company) {
    notFound();
  }

  // 等級を取得
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: {
      id: true,
      name: true,
      level: true,
      employmentType: true,
      isManagement: true,
      companyId: true,
    },
  });

  if (!grade) {
    notFound();
  }

  // 等級が指定された企業に属しているか確認
  if (grade.companyId !== companyId) {
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
          <h1 className="text-2xl font-bold">{GRADE_UI_TEXT.EDIT}</h1>
          <p className="text-muted-foreground">
            「{grade.name}」を編集します
          </p>
        </div>
      </div>

      <div className="max-w-xl">
        <GradeForm
          companyId={grade.companyId}
          initialData={{
            id: grade.id,
            name: grade.name,
            level: grade.level,
            employmentType: grade.employmentType,
            isManagement: grade.isManagement,
          }}
          redirectPath={`/companies/${companyId}/grades`}
        />
      </div>
    </div>
  );
}
