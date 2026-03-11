'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { COMPANY_LABELS } from '@/lib/company/constants';
import { companySchema, type CompanyFormData } from '@/lib/company/validation';
import { Pencil, X, Check, Loader2 } from 'lucide-react';

interface CompanyCardProps {
  company: {
    id: string;
    name: string;
    address?: string | null;
    representative?: string | null;
    establishedDate?: Date | string | null;
    businessDescription?: string | null;
  };
}

export function CompanyCard({ company }: CompanyCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ja-JP');
  };

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company.name ?? '',
      address: company.address ?? '',
      representative: company.representative ?? '',
      establishedDate: company.establishedDate
        ? new Date(company.establishedDate).toISOString().split('T')[0]
        : '',
      businessDescription: company.businessDescription ?? '',
    },
  });

  const onSubmit = async (data: CompanyFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/companies/${company.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || COMPANY_LABELS.ERROR_OCCURRED);
      }

      setIsEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : COMPANY_LABELS.ERROR_OCCURRED);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.reset({
      name: company.name ?? '',
      address: company.address ?? '',
      representative: company.representative ?? '',
      establishedDate: company.establishedDate
        ? new Date(company.establishedDate).toISOString().split('T')[0]
        : '',
      businessDescription: company.businessDescription ?? '',
    });
    setError(null);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>{COMPANY_LABELS.BASIC_INFO}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-1" />
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              保存
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
          <Form {...form}>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {COMPANY_LABELS.COMPANY_NAME}
                      <span className="text-red-500 ml-1">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="株式会社サンプル" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="representative"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{COMPANY_LABELS.REPRESENTATIVE}</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="山田 太郎" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{COMPANY_LABELS.ADDRESS}</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="東京都渋谷区..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="establishedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{COMPANY_LABELS.ESTABLISHED_DATE}</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessDescription"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{COMPANY_LABELS.BUSINESS_DESCRIPTION}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ''}
                        placeholder="建設業、解体業..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>{COMPANY_LABELS.BASIC_INFO}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          <Pencil className="h-4 w-4 mr-1" />
          編集
        </Button>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {COMPANY_LABELS.COMPANY_NAME}
            </dt>
            <dd className="text-base font-medium">{company.name}</dd>
          </div>

          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {COMPANY_LABELS.REPRESENTATIVE}
            </dt>
            <dd className="text-base font-medium">{company.representative || '-'}</dd>
          </div>

          <div className="md:col-span-2 space-y-1">
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {COMPANY_LABELS.ADDRESS}
            </dt>
            <dd className="text-base">{company.address || '-'}</dd>
          </div>

          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {COMPANY_LABELS.ESTABLISHED_DATE}
            </dt>
            <dd className="text-base">{formatDate(company.establishedDate)}</dd>
          </div>

          <div className="md:col-span-2 space-y-1">
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {COMPANY_LABELS.BUSINESS_DESCRIPTION}
            </dt>
            <dd className="text-base whitespace-pre-wrap">
              {company.businessDescription || '-'}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
