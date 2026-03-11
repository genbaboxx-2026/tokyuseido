'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { GripVertical } from 'lucide-react';

interface JobType {
  id: string;
  name: string;
  jobCategoryId: string;
  displayOrder?: number;
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

function SortableJobType({ jobType }: { jobType: JobType }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: jobType.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 px-3 py-1 bg-secondary text-secondary-foreground rounded-md text-sm cursor-grab active:cursor-grabbing"
    >
      <GripVertical
        className="h-3 w-3 text-muted-foreground"
        {...attributes}
        {...listeners}
      />
      {jobType.name}
    </div>
  );
}

export function JobTypeManager({ companyId, jobCategories }: JobTypeManagerProps) {
  const router = useRouter();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isJobTypeDialogOpen, setIsJobTypeDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState(jobCategories);
  const [isReordering, setIsReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent, categoryId: string) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const category = localCategories.find((c) => c.id === categoryId);
      if (!category) return;

      const oldIndex = category.jobTypes.findIndex((jt) => jt.id === active.id);
      const newIndex = category.jobTypes.findIndex((jt) => jt.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const newJobTypes = arrayMove(category.jobTypes, oldIndex, newIndex);
      
      setLocalCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId ? { ...c, jobTypes: newJobTypes } : c
        )
      );

      setIsReordering(true);
      try {
        const response = await fetch(`/api/companies/${companyId}/job-types/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobCategoryId: categoryId,
            jobTypeIds: newJobTypes.map((jt) => jt.id),
          }),
        });

        if (!response.ok) {
          throw new Error('順番の更新に失敗しました');
        }

        router.refresh();
      } catch (err) {
        console.error(err);
        setLocalCategories(jobCategories);
      } finally {
        setIsReordering(false);
      }
    },
    [localCategories, companyId, router, jobCategories]
  );

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
            {localCategories.map((category) => (
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, category.id)}
                  >
                    <SortableContext
                      items={category.jobTypes.map((jt) => jt.id)}
                      strategy={horizontalListSortingStrategy}
                    >
                      <div className="flex flex-wrap gap-2">
                        {category.jobTypes.map((jobType) => (
                          <SortableJobType key={jobType.id} jobType={jobType} />
                        ))}
                      </div>
                    </SortableContext>
                    {isReordering && (
                      <p className="text-xs text-muted-foreground mt-2">保存中...</p>
                    )}
                  </DndContext>
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
