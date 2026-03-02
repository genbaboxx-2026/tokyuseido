"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { gradeFormSchema, type GradeFormValues } from "@/lib/grade/schemas"
import { GRADE_UI_TEXT, EMPLOYMENT_TYPE_OPTIONS } from "@/lib/grade/constants"

interface GradeFormProps {
  companyId: string
  initialData?: {
    id: string
    name: string
    level: number
    employmentType: "FULL_TIME" | "CONTRACT" | "OUTSOURCE" | "PART_TIME"
    isManagement: boolean
  }
  onSuccess?: () => void
  redirectPath?: string
}

export function GradeForm({ companyId, initialData, onSuccess, redirectPath = "/grades" }: GradeFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!initialData

  const form = useForm({
    resolver: zodResolver(gradeFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      level: initialData?.level || 1,
      employmentType: initialData?.employmentType || "FULL_TIME",
      isManagement: initialData?.isManagement || false,
      companyId,
    } as GradeFormValues,
  })

  const onSubmit = async (values: Record<string, unknown>) => {
    const gradeValues = values as GradeFormValues
    setIsLoading(true)
    setError(null)

    try {
      const url = isEditing
        ? `/api/grades/${initialData.id}`
        : "/api/grades"
      const method = isEditing ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gradeValues),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || GRADE_UI_TEXT.ERROR_OCCURRED)
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(redirectPath)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : GRADE_UI_TEXT.ERROR_OCCURRED)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? `${initialData.name}を編集` : GRADE_UI_TEXT.CREATE_GRADE}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{GRADE_UI_TEXT.GRADE_NAME}</FormLabel>
                  <FormControl>
                    <Input placeholder="例: 正1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{GRADE_UI_TEXT.LEVEL}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="employmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{GRADE_UI_TEXT.EMPLOYMENT_TYPE}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="雇用形態を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
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

            <FormField
              control={form.control}
              name="isManagement"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">{GRADE_UI_TEXT.IS_MANAGEMENT}</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(redirectPath)}
                disabled={isLoading}
              >
                {GRADE_UI_TEXT.CANCEL}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? GRADE_UI_TEXT.LOADING : GRADE_UI_TEXT.SAVE}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
