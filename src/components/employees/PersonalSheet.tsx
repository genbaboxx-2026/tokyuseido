"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { EmploymentTypeLabels, GenderLabels, EmployeeStatusLabels, EmployeeStatus } from "@/types/employee";
import { Plus, Upload, Camera, X, Pencil, Check, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface SelectOption {
  value: string;
  label: string;
}

interface MasterData {
  departments: SelectOption[];
  grades: SelectOption[];
  jobTypes: SelectOption[];
  positions: SelectOption[];
}

interface EditFormData {
  lastName: string;
  firstName: string;
  gender: string;
  birthDate: string;
  hireDate: string;
  departmentId: string;
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
  const [employee, setEmployee] = useState(initialEmployee);
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

  // 編集モード
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [isMasterLoading, setIsMasterLoading] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    lastName: "",
    firstName: "",
    gender: "",
    birthDate: "",
    hireDate: "",
    departmentId: "",
    employmentType: "",
    jobTypeId: "",
    gradeId: "",
    positionId: "",
    currentStep: "",
    currentRank: "",
    baseSalary: "",
  });

  // 新規面談記録フォーム
  const [newInterview, setNewInterview] = useState({
    interviewDate: "",
    notes: "",
    documentUrl: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const formatSalary = (salary: number | null) => {
    if (!salary) return "-";
    return `${salary.toLocaleString()}円`;
  };

  // 従業員ステータスの取得
  const employeeStatus = (employee as unknown as { status?: EmployeeStatus }).status || "ACTIVE";

  // 画像アップロード処理
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック（2MB）
    if (file.size > 2 * 1024 * 1024) {
      alert("画像サイズが大きすぎます。2MB以下の画像を使用してください");
      return;
    }

    // ファイルタイプチェック
    const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("PNG、JPEG、GIF、WebPのみ対応しています");
      return;
    }

    setIsUploading(true);

    try {
      // Base64に変換
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;

        const response = await fetch(`/api/employees/${employee.id}/upload-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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

  // 画像削除処理
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

  // 面談記録追加
  const handleAddInterview = async () => {
    if (!newInterview.interviewDate) {
      alert("面談日は必須です");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}/interviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  const formatDateForInput = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  const startEditing = useCallback(async () => {
    setEditForm({
      lastName: employee.lastName,
      firstName: employee.firstName,
      gender: employee.gender || "",
      birthDate: formatDateForInput(employee.birthDate),
      hireDate: formatDateForInput(employee.hireDate),
      departmentId: employee.departmentId || "",
      employmentType: employee.employmentType,
      jobTypeId: employee.jobTypeId || "",
      gradeId: employee.gradeId || "",
      positionId: employee.positionId || "",
      currentStep: employee.currentStep != null ? String(employee.currentStep) : "",
      currentRank: employee.currentRank || "",
      baseSalary: employee.baseSalary != null ? String(employee.baseSalary) : "",
    });
    setSaveError(null);
    setIsEditing(true);

    if (!masterData) {
      setIsMasterLoading(true);
      try {
        const [depts, gds, jts, pos] = await Promise.all([
          fetch(`/api/companies/${employee.companyId}/departments`).then(r => r.ok ? r.json() : []),
          fetch(`/api/grades?companyId=${employee.companyId}`).then(r => r.ok ? r.json() : []),
          fetch(`/api/companies/${employee.companyId}/job-types`).then(r => r.ok ? r.json() : []),
          fetch(`/api/companies/${employee.companyId}/positions`).then(r => r.ok ? r.json() : []),
        ]);
        setMasterData({
          departments: (depts.departments || depts || []).map((d: { id: string; name: string }) => ({ value: d.id, label: d.name })),
          grades: (gds || []).map((g: { id: string; name: string }) => ({ value: g.id, label: g.name })),
          jobTypes: (jts.jobTypes || jts || []).map((j: { id: string; name: string; jobCategory?: { name: string } }) => ({
            value: j.id,
            label: j.jobCategory ? `${j.jobCategory.name} / ${j.name}` : j.name,
          })),
          positions: (pos.positions || pos || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name })),
        });
      } catch {
        setMasterData({ departments: [], grades: [], jobTypes: [], positions: [] });
      } finally {
        setIsMasterLoading(false);
      }
    }
  }, [employee, masterData]);

  const cancelEditing = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: employee.companyId,
          lastName: editForm.lastName,
          firstName: editForm.firstName,
          gender: editForm.gender || null,
          birthDate: editForm.birthDate || null,
          hireDate: editForm.hireDate,
          departmentId: editForm.departmentId || null,
          employmentType: editForm.employmentType,
          jobTypeId: editForm.jobTypeId || null,
          gradeId: editForm.gradeId || null,
          positionId: editForm.positionId || null,
          currentStep: editForm.currentStep ? parseInt(editForm.currentStep, 10) : null,
          currentRank: editForm.currentRank || null,
          baseSalary: editForm.baseSalary ? parseInt(editForm.baseSalary, 10) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "保存に失敗しました");
      }

      setIsEditing(false);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof EditFormData, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // 評価有無の更新
  const handleEvaluationChange = async (type: "360" | "individual", checked: boolean) => {
    const previous360 = has360Evaluation;
    const previousIndividual = hasIndividualEvaluation;

    // 楽観的更新
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
      // エラー時は元に戻す
      if (type === "360") {
        setHas360Evaluation(previous360);
      } else {
        setHasIndividualEvaluation(previousIndividual);
      }
    } finally {
      setIsEvaluationSaving(false);
    }
  };

  // 給与履歴取得
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

  // セクションラベル用ヘルパー
  const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <dt className="text-[11px] font-medium text-muted-foreground mb-1">{children}</dt>
  );
  const FieldValue = ({ children }: { children: React.ReactNode }) => (
    <dd className="text-sm font-medium">{children}</dd>
  );

  return (
    <div className="space-y-5">
      {/* ===== ヘッダー: 名前 + 社員番号 + ステータス + アクション ===== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative group shrink-0">
            <Avatar className="h-14 w-14">
              {profileImage ? (
                <AvatarImage src={profileImage} alt={employee.fullName} />
              ) : null}
              <AvatarFallback className="text-lg font-semibold bg-muted">{initials}</AvatarFallback>
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{employee.fullName}</h1>
              <Badge variant={employeeStatus === "ACTIVE" ? "default" : employeeStatus === "LEAVE" ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                {EmployeeStatusLabels[employeeStatus]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{employee.employeeCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isSaving}>キャンセル</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                {isSaving ? "保存中..." : "保存"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-3 w-3 mr-1.5" />
                編集
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={basePath}>一覧に戻る</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">{saveError}</div>
      )}

      {/* ===== 所属情報 ===== */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">所属情報</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {isEditing ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-[11px] text-muted-foreground">部署</Label>
                <Select value={editForm.departmentId} onValueChange={(v) => updateField("departmentId", v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="-" /></SelectTrigger>
                  <SelectContent>{masterData?.departments.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">等級</Label>
                <Select value={editForm.gradeId} onValueChange={(v) => updateField("gradeId", v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="-" /></SelectTrigger>
                  <SelectContent>{masterData?.grades.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">役職</Label>
                <Select value={editForm.positionId} onValueChange={(v) => updateField("positionId", v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="-" /></SelectTrigger>
                  <SelectContent>{masterData?.positions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">職種</Label>
                <Select value={editForm.jobTypeId} onValueChange={(v) => updateField("jobTypeId", v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="-" /></SelectTrigger>
                  <SelectContent>{masterData?.jobTypes.map(j => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">雇用形態 *</Label>
                <Select value={editForm.employmentType} onValueChange={(v) => updateField("employmentType", v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(EmploymentTypeLabels).map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div><FieldLabel>部署</FieldLabel><FieldValue>{employee.department?.name || "-"}</FieldValue></div>
              <div><FieldLabel>等級</FieldLabel><FieldValue>{employee.grade?.name || "-"}</FieldValue></div>
              <div><FieldLabel>役職</FieldLabel><FieldValue>{employee.position?.name || "-"}</FieldValue></div>
              <div><FieldLabel>職種</FieldLabel><FieldValue>{employee.jobType ? `${employee.jobType.categoryName} / ${employee.jobType.name}` : "-"}</FieldValue></div>
              <div><FieldLabel>雇用形態</FieldLabel><FieldValue>{EmploymentTypeLabels[employee.employmentType]}</FieldValue></div>
            </dl>
          )}
        </CardContent>
      </Card>

      {/* ===== 個人情報 ===== */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">個人情報</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {isEditing ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-[11px] text-muted-foreground">姓 *</Label>
                <Input className="mt-1 h-8 text-sm" value={editForm.lastName} onChange={e => updateField("lastName", e.target.value)} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">名 *</Label>
                <Input className="mt-1 h-8 text-sm" value={editForm.firstName} onChange={e => updateField("firstName", e.target.value)} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">入社日 *</Label>
                <Input className="mt-1 h-8 text-sm" type="date" value={editForm.hireDate} onChange={e => updateField("hireDate", e.target.value)} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">生年月日</Label>
                <Input className="mt-1 h-8 text-sm" type="date" value={editForm.birthDate} onChange={e => updateField("birthDate", e.target.value)} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">性別</Label>
                <Select value={editForm.gender} onValueChange={(v) => updateField("gender", v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="-" /></SelectTrigger>
                  <SelectContent>{Object.entries(GenderLabels).map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div><FieldLabel>入社日</FieldLabel><FieldValue>{formatDate(employee.hireDate)}</FieldValue></div>
              <div><FieldLabel>勤続年数</FieldLabel><FieldValue>{employee.yearsOfService}年</FieldValue></div>
              <div><FieldLabel>生年月日</FieldLabel><FieldValue>{formatDate(employee.birthDate)}</FieldValue></div>
              <div><FieldLabel>年齢</FieldLabel><FieldValue>{employee.age !== null ? `${employee.age}歳` : "-"}</FieldValue></div>
              <div><FieldLabel>性別</FieldLabel><FieldValue>{employee.gender ? GenderLabels[employee.gender] : "-"}</FieldValue></div>
            </dl>
          )}
        </CardContent>
      </Card>

      {/* ===== 給与 + 等級変遷 ===== */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">報酬</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {isEditing ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[11px] text-muted-foreground">基本給（円）</Label>
                  <Input className="mt-1 h-8 text-sm" type="number" value={editForm.baseSalary} onChange={e => updateField("baseSalary", e.target.value)} placeholder="280000" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">年収（自動計算）</Label>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{editForm.baseSalary ? formatSalary(parseInt(editForm.baseSalary, 10) * 12) : "-"}</p>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">号俸</Label>
                  <Input className="mt-1 h-8 text-sm" type="number" value={editForm.currentStep} onChange={e => updateField("currentStep", e.target.value)} placeholder="30" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">ランク</Label>
                  <Input className="mt-1 h-8 text-sm" value={editForm.currentRank} onChange={e => updateField("currentRank", e.target.value)} placeholder="B3" />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg border bg-muted/30 px-4 py-3">
                    <p className="text-[11px] text-muted-foreground">基本給（月額）</p>
                    <p className="text-xl font-bold mt-0.5">{formatSalary(employee.baseSalary)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3">
                    <p className="text-[11px] text-muted-foreground">年収（概算）</p>
                    <p className="text-xl font-bold mt-0.5">{formatSalary(employee.annualSalary)}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-4">
                  <div><FieldLabel>号俸</FieldLabel><FieldValue>{employee.currentStep ?? "-"}</FieldValue></div>
                  <div><FieldLabel>ランク</FieldLabel><FieldValue>{employee.currentRank || "-"}</FieldValue></div>
                </dl>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">等級変遷履歴</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <GradeHistoryList history={employee.gradeHistory} />
          </CardContent>
        </Card>
      </div>

      {/* ===== 給与変遷 ===== */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">給与変遷</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {!salaryLoaded ? (
            <div className="text-center py-6">
              <Button variant="outline" size="sm" onClick={loadSalaryHistory} disabled={isSalaryLoading}>
                {isSalaryLoading ? "読み込み中..." : "給与履歴を表示"}
              </Button>
            </div>
          ) : salaryHistory.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">給与履歴はまだありません</p>
          ) : (
            <SalaryChart history={salaryHistory} />
          )}
        </CardContent>
      </Card>

      {/* ===== 評価設定 ===== */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">評価設定</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Checkbox
                id="has360"
                checked={has360Evaluation}
                onCheckedChange={(checked) => handleEvaluationChange("360", !!checked)}
                disabled={isEvaluationSaving}
              />
              <label htmlFor="has360" className="text-sm font-medium cursor-pointer flex-1">
                360度評価対象
              </label>
              {has360Evaluation && <span className="text-xs text-primary">対象</span>}
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <Checkbox
                id="hasIndividual"
                checked={hasIndividualEvaluation}
                onCheckedChange={(checked) => handleEvaluationChange("individual", !!checked)}
                disabled={isEvaluationSaving}
              />
              <label htmlFor="hasIndividual" className="text-sm font-medium cursor-pointer flex-1">
                個別評価対象
              </label>
              {hasIndividualEvaluation && <span className="text-xs text-primary">対象</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== 評価 + 面談 ===== */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">評価履歴</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-center py-6 text-sm text-muted-foreground">評価履歴はまだありません</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">面談記録</CardTitle>
              <Dialog open={isInterviewModalOpen} onOpenChange={setIsInterviewModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    追加
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>面談記録を追加</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="interviewDate">面談日 *</Label>
                      <Input id="interviewDate" type="date" value={newInterview.interviewDate} onChange={(e) => setNewInterview({ ...newInterview, interviewDate: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="notes">内容</Label>
                      <Textarea id="notes" rows={4} placeholder="面談の内容を記録..." value={newInterview.notes} onChange={(e) => setNewInterview({ ...newInterview, notes: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="documentUrl">議事録URL</Label>
                      <Input id="documentUrl" type="url" placeholder="https://..." value={newInterview.documentUrl} onChange={(e) => setNewInterview({ ...newInterview, documentUrl: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsInterviewModalOpen(false)}>キャンセル</Button>
                    <Button onClick={handleAddInterview} disabled={isSubmitting}>{isSubmitting ? "追加中..." : "追加"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {interviewRecords.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">面談記録はまだありません</p>
            ) : (
              <ul className="space-y-3 max-h-80 overflow-y-auto">
                {interviewRecords.map((record) => (
                  <li key={record.id} className="border-b last:border-0 pb-3 last:pb-0">
                    <p className="text-xs text-muted-foreground">{formatDate(record.interviewDate)}</p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{record.notes || "メモなし"}</p>
                    {record.documentUrl && (
                      <a href={record.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">議事録を見る</a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
