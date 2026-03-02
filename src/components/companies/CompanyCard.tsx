'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { COMPANY_LABELS, EVALUATION_CYCLE_OPTIONS } from '@/lib/company/constants';

interface CompanyCardProps {
  company: {
    id: string;
    name: string;
    address?: string | null;
    representative?: string | null;
    establishedDate?: Date | string | null;
    businessDescription?: string | null;
    evaluationCycle: 'HALF_YEARLY' | 'YEARLY';
  };
}

export function CompanyCard({ company }: CompanyCardProps) {
  const evaluationCycleLabel =
    EVALUATION_CYCLE_OPTIONS.find((opt) => opt.value === company.evaluationCycle)?.label ||
    company.evaluationCycle;

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ja-JP');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{COMPANY_LABELS.BASIC_INFO}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              {COMPANY_LABELS.COMPANY_NAME}
            </dt>
            <dd className="text-sm mt-1">{company.name}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              {COMPANY_LABELS.REPRESENTATIVE}
            </dt>
            <dd className="text-sm mt-1">{company.representative || '-'}</dd>
          </div>

          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-muted-foreground">
              {COMPANY_LABELS.ADDRESS}
            </dt>
            <dd className="text-sm mt-1">{company.address || '-'}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              {COMPANY_LABELS.ESTABLISHED_DATE}
            </dt>
            <dd className="text-sm mt-1">{formatDate(company.establishedDate)}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              {COMPANY_LABELS.EVALUATION_CYCLE}
            </dt>
            <dd className="text-sm mt-1">{evaluationCycleLabel}</dd>
          </div>

          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-muted-foreground">
              {COMPANY_LABELS.BUSINESS_DESCRIPTION}
            </dt>
            <dd className="text-sm mt-1 whitespace-pre-wrap">
              {company.businessDescription || '-'}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
