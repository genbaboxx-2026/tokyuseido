'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { companySchema, type CompanyFormData } from '@/lib/company/validation';
import { COMPANY_LABELS } from '@/lib/company/constants';

interface CompanyFormProps {
  initialData?: {
    id: string;
    name: string;
    address?: string | null;
    representative?: string | null;
    establishedDate?: Date | string | null;
    businessDescription?: string | null;
  };
  isEditing?: boolean;
  redirectPath?: string;
}

export function CompanyForm({ initialData, isEditing = false, redirectPath }: CompanyFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: initialData?.name ?? '',
      address: initialData?.address ?? '',
      representative: initialData?.representative ?? '',
      establishedDate: initialData?.establishedDate
        ? new Date(initialData.establishedDate).toISOString().split('T')[0]
        : '',
      businessDescription: initialData?.businessDescription ?? '',
    },
  });

  const onSubmit = async (data: CompanyFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/companies/${initialData?.id}`
        : '/api/companies';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || COMPANY_LABELS.ERROR_OCCURRED);
      }

      const company = await response.json();
      router.push(redirectPath || `/companies/${company.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : COMPANY_LABELS.ERROR_OCCURRED);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? `${COMPANY_LABELS.EDIT}` : COMPANY_LABELS.CREATE_NEW}
        </CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

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
              name="address"
              render={({ field }) => (
                <FormItem>
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
                <FormItem>
                  <FormLabel>{COMPANY_LABELS.BUSINESS_DESCRIPTION}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ''}
                      placeholder="建設業、解体業..."
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              {COMPANY_LABELS.CANCEL}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? COMPANY_LABELS.LOADING : COMPANY_LABELS.SAVE}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
