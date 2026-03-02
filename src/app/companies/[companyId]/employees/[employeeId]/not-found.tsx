/**
 * 従業員が見つからない場合のページ
 */

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmployeeNotFound() {
  const params = useParams();
  const companyId = params.companyId as string;

  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>従業員が見つかりません</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            指定された従業員は存在しないか、削除された可能性があります。
          </p>
          <Button asChild>
            <Link href={`/companies/${companyId}/employees`}>
              従業員一覧に戻る
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
