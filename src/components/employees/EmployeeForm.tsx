"use client";

import { useRouter } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmploymentTypeLabels,
  GenderLabels,
  EmployeeStatusLabels,
} from "@/types/employee";

// バリデーションスキーマ
const employeeFormSchema = z.object({
  employeeCode: z.string().min(1, "社員番号は必須です"),
  lastName: z.string().min(1, "姓は必須です"),
  firstName: z.string().min(1, "名は必須です"),
  email: z.string().email("有効なメールアドレスを入力してください").optional().or(z.literal("")),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
  hireDate: z.string().min(1, "入社日は必須です"),
  jobCategoryId: z.string().optional(),
  employmentType: z.string().min(1, "雇用形態は必須です"),
  jobTypeId: z.string().optional(),
  gradeId: z.string().optional(),
  positionId: z.string().optional(),
  currentStep: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === "" || val === undefined) return undefined;
    return typeof val === "string" ? parseInt(val, 10) : val;
  }),
  currentRank: z.string().optional(),
  baseSalary: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === "" || val === undefined) return undefined;
    return typeof val === "string" ? parseInt(val, 10) : val;
  }),
  status: z.string().optional(),
});

type EmployeeFormSchema = z.infer<typeof employeeFormSchema>;

// フォームの入力値の型（変換前）
interface EmployeeFormInput {
  employeeCode: string;
  lastName: string;
  firstName: string;
  email?: string;
  gender?: string;
  birthDate?: string;
  hireDate: string;
  jobCategoryId?: string;
  employmentType: string;
  jobTypeId?: string;
  gradeId?: string;
  positionId?: string;
  currentStep?: string | number;
  currentRank?: string;
  baseSalary?: string | number;
  status?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface JobTypeOption extends SelectOption {
  jobCategoryId: string;
}

interface EmployeeFormProps {
  companyId: string;
  jobCategories: SelectOption[];
  grades: SelectOption[];
  jobTypes: JobTypeOption[];
  positions: SelectOption[];
  initialData?: Partial<EmployeeFormInput & { id: string }>;
  isEdit?: boolean;
  redirectPath?: string;
}

export function EmployeeForm({
  companyId,
  jobCategories,
  grades,
  jobTypes,
  positions,
  initialData,
  isEdit = false,
  redirectPath,
}: EmployeeFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EmployeeFormInput>({
    resolver: zodResolver(employeeFormSchema) as never,
    defaultValues: {
      employeeCode: initialData?.employeeCode || "",
      lastName: initialData?.lastName || "",
      firstName: initialData?.firstName || "",
      email: initialData?.email || "",
      gender: initialData?.gender || "",
      birthDate: initialData?.birthDate || "",
      hireDate: initialData?.hireDate || "",
      jobCategoryId: initialData?.jobCategoryId || "",
      employmentType: initialData?.employmentType || "",
      jobTypeId: initialData?.jobTypeId || "",
      gradeId: initialData?.gradeId || "",
      positionId: initialData?.positionId || "",
      currentStep: initialData?.currentStep ?? "",
      currentRank: initialData?.currentRank || "",
      baseSalary: initialData?.baseSalary ?? "",
      status: initialData?.status || "ACTIVE",
    },
  });

  // 選択された部署に基づいて職種をフィルタリング
  const selectedJobCategoryId = form.watch("jobCategoryId");
  const filteredJobTypes = useMemo(() => {
    if (!selectedJobCategoryId) return jobTypes;
    return jobTypes.filter((jt) => jt.jobCategoryId === selectedJobCategoryId);
  }, [selectedJobCategoryId, jobTypes]);

  // 部署が変更されたときに職種をクリア
  const handleJobCategoryChange = (value: string) => {
    form.setValue("jobCategoryId", value);
    // 現在選択中の職種が新しい部署に属していない場合はクリア
    const currentJobTypeId = form.getValues("jobTypeId");
    if (currentJobTypeId) {
      const jobType = jobTypes.find((jt) => jt.value === currentJobTypeId);
      if (jobType && jobType.jobCategoryId !== value) {
        form.setValue("jobTypeId", "");
      }
    }
  };

  const onSubmit: SubmitHandler<EmployeeFormInput> = async (data) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEdit
        ? `/api/employees/${initialData?.id}`
        : "/api/employees";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          companyId,
          email: data.email || null,
          gender: data.gender || null,
          birthDate: data.birthDate || null,
          jobTypeId: data.jobTypeId || null,
          gradeId: data.gradeId || null,
          positionId: data.positionId || null,
          currentStep: data.currentStep || null,
          currentRank: data.currentRank || null,
          baseSalary: data.baseSalary || null,
          status: data.status || "ACTIVE",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "保存に失敗しました");
      }

      const employee = await response.json();
      router.push(redirectPath || `/employees/${employee.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* 基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="employeeCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>社員番号 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例: EMP001"
                      {...field}
                      disabled={isEdit}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓 *</FormLabel>
                    <FormControl>
                      <Input placeholder="山田" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名 *</FormLabel>
                    <FormControl>
                      <Input placeholder="太郎" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メールアドレス</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="taro.yamada@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>性別</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(GenderLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
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
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>生年月日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hireDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>入社日 *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 所属情報 */}
        <Card>
          <CardHeader>
            <CardTitle>所属情報</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="jobCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部署</FormLabel>
                  <Select onValueChange={handleJobCategoryChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {jobCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
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
              name="employmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>雇用形態 *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(EmploymentTypeLabels).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>職種</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={filteredJobTypes.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={filteredJobTypes.length === 0 ? "部署を先に選択してください" : "選択してください"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredJobTypes.map((jt) => (
                        <SelectItem key={jt.value} value={jt.value}>
                          {jt.label}
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
              name="gradeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>等級</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {grades.map((grade) => (
                        <SelectItem key={grade.value} value={grade.value}>
                          {grade.label}
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
              name="positionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>役職</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {positions.map((pos) => (
                        <SelectItem key={pos.value} value={pos.value}>
                          {pos.label}
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ステータス</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(EmployeeStatusLabels).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 給与情報 */}
        <Card>
          <CardHeader>
            <CardTitle>給与情報</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="currentStep"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>号俸</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="例: 10"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currentRank"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ランク</FormLabel>
                  <FormControl>
                    <Input placeholder="例: A1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="baseSalary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>基本給（円）</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="例: 250000"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* アクション */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "保存中..." : "保存"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
