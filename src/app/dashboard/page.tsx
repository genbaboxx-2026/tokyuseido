/**
 * ダッシュボード - クライアント企業一覧ページ
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Building2, Users, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MainLayout } from "@/components/layout";

// UIテキスト定数
const UI_TEXT = {
  PAGE_TITLE: "クライアント企業一覧",
  PAGE_DESCRIPTION: "管理しているクライアント企業を選択してください",
  ADD_NEW_COMPANY: "新しい企業を追加",
  NO_COMPANIES: "登録されている企業がありません",
  NO_COMPANIES_DESCRIPTION: "新しい企業を追加して、人事制度の構築を開始しましょう",
  EMPLOYEES: "従業員",
  DEPARTMENTS: "部署",
  GRADES: "等級",
  VIEW_DETAILS: "詳細を見る",
};

export const metadata = {
  title: "ダッシュボード | NiNKU BOXX",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          employees: true,
          departments: true,
          grades: true,
        },
      },
    },
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{UI_TEXT.PAGE_TITLE}</h1>
            <p className="text-muted-foreground">{UI_TEXT.PAGE_DESCRIPTION}</p>
          </div>
          <Button asChild>
            <Link href="/companies/new">
              <Plus className="h-4 w-4 mr-2" />
              {UI_TEXT.ADD_NEW_COMPANY}
            </Link>
          </Button>
        </div>

        {/* 企業一覧 */}
        {companies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {UI_TEXT.NO_COMPANIES}
              </h3>
              <p className="text-muted-foreground mb-4">
                {UI_TEXT.NO_COMPANIES_DESCRIPTION}
              </p>
              <Button asChild>
                <Link href="/companies/new">
                  <Plus className="h-4 w-4 mr-2" />
                  {UI_TEXT.ADD_NEW_COMPANY}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className="block"
              >
                <Card className="h-full transition-colors hover:border-primary hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {company.name}
                    </CardTitle>
                    {company.representative && (
                      <CardDescription>
                        代表: {company.representative}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                        </div>
                        <p className="text-2xl font-bold">
                          {company._count.employees}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {UI_TEXT.EMPLOYEES}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <p className="text-2xl font-bold">
                          {company._count.departments}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {UI_TEXT.DEPARTMENTS}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <p className="text-2xl font-bold">
                          {company._count.grades}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {UI_TEXT.GRADES}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
