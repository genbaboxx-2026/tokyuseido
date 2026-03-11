"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef } from "react"
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

interface SalaryTableInputPanelProps {
  companyId: string
  defaultValues?: Partial<SalaryTableFormData> & { id?: string }
  calculatedMax: number
  onValuesChange: (values: Partial<SalaryTableFormData>) => void
  onSubmit: (data: SalaryTableFormData) => void
  isLoading?: boolean
  isEditMode?: boolean
}

export function SalaryTableInputPanel({
  companyId,
  defaultValues,
  calculatedMax,
  onValuesChange,
  onSubmit,
  isLoading = false,
  isEditMode = false,
}: SalaryTableInputPanelProps) {
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

  // defaultValuesが変更されたらフォームをリセット（DBから取得したデータを反映）
  const prevDefaultValuesIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const currentId = defaultValues?.id
    if (currentId && currentId !== prevDefaultValuesIdRef.current) {
      prevDefaultValuesIdRef.current = currentId
      form.reset({
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
      })
    }
  }, [defaultValues, companyId, form])

  // Use subscription-based watch to avoid infinite loops
  const onValuesChangeRef = useRef(onValuesChange)
  onValuesChangeRef.current = onValuesChange

  // Subscribe to form value changes
  useEffect(() => {
    // Initial notification with current values
    const currentValues = form.getValues()
    onValuesChangeRef.current(currentValues as Partial<SalaryTableFormData>)

    // Subscribe to changes
    const subscription = form.watch((values) => {
      onValuesChangeRef.current(values as Partial<SalaryTableFormData>)
    })

    return () => subscription.unsubscribe()
  }, [form])

  const handleSubmit = (data: SalaryTableFormData) => {
    onSubmit({
      ...data,
      baseSalaryMax: calculatedMax,
    })
  }

  return (
    <div className="h-fit">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
            {/* 1. 基本給（MIN） */}
            <FormField
              control={form.control}
              name="baseSalaryMin"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline gap-2">
                    <FormLabel className="text-sm">{SALARY_TABLE_UI_TEXT.BASE_SALARY_MIN}</FormLabel>
                    <span className="text-xs text-muted-foreground">最下位号俸（号俸1）の基本給</span>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="h-9 pr-8"
                        value={new Intl.NumberFormat("ja-JP").format(field.value || 0)}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/,/g, "")
                          const numValue = Number(rawValue)
                          if (!isNaN(numValue)) {
                            field.onChange(numValue)
                          }
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        円
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 2. 号俸帯数 */}
            <FormField
              control={form.control}
              name="salaryBandCount"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline gap-2">
                    <FormLabel className="text-sm">{SALARY_TABLE_UI_TEXT.SALARY_BAND_COUNT}</FormLabel>
                    <span className="text-xs text-muted-foreground">全体の号俸帯数（例: 15）</span>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min={SALARY_TABLE_LIMITS.salaryBandCount.min}
                      max={SALARY_TABLE_LIMITS.salaryBandCount.max}
                      className="h-9"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 3. 号俸帯内ステップ数 */}
            <FormField
              control={form.control}
              name="stepsPerBand"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline gap-2">
                    <FormLabel className="text-sm">{SALARY_TABLE_UI_TEXT.STEPS_PER_BAND}</FormLabel>
                    <span className="text-xs text-muted-foreground">各号俸帯内の段階数（例: 8）</span>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min={SALARY_TABLE_LIMITS.stepsPerBand.min}
                      max={SALARY_TABLE_LIMITS.stepsPerBand.max}
                      className="h-9"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 4. ランク範囲設定 */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="rankStartLetter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">開始ランク</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue />
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rankEndLetter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">終了ランク</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue />
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 5. 初期号差 */}
            <FormField
              control={form.control}
              name="initialStepDiff"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline gap-2">
                    <FormLabel className="text-sm">{SALARY_TABLE_UI_TEXT.INITIAL_STEP_DIFF}</FormLabel>
                    <span className="text-xs text-muted-foreground">最下位号俸帯の号差（号俸間の昇給額）</span>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="h-9 pr-8"
                        value={new Intl.NumberFormat("ja-JP").format(field.value || 0)}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/,/g, "")
                          const numValue = Number(rawValue)
                          if (!isNaN(numValue)) {
                            field.onChange(numValue)
                          }
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        円
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 6. 号俸帯間増加率 */}
            <FormField
              control={form.control}
              name="bandIncreaseRate"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline gap-2">
                    <FormLabel className="text-sm">{SALARY_TABLE_UI_TEXT.BAND_INCREASE_RATE}</FormLabel>
                    <span className="text-xs text-muted-foreground">号俸帯が上がるごとに号差を何倍にするか</span>
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min={SALARY_TABLE_LIMITS.bandIncreaseRate.min}
                      max={SALARY_TABLE_LIMITS.bandIncreaseRate.max}
                      step={0.01}
                      className="h-9"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 7. 丸め処理設定 */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="roundingMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">{SALARY_TABLE_UI_TEXT.ROUNDING_METHOD}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue />
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roundingUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">{SALARY_TABLE_UI_TEXT.ROUNDING_UNIT}</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue />
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 8. 基本給（MAX）- 自動計算表示 */}
            <div className="space-y-2 pt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{SALARY_TABLE_UI_TEXT.BASE_SALARY_MAX}</span>
                <span className="text-xs text-muted-foreground">号俸列の最上位（自動算出）</span>
              </div>
              <div className="relative">
                <Input
                  type="text"
                  value={new Intl.NumberFormat("ja-JP").format(calculatedMax)}
                  readOnly
                  className="h-9 pr-8 bg-muted text-foreground cursor-not-allowed font-medium"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  円
                </span>
              </div>
            </div>

            <Button type="submit" className="w-full mt-4" disabled={isLoading}>
              {isLoading
                ? SALARY_TABLE_UI_TEXT.LOADING
                : isEditMode
                ? SALARY_TABLE_UI_TEXT.SAVE
                : SALARY_TABLE_UI_TEXT.GENERATE}
            </Button>
          </form>
        </Form>
    </div>
  )
}
