'use client';

import { useState, useCallback, useRef } from 'react';
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
import type { JobCategoryChanges } from '@/types/company-settings';
import { generateTempId } from '@/types/company-settings';
import { RotateCcw, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface DisplayJobType extends JobType {
  isNew: boolean;
  isUpdated: boolean;
  isDeleted: boolean;
}

interface DisplayJobCategory {
  id: string;
  name: string;
  jobTypes: DisplayJobType[];
  isNew: boolean;
  isUpdated: boolean;
  isDeleted: boolean;
}

interface JobTypeManagerEditableProps {
  companyId: string;
  initialJobCategories: JobCategory[];
  onChange: (data: JobCategoryChanges | null) => void;
}

/**
 * 職種管理（編集可能、ペンディング状態管理）
 * 親子関係（JobCategory -> JobType）を持つ
 */
export function JobTypeManagerEditable({
  initialJobCategories,
  onChange,
}: JobTypeManagerEditableProps) {
  // 初期データを保存
  const initialCategoriesRef = useRef<JobCategory[]>(initialJobCategories);

  const [categories, setCategories] = useState<DisplayJobCategory[]>(
    initialJobCategories.map((cat) => ({
      ...cat,
      isNew: false,
      isUpdated: false,
      isDeleted: false,
      jobTypes: cat.jobTypes.map((jt) => ({
        ...jt,
        isNew: false,
        isUpdated: false,
        isDeleted: false,
      })),
    }))
  );

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isJobTypeDialogOpen, setIsJobTypeDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DisplayJobCategory | null>(null);
  const [editingJobType, setEditingJobType] = useState<DisplayJobType | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const categoryForm = useForm<JobCategoryFormData>({
    resolver: zodResolver(jobCategorySchema),
    defaultValues: { name: '' },
  });

  const jobTypeForm = useForm<JobTypeFormData>({
    resolver: zodResolver(jobTypeSchema),
    defaultValues: { name: '', jobCategoryId: '' },
  });

  // 変更を検出して親に通知
  const notifyChanges = useCallback(
    (categoryList: DisplayJobCategory[]) => {
      // 職種大分類の変更
      const addedCategories = categoryList
        .filter((c) => c.isNew && !c.isDeleted)
        .map((c) => ({
          tempId: c.id,
          name: c.name,
        }));

      const updatedCategories = categoryList
        .filter((c) => !c.isNew && c.isUpdated && !c.isDeleted)
        .map((c) => ({
          id: c.id,
          name: c.name,
        }));

      const deletedCategories = categoryList
        .filter((c) => !c.isNew && c.isDeleted)
        .map((c) => c.id);

      // 職種の変更
      const allJobTypes = categoryList.flatMap((c) =>
        c.jobTypes.map((jt) => ({ ...jt, categoryId: c.id, categoryDeleted: c.isDeleted }))
      );

      const addedJobTypes = allJobTypes
        .filter((jt) => jt.isNew && !jt.isDeleted && !jt.categoryDeleted)
        .map((jt) => ({
          categoryId: jt.categoryId,
          tempId: jt.id,
          name: jt.name,
        }));

      const updatedJobTypes = allJobTypes
        .filter((jt) => !jt.isNew && jt.isUpdated && !jt.isDeleted && !jt.categoryDeleted)
        .map((jt) => ({
          id: jt.id,
          name: jt.name,
        }));

      const deletedJobTypes = allJobTypes
        .filter((jt) => !jt.isNew && jt.isDeleted && !jt.categoryDeleted)
        .map((jt) => jt.id);

      const hasChanges =
        addedCategories.length > 0 ||
        updatedCategories.length > 0 ||
        deletedCategories.length > 0 ||
        addedJobTypes.length > 0 ||
        updatedJobTypes.length > 0 ||
        deletedJobTypes.length > 0;

      if (hasChanges) {
        onChange({
          added: addedCategories,
          updated: updatedCategories,
          deleted: deletedCategories,
          jobTypesAdded: addedJobTypes,
          jobTypesUpdated: updatedJobTypes,
          jobTypesDeleted: deletedJobTypes,
        });
      } else {
        onChange(null);
      }
    },
    [onChange]
  );

  // === 職種大分類（Category）の操作 ===
  const openCategoryDialog = (category?: DisplayJobCategory) => {
    if (category) {
      setEditingCategory(category);
      categoryForm.reset({ name: category.name });
    } else {
      setEditingCategory(null);
      categoryForm.reset({ name: '' });
    }
    setIsCategoryDialogOpen(true);
  };

  const closeCategoryDialog = () => {
    setIsCategoryDialogOpen(false);
    setEditingCategory(null);
    categoryForm.reset();
  };

  const onCategorySubmit = (data: JobCategoryFormData) => {
    if (editingCategory) {
      // 編集
      const newCategories = categories.map((c) => {
        if (c.id === editingCategory.id) {
          return {
            ...c,
            name: data.name,
            isUpdated: !c.isNew ? true : c.isUpdated,
          };
        }
        return c;
      });
      setCategories(newCategories);
      notifyChanges(newCategories);
    } else {
      // 新規追加
      const newCategory: DisplayJobCategory = {
        id: generateTempId(),
        name: data.name,
        jobTypes: [],
        isNew: true,
        isUpdated: false,
        isDeleted: false,
      };
      const newCategories = [...categories, newCategory];
      setCategories(newCategories);
      notifyChanges(newCategories);
    }
    closeCategoryDialog();
  };

  const handleDeleteCategory = (category: DisplayJobCategory) => {
    if (category.isNew) {
      // 新規追加項目は配列から削除
      const newCategories = categories.filter((c) => c.id !== category.id);
      setCategories(newCategories);
      notifyChanges(newCategories);
    } else {
      // 既存項目は削除フラグを立てる（紐づく職種も削除扱い）
      const newCategories = categories.map((c) => {
        if (c.id === category.id) {
          return {
            ...c,
            isDeleted: true,
            jobTypes: c.jobTypes.map((jt) => ({ ...jt, isDeleted: true })),
          };
        }
        return c;
      });
      setCategories(newCategories);
      notifyChanges(newCategories);
    }
  };

  const handleUndoDeleteCategory = (category: DisplayJobCategory) => {
    const originalCategory = initialCategoriesRef.current.find((c) => c.id === category.id);
    const newCategories = categories.map((c) => {
      if (c.id === category.id) {
        if (originalCategory) {
          return {
            ...originalCategory,
            isNew: false,
            isUpdated: false,
            isDeleted: false,
            jobTypes: originalCategory.jobTypes.map((jt) => ({
              ...jt,
              isNew: false,
              isUpdated: false,
              isDeleted: false,
            })),
          };
        }
        return {
          ...c,
          isDeleted: false,
          jobTypes: c.jobTypes.map((jt) => ({ ...jt, isDeleted: false })),
        };
      }
      return c;
    });
    setCategories(newCategories);
    notifyChanges(newCategories);
  };

  // === 職種（JobType）の操作 ===
  const openJobTypeDialog = (categoryId?: string, jobType?: DisplayJobType) => {
    if (jobType) {
      setEditingJobType(jobType);
      setSelectedCategoryId(jobType.jobCategoryId);
      jobTypeForm.reset({ name: jobType.name, jobCategoryId: jobType.jobCategoryId });
    } else {
      setEditingJobType(null);
      setSelectedCategoryId(categoryId || '');
      jobTypeForm.reset({ name: '', jobCategoryId: categoryId || '' });
    }
    setIsJobTypeDialogOpen(true);
  };

  const closeJobTypeDialog = () => {
    setIsJobTypeDialogOpen(false);
    setEditingJobType(null);
    setSelectedCategoryId('');
    jobTypeForm.reset();
  };

  const onJobTypeSubmit = (data: JobTypeFormData) => {
    if (editingJobType) {
      // 編集
      const newCategories = categories.map((c) => ({
        ...c,
        jobTypes: c.jobTypes.map((jt) => {
          if (jt.id === editingJobType.id) {
            return {
              ...jt,
              name: data.name,
              isUpdated: !jt.isNew ? true : jt.isUpdated,
            };
          }
          return jt;
        }),
      }));
      setCategories(newCategories);
      notifyChanges(newCategories);
    } else {
      // 新規追加
      const newJobType: DisplayJobType = {
        id: generateTempId(),
        name: data.name,
        jobCategoryId: data.jobCategoryId,
        isNew: true,
        isUpdated: false,
        isDeleted: false,
      };
      const newCategories = categories.map((c) => {
        if (c.id === data.jobCategoryId) {
          return {
            ...c,
            jobTypes: [...c.jobTypes, newJobType],
          };
        }
        return c;
      });
      setCategories(newCategories);
      notifyChanges(newCategories);
    }
    closeJobTypeDialog();
  };

  const handleDeleteJobType = (categoryId: string, jobType: DisplayJobType) => {
    if (jobType.isNew) {
      // 新規追加項目は配列から削除
      const newCategories = categories.map((c) => {
        if (c.id === categoryId) {
          return {
            ...c,
            jobTypes: c.jobTypes.filter((jt) => jt.id !== jobType.id),
          };
        }
        return c;
      });
      setCategories(newCategories);
      notifyChanges(newCategories);
    } else {
      // 既存項目は削除フラグを立てる
      const newCategories = categories.map((c) => {
        if (c.id === categoryId) {
          return {
            ...c,
            jobTypes: c.jobTypes.map((jt) => {
              if (jt.id === jobType.id) {
                return { ...jt, isDeleted: true };
              }
              return jt;
            }),
          };
        }
        return c;
      });
      setCategories(newCategories);
      notifyChanges(newCategories);
    }
  };

  const handleUndoDeleteJobType = (categoryId: string, jobType: DisplayJobType) => {
    const originalCategory = initialCategoriesRef.current.find((c) => c.id === categoryId);
    const originalJobType = originalCategory?.jobTypes.find((jt) => jt.id === jobType.id);

    const newCategories = categories.map((c) => {
      if (c.id === categoryId) {
        return {
          ...c,
          jobTypes: c.jobTypes.map((jt) => {
            if (jt.id === jobType.id) {
              if (originalJobType) {
                return {
                  ...originalJobType,
                  isNew: false,
                  isUpdated: false,
                  isDeleted: false,
                };
              }
              return { ...jt, isDeleted: false };
            }
            return jt;
          }),
        };
      }
      return c;
    });
    setCategories(newCategories);
    notifyChanges(newCategories);
  };

  // 利用可能なカテゴリ（削除されていないもの）
  const availableCategories = categories.filter((c) => !c.isDeleted);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{COMPANY_LABELS.JOB_TYPES}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openCategoryDialog()}>
            {COMPANY_LABELS.ADD_JOB_CATEGORY}
          </Button>
          <Button
            onClick={() => openJobTypeDialog()}
            disabled={availableCategories.length === 0}
          >
            {COMPANY_LABELS.ADD_JOB_TYPE}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            {COMPANY_LABELS.NO_DATA}
          </p>
        ) : (
          <div className="space-y-6">
            {categories.map((category) => (
              <div
                key={category.id}
                className={cn(
                  'border rounded-lg p-4 transition-colors',
                  category.isNew && 'bg-green-50 dark:bg-green-950/20 border-green-200',
                  category.isUpdated &&
                    !category.isNew &&
                    'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200',
                  category.isDeleted &&
                    'bg-red-50 dark:bg-red-950/20 border-red-200 opacity-60'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4
                    className={cn(
                      'font-semibold text-lg',
                      category.isDeleted && 'line-through text-muted-foreground'
                    )}
                  >
                    {category.name}
                  </h4>
                  <div className="flex gap-2">
                    {category.isDeleted ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUndoDeleteCategory(category)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        取り消し
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCategoryDialog(category)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openJobTypeDialog(category.id)}
                        >
                          {COMPANY_LABELS.ADD_JOB_TYPE}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCategory(category)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {category.jobTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">職種がありません</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {category.jobTypes.map((jobType) => (
                      <span
                        key={jobType.id}
                        className={cn(
                          'inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm transition-colors',
                          jobType.isNew && 'bg-green-100 text-green-800',
                          jobType.isUpdated &&
                            !jobType.isNew &&
                            'bg-yellow-100 text-yellow-800',
                          jobType.isDeleted &&
                            'bg-red-100 text-red-800 line-through opacity-60',
                          !jobType.isNew &&
                            !jobType.isUpdated &&
                            !jobType.isDeleted &&
                            'bg-secondary text-secondary-foreground'
                        )}
                      >
                        {jobType.name}
                        {!category.isDeleted && (
                          <>
                            {jobType.isDeleted ? (
                              <button
                                onClick={() => handleUndoDeleteJobType(category.id, jobType)}
                                className="ml-1 hover:text-foreground"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => openJobTypeDialog(category.id, jobType)}
                                  className="ml-1 hover:text-foreground"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteJobType(category.id, jobType)}
                                  className="hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 職種大分類追加/編集ダイアログ */}
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory
                  ? `${COMPANY_LABELS.JOB_CATEGORY}を編集`
                  : COMPANY_LABELS.ADD_JOB_CATEGORY}
              </DialogTitle>
            </DialogHeader>

            <Form {...categoryForm}>
              <form
                onSubmit={categoryForm.handleSubmit(onCategorySubmit)}
                className="space-y-4"
              >
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
                  <Button type="submit">確定</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* 職種小分類追加/編集ダイアログ */}
        <Dialog open={isJobTypeDialogOpen} onOpenChange={setIsJobTypeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingJobType
                  ? `${COMPANY_LABELS.JOB_TYPE_DETAIL}を編集`
                  : COMPANY_LABELS.ADD_JOB_TYPE}
              </DialogTitle>
            </DialogHeader>

            <Form {...jobTypeForm}>
              <form
                onSubmit={jobTypeForm.handleSubmit(onJobTypeSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={jobTypeForm.control}
                  name="jobCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {COMPANY_LABELS.JOB_CATEGORY}
                        <span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!!editingJobType}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="部署を選択" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableCategories.map((category) => (
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
                  <Button type="submit">確定</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
