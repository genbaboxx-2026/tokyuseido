"use client";

import React, { useState, useMemo } from "react";
import { Loader2, Mail, Calendar, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReviewerInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  targetEmployees: Array<{
    id: string;
    name: string;
  }>;
}

interface DistributionConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewers: ReviewerInfo[];
  onConfirm: (deadline: Date, emailOverrides: Record<string, string>) => void;
  isLoading?: boolean;
}

export function DistributionConfirmModal({
  open,
  onOpenChange,
  reviewers,
  onConfirm,
  isLoading = false,
}: DistributionConfirmModalProps) {
  // デフォルトは7日後
  const defaultDeadline = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split("T")[0];
  }, []);

  const [deadline, setDeadline] = useState(defaultDeadline);
  const [showEmailEdit, setShowEmailEdit] = useState(false);
  const [emailOverrides, setEmailOverrides] = useState<Record<string, string>>({});

  // メールアドレスが未設定の評価者
  const reviewersWithoutEmail = useMemo(() => {
    return reviewers.filter((r) => !r.email && !emailOverrides[r.id]);
  }, [reviewers, emailOverrides]);

  // 有効なメールアドレスを持つ評価者の数
  const validEmailCount = useMemo(() => {
    return reviewers.filter((r) => r.email || emailOverrides[r.id]).length;
  }, [reviewers, emailOverrides]);

  const handleConfirm = () => {
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(23, 59, 59, 999);
    onConfirm(deadlineDate, emailOverrides);
  };

  const handleEmailChange = (reviewerId: string, email: string) => {
    setEmailOverrides((prev) => ({
      ...prev,
      [reviewerId]: email,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            配布確認
          </DialogTitle>
          <DialogDescription>
            360度評価フォームを評価者にメールで送信します。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 回答期日設定 */}
          <div className="space-y-2">
            <Label htmlFor="deadline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              回答期日
            </Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-48"
            />
            <p className="text-sm text-muted-foreground">
              この日付までに評価を完了するよう依頼します
            </p>
          </div>

          {/* 評価者リスト */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                評価者一覧
                <Badge variant="outline">{reviewers.length}名</Badge>
              </Label>
              <span className="text-sm text-muted-foreground">
                メール送信可能: {validEmailCount}名
              </span>
            </div>

            <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
              {reviewers.map((reviewer) => {
                const currentEmail = emailOverrides[reviewer.id] || reviewer.email;
                const hasEmail = !!currentEmail;

                return (
                  <div
                    key={reviewer.id}
                    className={`p-3 ${!hasEmail ? "bg-yellow-50" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {reviewer.lastName} {reviewer.firstName}
                          </span>
                          {!hasEmail && (
                            <Badge variant="destructive" className="text-xs">
                              メール未設定
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          担当: {reviewer.targetEmployees.map((e) => e.name).join(", ")}
                        </div>
                        {hasEmail && !showEmailEdit && (
                          <div className="text-sm text-muted-foreground">
                            {currentEmail}
                          </div>
                        )}
                      </div>
                    </div>

                    {showEmailEdit && (
                      <div className="mt-2">
                        <Input
                          type="email"
                          placeholder="メールアドレス"
                          value={emailOverrides[reviewer.id] || reviewer.email || ""}
                          onChange={(e) => handleEmailChange(reviewer.id, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEmailEdit(!showEmailEdit)}
              className="w-full"
            >
              {showEmailEdit ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  メールアドレス編集を閉じる
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  メールアドレスを編集
                </>
              )}
            </Button>
          </div>

          {/* 警告メッセージ */}
          {reviewersWithoutEmail.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {reviewersWithoutEmail.length}名の評価者にメールアドレスが設定されていません。
                メールが送信できない評価者がいます。
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || validEmailCount === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                送信中...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                {validEmailCount}名にメール送信
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
