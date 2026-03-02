"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GRADE_UI_TEXT } from "@/lib/grade/constants";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GradesError({ error, reset }: ErrorPageProps) {
  const params = useParams();
  const companyId = params.companyId as string;

  useEffect(() => {
    console.error("等級ページエラー:", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{GRADE_UI_TEXT.PAGE_TITLE}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">
            {GRADE_UI_TEXT.ERROR_OCCURRED}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            ページの読み込み中にエラーが発生しました。
          </p>
          <div className="flex gap-3">
            <Button onClick={reset} variant="outline">
              再試行
            </Button>
            <Button asChild>
              <Link href={`/companies/${companyId}/grades`}>
                等級一覧に戻る
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
