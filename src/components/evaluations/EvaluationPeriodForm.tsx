"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EVALUATION_UI_TEXT,
  PERIOD_TYPE_OPTIONS,
  EVALUATION_STATUS_OPTIONS,
} from "@/lib/evaluation/constants"

const formSchema = z.object({
  name: z.string().min(1, "評価期間名は必須です").max(100),
  periodType: z.enum(["FIRST_HALF", "SECOND_HALF"]),
  startDate: z.string().min(1, "開始日は必須です"),
  endDate: z.string().min(1, "終了日は必須です"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FEEDBACK_DONE"]).optional(),
})

type FormValues = z.infer<typeof formSchema>

interface EvaluationPeriodFormProps {
  companyId: string
  initialData?: {
    id?: string
    name: string
    periodType: "FIRST_HALF" | "SECOND_HALF"
    startDate: string
    endDate: string
    status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FEEDBACK_DONE"
  }
  onSubmit: (data: FormValues) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

export function EvaluationPeriodForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: EvaluationPeriodFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      periodType: initialData?.periodType ?? "FIRST_HALF",
      startDate: initialData?.startDate ?? "",
      endDate: initialData?.endDate ?? "",
      status: initialData?.status ?? "NOT_STARTED",
    },
  })

  const handleSubmit = async (data: FormValues) => {
    await onSubmit(data)
  }

  const isEditing = !!initialData?.id

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{EVALUATION_UI_TEXT.PERIOD_NAME}</FormLabel>
              <FormControl>
                <Input placeholder="2024年度上期" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="periodType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{EVALUATION_UI_TEXT.PERIOD_TYPE}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={EVALUATION_UI_TEXT.SELECT_PLACEHOLDER} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PERIOD_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{EVALUATION_UI_TEXT.START_DATE}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{EVALUATION_UI_TEXT.END_DATE}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isEditing && (
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{EVALUATION_UI_TEXT.STATUS}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={EVALUATION_UI_TEXT.SELECT_PLACEHOLDER} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EVALUATION_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              {EVALUATION_UI_TEXT.CANCEL}
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? EVALUATION_UI_TEXT.LOADING : EVALUATION_UI_TEXT.SAVE}
          </Button>
        </div>
      </form>
    </Form>
  )
}
