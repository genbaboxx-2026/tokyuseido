"use client"

import { useState, useEffect } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
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
import { Calculator } from "lucide-react"
import {
  salaryTableFormSchema,
  type SalaryTableFormData,
  SALARY_TABLE_UI_TEXT,
  SALARY_TABLE_DEFAULTS,
  SALARY_TABLE_LIMITS,
  RANK_LETTER_OPTIONS,
  ROUNDING_METHOD_OPTIONS,
  ROUNDING_UNIT_OPTIONS,
  ROUNDING_DEFAULTS,
} from "@/lib/salary-table"
import {
  calculateBaseSalaryMax,
} from "@/lib/salary-table/generator"

interface Grade {
  id: string
  name: string
  level: number
}

interface SalaryTableFormProps {
  companyId: string
  defaultValues?: Partial<SalaryTableFormData>
  grades?: Grade[]
  onSubmit: (data: SalaryTableFormData) => void
  onPreview?: (data: SalaryTableFormData) => void
  isLoading?: boolean
  isEditMode?: boolean
}

export function SalaryTableForm({
  companyId,
  defaultValues,
  grades = [],
  onSubmit,
  onPreview,
  isLoading = false,
  isEditMode = false,
}: SalaryTableFormProps) {
  const [calculatedMax, setCalculatedMax] = useState<number>(0)

  const form = useForm({
    resolver: zodResolver(salaryTableFormSchema),
    defaultValues: {
      companyId,
      name: defaultValues?.name || "",
      baseSalaryMax: defaultValues?.baseSalaryMax || SALARY_TABLE_DEFAULTS.baseSalaryMax,
      baseSalaryMin: defaultValues?.baseSalaryMin || SALARY_TABLE_DEFAULTS.baseSalaryMin,
      initialStepDiff: defaultValues?.initialStepDiff || SALARY_TABLE_DEFAULTS.initialStepDiff,
      bandIncreaseRate: defaultValues?.bandIncreaseRate || SALARY_TABLE_DEFAULTS.bandIncreaseRate,
      stepsPerBand: defaultValues?.stepsPerBand || SALARY_TABLE_DEFAULTS.stepsPerBand,
      salaryBandCount: defaultValues?.salaryBandCount || SALARY_TABLE_DEFAULTS.salaryBandCount,
      isActive: defaultValues?.isActive ?? true,
      rankStartLetter: defaultValues?.rankStartLetter || "S",
      rankEndLetter: defaultValues?.rankEndLetter || "D",
      gradeOverrides: defaultValues?.gradeOverrides || [],
      roundingMethod: defaultValues?.roundingMethod || ROUNDING_DEFAULTS.method,
      roundingUnit: defaultValues?.roundingUnit || ROUNDING_DEFAULTS.unit,
    },
  })

  // パラメータが変更されるたびに計算結果MAXを再計算
  const watchedValues = form.watch([
    "baseSalaryMin",
    "initialStepDiff",
    "bandIncreaseRate",
    "stepsPerBand",
    "salaryBandCount",
    "rankStartLetter",
    "rankEndLetter",
    "roundingMethod",
    "roundingUnit",
  ])

  useEffect(() => {
    const values = form.getValues()
    try {
      const max = calculateBaseSalaryMax({
        baseSalaryMin: values.baseSalaryMin || SALARY_TABLE_DEFAULTS.baseSalaryMin,
        initialStepDiff: values.initialStepDiff || SALARY_TABLE_DEFAULTS.initialStepDiff,
        bandIncreaseRate: values.bandIncreaseRate || SALARY_TABLE_DEFAULTS.bandIncreaseRate,
        stepsPerBand: values.stepsPerBand || SALARY_TABLE_DEFAULTS.stepsPerBand,
        salaryBandCount: values.salaryBandCount || SALARY_TABLE_DEFAULTS.salaryBandCount,
        rankStartLetter: values.rankStartLetter as "S" | "A" | "B" | "C" | "D" | "E" | "F",
        rankEndLetter: values.rankEndLetter as "S" | "A" | "B" | "C" | "D" | "E" | "F",
        roundingMethod: values.roundingMethod as "none" | "ceil" | "floor" | "round",
        roundingUnit: values.roundingUnit as 1 | 10 | 100 | 1000 | 10000,
      })
      setCalculatedMax(max)
      // フォームの隠しフィールドも更新
      form.setValue("baseSalaryMax", max)
    } catch {
      setCalculatedMax(0)
    }
  }, [watchedValues, form])

  const handleSubmit: SubmitHandler<SalaryTableFormData> = (data) => {
    // 計算結果MAXを含めて送信
    onSubmit({
      ...data,
      baseSalaryMax: calculatedMax,
    })
  }

  const handlePreview = () => {
    const values = form.getValues()
    const result = salaryTableFormSchema.safeParse({
      ...values,
      baseSalaryMax: calculatedMax,
    })
    if (result.success && onPreview) {
      onPreview(result.data)
    } else {
      form.trigger()
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ja-JP").format(value)
  }

  // 総号俸数を計算
  const totalSteps = (form.watch("salaryBandCount") || SALARY_TABLE_DEFAULTS.salaryBandCount) *
                     (form.watch("stepsPerBand") || SALARY_TABLE_DEFAULTS.stepsPerBand)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{SALARY_TABLE_UI_TEXT.PAGE_TITLE}</CardTitle>
        <CardDescription>
          {isEditMode
            ? "号俸テーブルのパラメータを編集します"
            : "パラメータを入力すると、号俸テーブルが自動生成されます"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* テーブル名 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{SALARY_TABLE_UI_TEXT.TABLE_NAME}</FormLabel>
                  <FormControl>
                    <Input placeholder="例：2024年度号俸テーブル" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 基本給（MIN） */}
              <FormField
                control={form.control}
                name="baseSalaryMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{SALARY_TABLE_UI_TEXT.BASE_SALARY_MIN}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatCurrency(field.value || 0)}
                          onChange={(e) => {
                            const rawValue = e.target.value.replace(/,/g, "")
                            const numValue = Number(rawValue)
                            if (!isNaN(numValue)) {
                              field.onChange(numValue)
                            }
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {SALARY_TABLE_UI_TEXT.YEN}
                        </span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      {SALARY_TABLE_UI_TEXT.BASE_SALARY_MIN_DESC}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 初期号差 */}
              <FormField
                control={form.control}
                name="initialStepDiff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{SALARY_TABLE_UI_TEXT.INITIAL_STEP_DIFF}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatCurrency(field.value || 0)}
                          onChange={(e) => {
                            const rawValue = e.target.value.replace(/,/g, "")
                            const numValue = Number(rawValue)
                            if (!isNaN(numValue)) {
                              field.onChange(numValue)
                            }
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {SALARY_TABLE_UI_TEXT.YEN}
                        </span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      {SALARY_TABLE_UI_TEXT.INITIAL_STEP_DIFF_DESC}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 号俸帯間増加率 */}
              <FormField
                control={form.control}
                name="bandIncreaseRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{SALARY_TABLE_UI_TEXT.BAND_INCREASE_RATE}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={SALARY_TABLE_LIMITS.bandIncreaseRate.min}
                        max={SALARY_TABLE_LIMITS.bandIncreaseRate.max}
                        step={0.01}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      {SALARY_TABLE_UI_TEXT.BAND_INCREASE_RATE_DESC}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 号俸帯内ステップ数 */}
              <FormField
                control={form.control}
                name="stepsPerBand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{SALARY_TABLE_UI_TEXT.STEPS_PER_BAND}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={SALARY_TABLE_LIMITS.stepsPerBand.min}
                        max={SALARY_TABLE_LIMITS.stepsPerBand.max}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      {SALARY_TABLE_UI_TEXT.STEPS_PER_BAND_DESC}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 号俸帯数 */}
              <FormField
                control={form.control}
                name="salaryBandCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{SALARY_TABLE_UI_TEXT.SALARY_BAND_COUNT}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={SALARY_TABLE_LIMITS.salaryBandCount.min}
                        max={SALARY_TABLE_LIMITS.salaryBandCount.max}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      {SALARY_TABLE_UI_TEXT.SALARY_BAND_COUNT_DESC}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 基本給（MAX）- 計算結果表示のみ */}
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  {SALARY_TABLE_UI_TEXT.BASE_SALARY_MAX}
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    自動計算
                  </span>
                </FormLabel>
                <div className="relative">
                  <Input
                    type="text"
                    value={formatCurrency(calculatedMax)}
                    readOnly
                    className="bg-muted text-foreground cursor-not-allowed font-medium"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {SALARY_TABLE_UI_TEXT.YEN}
                  </span>
                </div>
                <FormDescription>
                  パラメータから自動算出された最上位号俸の基本給
                </FormDescription>
              </FormItem>
            </div>

            {/* ランク範囲設定 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="rankStartLetter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{SALARY_TABLE_UI_TEXT.RANK_START_LETTER}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="開始ランクを選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RANK_LETTER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      ランクの開始文字（最上位、デフォルト: S）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rankEndLetter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{SALARY_TABLE_UI_TEXT.RANK_END_LETTER}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="終了ランクを選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RANK_LETTER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      ランクの終了文字（最下位、デフォルト: D）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 丸め処理設定 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="roundingMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{SALARY_TABLE_UI_TEXT.ROUNDING_METHOD}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="丸め方法を選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROUNDING_METHOD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {SALARY_TABLE_UI_TEXT.ROUNDING_METHOD_DESC}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roundingUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{SALARY_TABLE_UI_TEXT.ROUNDING_UNIT}</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="丸め単位を選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROUNDING_UNIT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {SALARY_TABLE_UI_TEXT.ROUNDING_UNIT_DESC}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 総号俸数の表示 */}
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <Calculator className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {SALARY_TABLE_UI_TEXT.TOTAL_STEPS}: {totalSteps}号俸
                </p>
                <p className="text-xs text-muted-foreground">
                  号俸帯数 ({form.watch("salaryBandCount")}) × 号俸帯内ステップ数 ({form.watch("stepsPerBand")}) = {totalSteps}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  基本給レンジ: {formatCurrency(form.watch("baseSalaryMin"))} 〜 {formatCurrency(calculatedMax)}円
                </p>
                <p className="text-xs text-muted-foreground">
                  MIN（入力）〜 MAX（自動計算）
                </p>
              </div>
            </div>

            <div className="flex gap-4 justify-end">
              {onPreview && (
                <Button type="button" variant="outline" onClick={handlePreview} disabled={isLoading}>
                  {SALARY_TABLE_UI_TEXT.PREVIEW}
                </Button>
              )}
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? SALARY_TABLE_UI_TEXT.LOADING
                  : isEditMode
                  ? SALARY_TABLE_UI_TEXT.SAVE
                  : SALARY_TABLE_UI_TEXT.GENERATE}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
