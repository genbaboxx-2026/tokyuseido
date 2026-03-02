'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { departmentSchema, DepartmentFormData } from '@/lib/company/validation';
import { COMPANY_LABELS } from '@/lib/company/constants';

interface Department {
  id: string;
  name: string;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
}

interface DepartmentManagerProps {
  companyId: string;
  departments: Department[];
}

export function DepartmentManager({ companyId, departments }: DepartmentManagerProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: '',
      parentId: null,
    },
  });

  const openCreateDialog = () => {
    setEditingDepartment(null);
    form.reset({ name: '', parentId: null });
    setError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department);
    form.reset({
      name: department.name,
      parentId: department.parentId,
    });
    setError(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingDepartment(null);
    form.reset();
    setError(null);
  };

  const onSubmit = async (data: DepartmentFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = editingDepartment
        ? `/api/companies/${companyId}/departments/${editingDepartment.id}`
        : `/api/companies/${companyId}/departments`;
      const method = editingDepartment ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || COMPANY_LABELS.ERROR_OCCURRED);
      }

      closeDialog();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : COMPANY_LABELS.ERROR_OCCURRED);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (departmentId: string) => {
    if (!confirm(COMPANY_LABELS.CONFIRM_DELETE)) return;

    try {
      const response = await fetch(
        `/api/companies/${companyId}/departments/${departmentId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || COMPANY_LABELS.ERROR_OCCURRED);
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : COMPANY_LABELS.ERROR_OCCURRED);
    }
  };

  // 自分自身と子孫を除いた部署リスト（親部署選択用）
  const getAvailableParents = (excludeId?: string) => {
    if (!excludeId) return departments;
    return departments.filter((d) => d.id !== excludeId);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{COMPANY_LABELS.DEPARTMENTS}</CardTitle>
        <Button onClick={openCreateDialog}>{COMPANY_LABELS.ADD_DEPARTMENT}</Button>
      </CardHeader>
      <CardContent>
        {departments.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            {COMPANY_LABELS.NO_DATA}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{COMPANY_LABELS.DEPARTMENT}</TableHead>
                <TableHead>{COMPANY_LABELS.PARENT_DEPARTMENT}</TableHead>
                <TableHead className="w-[120px]">{COMPANY_LABELS.ACTIONS}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((department) => (
                <TableRow key={department.id}>
                  <TableCell>{department.name}</TableCell>
                  <TableCell>{department.parent?.name || COMPANY_LABELS.NONE}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(department)}
                      >
                        {COMPANY_LABELS.EDIT}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(department.id)}
                      >
                        {COMPANY_LABELS.DELETE}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDepartment
                  ? `${COMPANY_LABELS.DEPARTMENT}${COMPANY_LABELS.EDIT}`
                  : COMPANY_LABELS.ADD_DEPARTMENT}
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        {COMPANY_LABELS.DEPARTMENT}
                        <span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="営業部" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{COMPANY_LABELS.PARENT_DEPARTMENT}</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === 'none' ? null : value)
                        }
                        value={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="親部署を選択" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{COMPANY_LABELS.NONE}</SelectItem>
                          {getAvailableParents(editingDepartment?.id).map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog}>
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
