'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  jobCategorySchema,
  jobTypeSchema,
  JobCategoryFormData,
  JobTypeFormData,
} from '@/lib/company/validation';
import { COMPANY_LABELS } from '@/lib/company/constants';

interface JobType {
  id: string;
  name: string;
  jobCategoryId: string;
}

interface JobCategory {
  id: string;
  name: string;
  jobTypes: JobType[];
}

interface JobTypeManagerProps {
  companyId: string;
  jobCategories: JobCategory[];
}

export function JobTypeManager({ companyId, jobCategories }: JobTypeManagerProps) {
  const router = useRouter();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isJobTypeDialogOpen, setIsJobTypeDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryForm = useForm<JobCategoryFormData>({
    resolver: zodResolver(jobCategorySchema),
    defaultValues: { name: '' },
  });

  const jobTypeForm = useForm<JobTypeFormData>({
    resolver: zodResolver(jobTypeSchema),
    defaultValues: { name: '', jobCategoryId: '' },
  });

  const openCategoryDialog = () => {
    categoryForm.reset({ name: '' });
    setError(null);
    setIsCategoryDialogOpen(true);
  };

  const openJobTypeDialog = (categoryId?: string) => {
    jobTypeForm.reset({ name: '', jobCategoryId: categoryId || '' });
    setError(null);
    setIsJobTypeDialogOpen(true);
  };

  const closeCategoryDialog = () => {
    setIsCategoryDialogOpen(false);
    categoryForm.reset();
    setError(null);
  };

  const closeJobTypeDialog = () => {
    setIsJobTypeDialogOpen(false);
    jobTypeForm.reset();
    setError(null);
  };

  const onCategorySubmit = async (data: JobCategoryFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/companies/${companyId}/job-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || COMPANY_LABELS.ERROR_OCCURRED);
      }

      closeCategoryDialog();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : COMPANY_LABELS.ERROR_OCCURRED);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onJobTypeSubmit = async (data: JobTypeFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/companies/${companyId}/job-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || COMPANY_LABELS.ERROR_OCCURRED);
      }

      closeJobTypeDialog();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : COMPANY_LABELS.ERROR_OCCURRED);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{COMPANY_LABELS.JOB_TYPES}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openCategoryDialog}>
            {COMPANY_LABELS.ADD_JOB_CATEGORY}
          </Button>
          <Button onClick={() => openJobTypeDialog()} disabled={jobCategories.length === 0}>
            {COMPANY_LABELS.ADD_JOB_TYPE}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {jobCategories.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            {COMPANY_LABELS.NO_DATA}
          </p>
        ) : (
          <div className="space-y-6">
            {jobCategories.map((category) => (
              <div key={category.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-lg">{category.name}</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openJobTypeDialog(category.id)}
                  >
                    {COMPANY_LABELS.ADD_JOB_TYPE}
                  </Button>
                </div>
                {category.jobTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    職種がありません
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {category.jobTypes.map((jobType) => (
                      <span
                        key={jobType.id}
                        className="px-3 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                      >
                        {jobType.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 職種大分類追加ダイアログ */}
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{COMPANY_LABELS.ADD_JOB_CATEGORY}</DialogTitle>
            </DialogHeader>

            <Form {...categoryForm}>
              <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                    {error}
                  </div>
                )}

                <FormField
                  control={categoryForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {COMPANY_LABELS.JOB_CATEGORY}
                        <span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="現場部門" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeCategoryDialog}>
                    {COMPANY_LABELS.CANCEL}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? COMPANY_LABELS.LOADING : COMPANY_LABELS.SAVE}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* 職種小分類追加ダイアログ */}
        <Dialog open={isJobTypeDialogOpen} onOpenChange={setIsJobTypeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{COMPANY_LABELS.ADD_JOB_TYPE}</DialogTitle>
            </DialogHeader>

            <Form {...jobTypeForm}>
              <form onSubmit={jobTypeForm.handleSubmit(onJobTypeSubmit)} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                    {error}
                  </div>
                )}

                <FormField
                  control={jobTypeForm.control}
                  name="jobCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {COMPANY_LABELS.JOB_CATEGORY}
                        <span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="部署を選択" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {jobCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={jobTypeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {COMPANY_LABELS.JOB_TYPE_DETAIL}
                        <span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="多能工" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeJobTypeDialog}>
                    {COMPANY_LABELS.CANCEL}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? COMPANY_LABELS.LOADING : COMPANY_LABELS.SAVE}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
