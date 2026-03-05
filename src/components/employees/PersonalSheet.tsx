"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GradeHistoryList } from "./GradeHistoryList";
import { SalaryChart } from "./SalaryChart";
import type { EmployeeDetailResponse, SalaryHistoryItem } from "@/types/employee";
import { GenderLabels, EmployeeStatusLabels, EmployeeStatus } from "@/types/employee";
import { Plus, Upload, Camera, X, Loader2, User, Building2, Wallet, ClipboardCheck, History, TrendingUp, FileText, MessageSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface SelectOption {
  value: string;
  label: string;
}

interface JobTypeOption extends SelectOption {
  jobCategoryId: string;
}

interface EmploymentTypeOption extends SelectOption {}

interface MasterData {
  jobCategories: SelectOption[];
  grades: SelectOption[];
  jobTypes: JobTypeOption[];
  positions: SelectOption[];
  employmentTypes: EmploymentTypeOption[];
}

interface FormData {
  lastName: string;
  firstName: string;
  gender: string;
  birthDate: string;
  hireDate: string;
  jobCategoryId: string;
  employmentType: string;
  jobTypeId: string;
  gradeId: string;
  positionId: string;
  currentStep: string;
  currentRank: string;
  baseSalary: string;
}

interface PersonalSheetProps {
  employee: EmployeeDetailResponse;
  basePath?: string;
}

export function PersonalSheet({ employee: initialEmployee, basePath = "/employees" }: PersonalSheetProps) {
  const router = useRouter();
  const [employee] = useState(initialEmployee);
  const initials = `${employee.lastName.charAt(0)}${employee.firstName.charAt(0)}`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileImage, setProfileImage] = useState<string | null>(
    (employee as unknown as { profileImage?: string | null }).profileImage || null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [interviewRecords, setInterviewRecords] = useState(employee.interviewRecords);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryItem[]>([]);
  const [isSalaryLoading, setIsSalaryLoading] = useState(false);
  const [salaryLoaded, setSalaryLoaded] = useState(false);

  // 評価有無
  const [has360Evaluation, setHas360Evaluation] = useState(
    (employee as unknown as { has360Evaluation?: boolean }).has360Evaluation ?? false
  );
  const [hasIndividualEvaluation, setHasIndividualEvaluation] = useState(
    (employee as unknown as { hasIndividualEvaluation?: boolean }).hasIndividualEvaluation ?? false
  );
  const [isEvaluationSaving, setIsEvaluationSaving] = useState(false);

  // フォーム状態
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [isMasterLoading, setIsMasterLoading] = useState(true);

  const formatDateForInput = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  // 従業員の職種からjobCategoryIdを取得
  const getInitialJobCategoryId = () => {
    if (employee.jobTypeId && masterData?.jobTypes) {
      const jt = masterData.jobTypes.find(j => j.value === employee.jobTypeId);
      return jt?.jobCategoryId || "";
    }
    return "";
  };

  const [form, setForm] = useState<FormData>({
    lastName: employee.lastName,
    firstName: employee.firstName,
    gender: employee.gender || "",
    birthDate: formatDateForInput(employee.birthDate),
    hireDate: formatDateForInput(employee.hireDate),
    jobCategoryId: "",
    employmentType: employee.employmentType,
    jobTypeId: employee.jobTypeId || "",
    gradeId: employee.gradeId || "",
    positionId: employee.positionId || "",
    currentStep: employee.currentStep != null ? String(employee.currentStep) : "",
    currentRank: employee.currentRank || "",
    baseSalary: employee.baseSalary != null ? String(employee.baseSalary) : "",
  });

  // 新規面談記録フォーム
  const [newInterview, setNewInterview] = useState({
    interviewDate: "",
    notes: "",
    documentUrl: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // マスターデータ読み込み
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [jobCatsRes, gds, jtsRes, posRes, empTypesRes] = await Promise.all([
          fetch(`/api/companies/${employee.companyId}/job-categories`).then(r => r.ok ? r.json() : { jobCategories: [] }),
          fetch(`/api/grades?companyId=${employee.companyId}`).then(r => r.ok ? r.json() : []),
          fetch(`/api/companies/${employee.companyId}/job-types`).then(r => r.ok ? r.json() : { jobTypes: [] }),
          fetch(`/api/companies/${employee.companyId}/positions`).then(r => r.ok ? r.json() : { positions: [] }),
          fetch(`/api/companies/${employee.companyId}/employment-types`).then(r => r.ok ? r.json() : { employmentTypes: [] }),
        ]);

        const jobCategories = (jobCatsRes.jobCategories || []).map((c: { id: string; name: string }) => ({
          value: c.id,
          label: c.name,
        }));

        const jobTypes = (jtsRes.jobTypes || []).map((j: { id: string; name: string; jobCategoryId: string }) => ({
          value: j.id,
          label: j.name,
          jobCategoryId: j.jobCategoryId,
        }));

        const employmentTypes = (empTypesRes.employmentTypes || []).map((e: { value: string; label: string }) => ({
          value: e.value,
          label: e.label,
        }));

        setMasterData({
          jobCategories,
          grades: (gds || []).map((g: { id: string; name: string }) => ({ value: g.id, label: g.name })),
          jobTypes,
          positions: (posRes.positions || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name })),
          employmentTypes,
        });

        // jobCategoryIdを初期設定
        if (employee.jobTypeId) {
          const jt = jobTypes.find((j: JobTypeOption) => j.value === employee.jobTypeId);
          if (jt) {
            setForm(prev => ({ ...prev, jobCategoryId: jt.jobCategoryId }));
          }
        }
      } catch {
        setMasterData({ jobCategories: [], grades: [], jobTypes: [], positions: [], employmentTypes: [] });
      } finally {
        setIsMasterLoading(false);
      }
    };
    loadMasterData();
  }, [employee.companyId, employee.jobTypeId]);

  // 選択された部署に基づいて職種をフィルタリング
  const filteredJobTypes = useMemo(() => {
    if (!masterData?.jobTypes) return [];
    if (!form.jobCategoryId) return masterData.jobTypes;
    return masterData.jobTypes.filter(jt => jt.jobCategoryId === form.jobCategoryId);
  }, [form.jobCategoryId, masterData?.jobTypes]);

  // 部署が変更されたときに職種をクリア
  const handleJobCategoryChange = (value: string) => {
    setForm(prev => {
      const currentJobType = masterData?.jobTypes.find(jt => jt.value === prev.jobTypeId);
      const shouldClearJobType = currentJobType && currentJobType.jobCategoryId !== value;
      return {
        ...prev,
        jobCategoryId: value,
        jobTypeId: shouldClearJobType ? "" : prev.jobTypeId,
      };
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const formatSalary = (salary: number | null) => {
    if (!salary) return "-";
    return `¥${salary.toLocaleString()}`;
  };

  const employeeStatus = (employee as unknown as { status?: EmployeeStatus }).status || "ACTIVE";

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("画像サイズが大きすぎます。2MB以下の画像を使用してください");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("PNG、JPEG、GIF、WebPのみ対応しています");
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;

        const response = await fetch(`/api/employees/${employee.id}/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "画像のアップロードに失敗しました");
        }

        const data = await response.json();
        setProfileImage(data.profileImage);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("画像アップロードエラー:", error);
      alert(error instanceof Error ? error.message : "画像のアップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageDelete = async () => {
    if (!confirm("プロフィール画像を削除しますか？")) return;

    setIsUploading(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}/upload-image`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("画像の削除に失敗しました");
      }

      setProfileImage(null);
    } catch (error) {
      console.error("画像削除エラー:", error);
      alert("画像の削除に失敗しました");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddInterview = async () => {
    if (!newInterview.interviewDate) {
      alert("面談日は必須です");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInterview),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "面談記録の追加に失敗しました");
      }

      const record = await response.json();
      setInterviewRecords([record, ...interviewRecords]);
      setNewInterview({ interviewDate: "", notes: "", documentUrl: "" });
      setIsInterviewModalOpen(false);
    } catch (error) {
      console.error("面談記録追加エラー:", error);
      alert(error instanceof Error ? error.message : "面談記録の追加に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: employee.companyId,
          lastName: form.lastName,
          firstName: form.firstName,
          gender: form.gender || null,
          birthDate: form.birthDate || null,
          hireDate: form.hireDate,
          employmentType: form.employmentType,
          jobTypeId: form.jobTypeId || null,
          gradeId: form.gradeId || null,
          positionId: form.positionId || null,
          currentStep: form.currentStep ? parseInt(form.currentStep, 10) : null,
          currentRank: form.currentRank || null,
          baseSalary: form.baseSalary ? parseInt(form.baseSalary, 10) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "保存に失敗しました");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleEvaluationChange = async (type: "360" | "individual", checked: boolean) => {
    const previous360 = has360Evaluation;
    const previousIndividual = hasIndividualEvaluation;

    if (type === "360") {
      setHas360Evaluation(checked);
    } else {
      setHasIndividualEvaluation(checked);
    }

    setIsEvaluationSaving(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}/evaluation-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          has360Evaluation: type === "360" ? checked : has360Evaluation,
          hasIndividualEvaluation: type === "individual" ? checked : hasIndividualEvaluation,
        }),
      });

      if (!response.ok) {
        throw new Error("更新に失敗しました");
      }
    } catch {
      if (type === "360") {
        setHas360Evaluation(previous360);
      } else {
        setHasIndividualEvaluation(previousIndividual);
      }
    } finally {
      setIsEvaluationSaving(false);
    }
  };

  const loadSalaryHistory = async () => {
    if (salaryLoaded) return;

    setIsSalaryLoading(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}/salary-history`);
      if (!response.ok) {
        throw new Error("給与履歴の取得に失敗しました");
      }
      const data = await response.json();
      setSalaryHistory(data.history);
      setSalaryLoaded(true);
    } catch (error) {
      console.error("給与履歴取得エラー:", error);
    } finally {
      setIsSalaryLoading(false);
    }
  };

  // セクションヘッダー
  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="flex items-center gap-2 mb-6">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="text-lg font-bold">{title}</h3>
    </div>
  );

  // フィールドラベル
  const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
    <Label className="text-sm text-muted-foreground">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );

  // 年収計算
  const calculatedAnnualSalary = form.baseSalary ? parseInt(form.baseSalary, 10) * 12 : null;

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* ===== ヘッダー ===== */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                <Avatar className="h-14 w-14 ring-2 ring-slate-100">
                  {profileImage ? (
                    <AvatarImage src={profileImage} alt={`${form.lastName} ${form.firstName}`} />
                  ) : null}
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                  {profileImage ? (
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Camera className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={handleImageDelete} disabled={isUploading}><X className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Upload className="h-3 w-3" /></Button>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold">{form.lastName} {form.firstName}</h1>
                  <Badge variant={employeeStatus === "ACTIVE" ? "default" : employeeStatus === "LEAVE" ? "secondary" : "outline"} className="text-xs">
                    {EmployeeStatusLabels[employeeStatus]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono">{employee.employeeCode}</p>
              </div>
            </div>
            <Button variant="ghost" asChild>
              <Link href={basePath}>一覧に戻る</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ===== メインコンテンツ: 2カラムレイアウト ===== */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* ===== 左カラム: 入力フォーム ===== */}
          <div className="lg:col-span-3 space-y-8">
            {/* 個人情報 */}
            <div className="bg-white rounded-xl border p-6">
              <SectionHeader icon={User} title="個人情報" />
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <FieldLabel required>姓</FieldLabel>
                    <Input className="mt-1.5 w-full" value={form.lastName} onChange={e => updateField("lastName", e.target.value)} placeholder="山田" />
                  </div>
                  <div>
                    <FieldLabel required>名</FieldLabel>
                    <Input className="mt-1.5 w-full" value={form.firstName} onChange={e => updateField("firstName", e.target.value)} placeholder="太郎" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <FieldLabel>生年月日</FieldLabel>
                    <Input className="mt-1.5 w-full" type="date" value={form.birthDate} onChange={e => updateField("birthDate", e.target.value)} />
                  </div>
                  <div>
                    <FieldLabel>性別</FieldLabel>
                    <Select value={form.gender} onValueChange={(v) => updateField("gender", v)}>
                      <SelectTrigger className="mt-1.5 w-full"><SelectValue placeholder="選択してください" /></SelectTrigger>
                      <SelectContent>{Object.entries(GenderLabels).map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <FieldLabel required>入社日</FieldLabel>
                    <Input className="mt-1.5 w-full" type="date" value={form.hireDate} onChange={e => updateField("hireDate", e.target.value)} />
                  </div>
                  <div>
                    <FieldLabel required>雇用形態</FieldLabel>
                    <Select value={form.employmentType} onValueChange={(v) => updateField("employmentType", v)}>
                      <SelectTrigger className="mt-1.5 w-full"><SelectValue placeholder="選択してください" /></SelectTrigger>
                      <SelectContent>
                        {masterData?.employmentTypes.map(et => (
                          <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* 所属情報 */}
            <div className="bg-white rounded-xl border p-6">
              <SectionHeader icon={Building2} title="所属情報" />
              {isMasterLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <FieldLabel>部署</FieldLabel>
                      <Select value={form.jobCategoryId} onValueChange={handleJobCategoryChange}>
                        <SelectTrigger className="mt-1.5 w-full"><SelectValue placeholder="選択してください" /></SelectTrigger>
                        <SelectContent>
                          {masterData?.jobCategories.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>職種</FieldLabel>
                      <Select
                        value={form.jobTypeId}
                        onValueChange={(v) => updateField("jobTypeId", v)}
                        disabled={filteredJobTypes.length === 0}
                      >
                        <SelectTrigger className="mt-1.5 w-full">
                          <SelectValue placeholder={filteredJobTypes.length === 0 ? "部署を先に選択" : "選択してください"} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredJobTypes.map(j => (
                            <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <FieldLabel>等級</FieldLabel>
                      <Select value={form.gradeId} onValueChange={(v) => updateField("gradeId", v)}>
                        <SelectTrigger className="mt-1.5 w-full"><SelectValue placeholder="選択してください" /></SelectTrigger>
                        <SelectContent>{masterData?.grades.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>役職</FieldLabel>
                      <Select value={form.positionId} onValueChange={(v) => updateField("positionId", v)}>
                        <SelectTrigger className="mt-1.5 w-full"><SelectValue placeholder="選択してください" /></SelectTrigger>
                        <SelectContent>{masterData?.positions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 報酬 */}
            <div className="bg-white rounded-xl border p-6">
              <SectionHeader icon={Wallet} title="報酬" />
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <FieldLabel>号俸</FieldLabel>
                    <Input className="mt-1.5 w-full" type="number" value={form.currentStep} onChange={e => updateField("currentStep", e.target.value)} placeholder="30" />
                  </div>
                  <div>
                    <FieldLabel>ランク</FieldLabel>
                    <Input className="mt-1.5 w-full" value={form.currentRank} onChange={e => updateField("currentRank", e.target.value)} placeholder="B3" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <FieldLabel>基本給（月額）</FieldLabel>
                    <Input className="mt-1.5 w-full" type="number" value={form.baseSalary} onChange={e => updateField("baseSalary", e.target.value)} placeholder="280000" />
                  </div>
                  <div>
                    <FieldLabel>年収（自動計算）</FieldLabel>
                    <div className="mt-1.5 p-3 bg-slate-50 rounded-lg border h-10 flex items-center">
                      <span className="text-base font-bold text-emerald-600">{formatSalary(calculatedAnnualSalary)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 評価設定 */}
            <div className="bg-white rounded-xl border p-6">
              <SectionHeader icon={ClipboardCheck} title="評価設定" />
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="has360"
                      checked={has360Evaluation}
                      onCheckedChange={(checked) => handleEvaluationChange("360", !!checked)}
                      disabled={isEvaluationSaving}
                      className="h-5 w-5"
                    />
                    <label htmlFor="has360" className="text-base font-medium cursor-pointer">360度評価</label>
                  </div>
                  {has360Evaluation ? (
                    <Badge className="bg-primary">対象</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">対象外</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="hasIndividual"
                      checked={hasIndividualEvaluation}
                      onCheckedChange={(checked) => handleEvaluationChange("individual", !!checked)}
                      disabled={isEvaluationSaving}
                      className="h-5 w-5"
                    />
                    <label htmlFor="hasIndividual" className="text-base font-medium cursor-pointer">個別評価</label>
                  </div>
                  {hasIndividualEvaluation ? (
                    <Badge className="bg-primary">対象</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">対象外</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="bg-white rounded-xl border p-6">
              {saveError && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm mb-4">{saveError}</div>
              )}
              {saveSuccess && (
                <div className="bg-emerald-50 text-emerald-600 px-4 py-3 rounded-md text-sm mb-4">保存しました</div>
              )}
              <Button onClick={handleSave} disabled={isSaving} className="w-full" size="lg">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "設定の保存"
                )}
              </Button>
            </div>
          </div>

          {/* ===== 右カラム: 履歴・記録系 ===== */}
          <div className="lg:col-span-2 space-y-6">
            {/* 等級変遷履歴 */}
            <div className="bg-white rounded-xl border p-6">
              <SectionHeader icon={History} title="等級変遷履歴" />
              <GradeHistoryList history={employee.gradeHistory} />
            </div>

            {/* 給与変遷 */}
            <div className="bg-white rounded-xl border p-6">
              <SectionHeader icon={TrendingUp} title="給与変遷" />
              {!salaryLoaded ? (
                <div className="text-center py-6">
                  <Button variant="outline" onClick={loadSalaryHistory} disabled={isSalaryLoading}>
                    {isSalaryLoading ? "読み込み中..." : "給与履歴を表示"}
                  </Button>
                </div>
              ) : salaryHistory.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">給与履歴はまだありません</p>
              ) : (
                <SalaryChart history={salaryHistory} />
              )}
            </div>

            {/* 評価履歴 */}
            <div className="bg-white rounded-xl border p-6">
              <SectionHeader icon={FileText} title="評価履歴" />
              <p className="text-center py-6 text-muted-foreground text-sm">評価履歴はまだありません</p>
            </div>

            {/* 面談記録 */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-bold">面談記録</h3>
                </div>
                <Dialog open={isInterviewModalOpen} onOpenChange={setIsInterviewModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>面談記録を追加</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="interviewDate">面談日 *</Label>
                        <Input id="interviewDate" type="date" className="mt-1.5" value={newInterview.interviewDate} onChange={(e) => setNewInterview({ ...newInterview, interviewDate: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="notes">内容</Label>
                        <Textarea id="notes" rows={4} className="mt-1.5" placeholder="面談の内容を記録..." value={newInterview.notes} onChange={(e) => setNewInterview({ ...newInterview, notes: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="documentUrl">議事録URL</Label>
                        <Input id="documentUrl" type="url" className="mt-1.5" placeholder="https://..." value={newInterview.documentUrl} onChange={(e) => setNewInterview({ ...newInterview, documentUrl: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsInterviewModalOpen(false)}>キャンセル</Button>
                      <Button onClick={handleAddInterview} disabled={isSubmitting}>{isSubmitting ? "追加中..." : "追加"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              {interviewRecords.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">面談記録はまだありません</p>
              ) : (
                <ul className="space-y-4 max-h-80 overflow-y-auto">
                  {interviewRecords.map((record) => (
                    <li key={record.id} className="border-b last:border-0 pb-4 last:pb-0">
                      <p className="text-xs font-medium text-muted-foreground">{formatDate(record.interviewDate)}</p>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{record.notes || "メモなし"}</p>
                      {record.documentUrl && (
                        <a href={record.documentUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline mt-2 inline-block">議事録を見る</a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
