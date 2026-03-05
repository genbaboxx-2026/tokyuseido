'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmploymentTypeLabels } from '@/types/employee';

interface EmploymentTypeManagerProps {
  companyId: string;
}

export function EmploymentTypeManager({ companyId }: EmploymentTypeManagerProps) {
  const employmentTypes = Object.entries(EmploymentTypeLabels).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>雇用形態管理</CardTitle>
        <Badge variant="outline" className="text-xs">システム共通</Badge>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>雇用形態</TableHead>
              <TableHead>コード</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employmentTypes.map((type) => (
              <TableRow key={type.value}>
                <TableCell className="font-medium">{type.label}</TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{type.value}</code>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-4">
          ※ 雇用形態はシステム共通で定義されています。カスタマイズが必要な場合はお問い合わせください。
        </p>
      </CardContent>
    </Card>
  );
}
