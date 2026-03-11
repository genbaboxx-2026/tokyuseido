'use client';

import { useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { BasicInfoChanges } from '@/types/company-settings';

interface CompanyBasicInfoFormProps {
  company: {
    name: string;
    address: string | null;
    representative: string | null;
    establishedDate: Date | string | null;
    businessDescription: string | null;
  };
  onChange: (data: BasicInfoChanges | null) => void;
}

/**
 * 基本情報フォーム（常に編集可能）
 * 変更があった場合にonChangeで親に通知
 */
export function CompanyBasicInfoForm({ company, onChange }: CompanyBasicInfoFormProps) {
  // 初期値を作成
  const getDefaultValues = useCallback((): CompanyFormData => ({
    name: company.name ?? '',
    address: company.address ?? '',
    representative: company.representative ?? '',
    establishedDate: company.establishedDate
      ? new Date(company.establishedDate).toISOString().split('T')[0]
      : '',
    businessDescription: company.businessDescription ?? '',
  }), [company]);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: getDefaultValues(),
  });

  // 初期値との比較用
  const initialValues = getDefaultValues();

  // フォームの変更を監視して親に通知
  useEffect(() => {
    // eslint-disable-next-line react-hooks/incompatible-library -- React Hook Formのwatchは必須
    const subscription = form.watch((values) => {
      // 初期値と比較
      const hasChanges =
        values.name !== initialValues.name ||
        (values.address ?? '') !== (initialValues.address ?? '') ||
        (values.representative ?? '') !== (initialValues.representative ?? '') ||
        (values.establishedDate ?? '') !== (initialValues.establishedDate ?? '') ||
        (values.businessDescription ?? '') !== (initialValues.businessDescription ?? '');

      if (hasChanges) {
        onChange({
          name: values.name,
          address: values.address || null,
          representative: values.representative || null,
          establishedDate: values.establishedDate || null,
          businessDescription: values.businessDescription || null,
        });
      } else {
        onChange(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, onChange, initialValues]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{COMPANY_LABELS.BASIC_INFO}</CardTitle>
      </CardHeader>
      <CardContent>
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
