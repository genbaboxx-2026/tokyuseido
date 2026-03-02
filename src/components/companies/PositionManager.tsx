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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { positionSchema, PositionFormData } from '@/lib/company/validation';
import { COMPANY_LABELS } from '@/lib/company/constants';

interface Position {
  id: string;
  name: string;
  level: number;
}

interface PositionManagerProps {
  companyId: string;
  positions: Position[];
}

export function PositionManager({ companyId, positions }: PositionManagerProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PositionFormData>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      name: '',
    },
  });

  const openCreateDialog = () => {
    setEditingPosition(null);
    form.reset({ name: '' });
    setError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (position: Position) => {
    setEditingPosition(position);
    form.reset({
      name: position.name,
    });
    setError(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingPosition(null);
    form.reset();
    setError(null);
  };

  const onSubmit = async (data: PositionFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = editingPosition
        ? `/api/companies/${companyId}/positions/${editingPosition.id}`
        : `/api/companies/${companyId}/positions`;
      const method = editingPosition ? 'PUT' : 'POST';

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

  const handleDelete = async (positionId: string) => {
    if (!confirm(COMPANY_LABELS.CONFIRM_DELETE)) return;

    try {
      const response = await fetch(
        `/api/companies/${companyId}/positions/${positionId}`,
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{COMPANY_LABELS.POSITIONS}</CardTitle>
        <Button onClick={openCreateDialog}>{COMPANY_LABELS.ADD_POSITION}</Button>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            {COMPANY_LABELS.NO_DATA}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{COMPANY_LABELS.POSITION}</TableHead>
                <TableHead className="w-[120px]">{COMPANY_LABELS.ACTIONS}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <TableRow key={position.id}>
                  <TableCell>{position.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(position)}
                      >
                        {COMPANY_LABELS.EDIT}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(position.id)}
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
                {editingPosition
                  ? `${COMPANY_LABELS.POSITION}${COMPANY_LABELS.EDIT}`
                  : COMPANY_LABELS.ADD_POSITION}
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
                        {COMPANY_LABELS.POSITION}
                        <span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="部長" />
                      </FormControl>
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
