'use client';

import { useState, useCallback, useRef } from 'react';
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
import type { PositionChanges } from '@/types/company-settings';
import { generateTempId } from '@/types/company-settings';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Position {
  id: string;
  name: string;
  level: number;
}

interface DisplayPosition extends Position {
  isNew: boolean;
  isUpdated: boolean;
  isDeleted: boolean;
}

interface PositionManagerEditableProps {
  companyId: string;
  initialPositions: Position[];
  onChange: (data: PositionChanges | null) => void;
}

/**
 * 役職管理（編集可能、ペンディング状態管理）
 */
export function PositionManagerEditable({
  initialPositions,
  onChange,
}: PositionManagerEditableProps) {
  // 初期データを保存
  const initialPositionsRef = useRef<Position[]>(initialPositions);

  const [positions, setPositions] = useState<DisplayPosition[]>(
    initialPositions.map((p) => ({
      ...p,
      isNew: false,
      isUpdated: false,
      isDeleted: false,
    }))
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<DisplayPosition | null>(null);

  const form = useForm<PositionFormData>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      name: '',
    },
  });

  // 変更を検出して親に通知
  const notifyChanges = useCallback(
    (positionList: DisplayPosition[]) => {
      const added = positionList
        .filter((p) => p.isNew && !p.isDeleted)
        .map((p) => ({
          tempId: p.id,
          name: p.name,
          level: p.level,
        }));

      const updated = positionList
        .filter((p) => !p.isNew && p.isUpdated && !p.isDeleted)
        .map((p) => ({
          id: p.id,
          name: p.name,
          level: p.level,
        }));

      const deleted = positionList
        .filter((p) => !p.isNew && p.isDeleted)
        .map((p) => p.id);

      const hasChanges =
        added.length > 0 || updated.length > 0 || deleted.length > 0;

      if (hasChanges) {
        onChange({ added, updated, deleted });
      } else {
        onChange(null);
      }
    },
    [onChange]
  );

  const openCreateDialog = () => {
    setEditingPosition(null);
    form.reset({ name: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (position: DisplayPosition) => {
    setEditingPosition(position);
    form.reset({ name: position.name });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingPosition(null);
    form.reset();
  };

  const onSubmit = (data: PositionFormData) => {
    if (editingPosition) {
      // 編集
      const newPositions = positions.map((p) => {
        if (p.id === editingPosition.id) {
          return {
            ...p,
            name: data.name,
            isUpdated: !p.isNew ? true : p.isUpdated,
          };
        }
        return p;
      });
      setPositions(newPositions);
      notifyChanges(newPositions);
    } else {
      // 新規追加
      const maxLevel = positions.reduce(
        (max, p) => (p.isDeleted ? max : Math.max(max, p.level)),
        0
      );
      const newPosition: DisplayPosition = {
        id: generateTempId(),
        name: data.name,
        level: maxLevel + 1,
        isNew: true,
        isUpdated: false,
        isDeleted: false,
      };
      const newPositions = [...positions, newPosition];
      setPositions(newPositions);
      notifyChanges(newPositions);
    }
    closeDialog();
  };

  const handleDelete = (position: DisplayPosition) => {
    if (position.isNew) {
      // 新規追加項目は配列から削除
      const newPositions = positions.filter((p) => p.id !== position.id);
      setPositions(newPositions);
      notifyChanges(newPositions);
    } else {
      // 既存項目は削除フラグを立てる
      const newPositions = positions.map((p) => {
        if (p.id === position.id) {
          return { ...p, isDeleted: true };
        }
        return p;
      });
      setPositions(newPositions);
      notifyChanges(newPositions);
    }
  };

  const handleUndoDelete = (position: DisplayPosition) => {
    // 元の状態に戻す
    const originalPosition = initialPositionsRef.current.find(
      (p) => p.id === position.id
    );
    const newPositions = positions.map((p) => {
      if (p.id === position.id) {
        if (originalPosition) {
          return {
            ...originalPosition,
            isNew: false,
            isUpdated: false,
            isDeleted: false,
          };
        }
        return { ...p, isDeleted: false };
      }
      return p;
    });
    setPositions(newPositions);
    notifyChanges(newPositions);
  };

  // 表示用（レベル降順でソート、削除済みも含める）
  const displayPositions = [...positions].sort((a, b) => b.level - a.level);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{COMPANY_LABELS.POSITIONS}</CardTitle>
        <Button onClick={openCreateDialog}>{COMPANY_LABELS.ADD_POSITION}</Button>
      </CardHeader>
      <CardContent>
        {displayPositions.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            {COMPANY_LABELS.NO_DATA}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{COMPANY_LABELS.POSITION}</TableHead>
                <TableHead className="w-[150px]">{COMPANY_LABELS.ACTIONS}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayPositions.map((position) => (
                <TableRow
                  key={position.id}
                  className={cn(
                    'transition-colors',
                    position.isNew && 'bg-green-50 dark:bg-green-950/20',
                    position.isUpdated &&
                      !position.isNew &&
                      'bg-yellow-50 dark:bg-yellow-950/20',
                    position.isDeleted && 'bg-red-50 dark:bg-red-950/20 opacity-60'
                  )}
                >
                  <TableCell
                    className={cn(position.isDeleted && 'line-through text-muted-foreground')}
                  >
                    {position.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {position.isDeleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUndoDelete(position)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          取り消し
                        </Button>
                      ) : (
                        <>
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
                            onClick={() => handleDelete(position)}
                          >
                            {COMPANY_LABELS.DELETE}
                          </Button>
                        </>
                      )}
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
