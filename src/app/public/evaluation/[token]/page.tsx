"use client";

import React, { useState, useCallback, use, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Send,
  User,
  Building2,
  Calendar,
  Clock,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface EvaluationItem {
  id: string;
  itemName: string;
  description: string | null;
  maxScore: number;
  weight: number;
  sortOrder: number;
  selfScore: number | null;
  evaluatorScore: number | null;
  comment: string | null;
}

interface Category {
  name: string;
  sortOrder: number;
  items: EvaluationItem[];
}

interface EvaluationData {
  tokenType: string;
  isSubmitted: boolean;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    department: string | null;
    grade: string | null;
    jobType: string | null;
  };
  evaluator: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  company: {
    id: string;
    name: string;
  };
  period: {
    id: string;
    name: string;
  } | null;
  deadline: string | null;
  status: string;
  selfComment: string | null;
  categories: Category[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

export default function SelfEvaluationForm({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [selfComment, setSelfComment] = useState("");

  // デバウンス用のタイマー参照
  const saveTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  // 評価データを取得
  const { data, isLoading, error } = useQuery<EvaluationData>({
    queryKey: ["publicEvaluation", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/evaluation/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "データの取得に失敗しました");
      }
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  // コメントの初期値を設定
  useEffect(() => {
    if (data?.selfComment) {
      setSelfComment(data.selfComment);
    }
  }, [data?.selfComment]);

  // スコア保存mutation
  const saveScoreMutation = useMutation({
    mutationFn: async ({
      itemId,
      selfScore,
      comment,
    }: {
      itemId?: string;
      selfScore?: number;
      comment?: string;
      selfComment?: string;
    }) => {
      const res = await fetch(`/api/public/evaluation/${token}/scores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scores: itemId !== undefined ? [{ itemId, selfScore, comment }] : [],
          selfComment: comment === undefined ? undefined : comment,
        }),
      });
      if (!res.ok) {
        throw new Error("保存に失敗しました");
      }
      return res.json();
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["publicEvaluation", token] });
    },
  });

  // キャッシュを直接更新する関数
  const updateCacheScore = useCallback(
    (itemId: string, score: number) => {
      queryClient.setQueryData<EvaluationData>(
        ["publicEvaluation", token],
        (oldData) => {
          if (!oldData) return oldData;

          let completed = 0;
          const updatedCategories = oldData.categories.map((category) => ({
            ...category,
            items: category.items.map((item) => {
              const newScore = item.id === itemId ? score : item.selfScore;
              if (newScore !== null) completed++;
              return item.id === itemId ? { ...item, selfScore: score } : item;
            }),
          }));

          const total = updatedCategories.reduce(
            (sum, cat) => sum + cat.items.length,
            0
          );

          return {
            ...oldData,
            categories: updatedCategories,
            progress: {
              total,
              completed,
              percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            },
          };
        }
      );
    },
    [queryClient, token]
  );

  // 提出mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/evaluation/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "提出に失敗しました");
      }
      return res.json();
    },
    onSuccess: (result) => {
      setSubmitResult({
        success: true,
        message: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ["publicEvaluation", token] });
    },
    onError: (error: Error) => {
      setSubmitResult({
        success: false,
        message: error.message,
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // スコア変更ハンドラー
  const handleScoreChange = useCallback(
    (itemId: string, score: number) => {
      const key = itemId;

      updateCacheScore(itemId, score);

      if (saveTimerRef.current[key]) {
        clearTimeout(saveTimerRef.current[key]);
      }

      saveTimerRef.current[key] = setTimeout(() => {
        saveScoreMutation.mutate({ itemId, selfScore: score });
        delete saveTimerRef.current[key];
      }, 300);
    },
    [saveScoreMutation, updateCacheScore]
  );

  // コメント変更ハンドラー
  const handleCommentChange = useCallback(
    (comment: string) => {
      setSelfComment(comment);

      if (saveTimerRef.current["comment"]) {
        clearTimeout(saveTimerRef.current["comment"]);
      }

      saveTimerRef.current["comment"] = setTimeout(() => {
        saveScoreMutation.mutate({ selfComment: comment });
        delete saveTimerRef.current["comment"];
      }, 500);
    },
    [saveScoreMutation]
  );

  // 提出ハンドラー
  const handleSubmit = () => {
    setIsSubmitting(true);
    setSubmitResult(null);
    submitMutation.mutate();
  };

  // エラー表示
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">エラー</h2>
            <p className="text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ローディング表示
  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 提出済みの場合は完了画面
  if (data.isSubmitted || submitResult?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">自己評価完了</h2>
            <p className="text-muted-foreground mb-6">
              自己評価を提出しました。<br />
              上司による評価が完了次第、結果をお知らせします。
            </p>
            <p className="text-sm text-muted-foreground">
              このページを閉じていただいて構いません。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 期日の表示
  const deadlineDate = data.deadline ? new Date(data.deadline) : null;
  const deadlineStr = deadlineDate
    ? new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(deadlineDate)
    : null;

  // 期日までの日数
  const daysLeft = deadlineDate
    ? Math.ceil(
        (deadlineDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className="min-h-screen pb-24">
      {/* ヘッダー */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-emerald-600 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                自己評価
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {data.company.name}
                {data.period && ` - ${data.period.name}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm flex items-center gap-1 justify-end">
                <User className="h-3 w-3" />
                {data.employee.lastName} {data.employee.firstName} 様
              </p>
              {deadlineStr && (
                <p
                  className={cn(
                    "text-sm flex items-center gap-1 justify-end",
                    daysLeft !== null && daysLeft <= 3
                      ? "text-red-500 font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  期限: {deadlineStr}
                  {daysLeft !== null && daysLeft >= 0 && (
                    <span className="ml-1">
                      ({daysLeft === 0 ? "本日" : `残り${daysLeft}日`})
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* 全体進捗 */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>回答進捗</span>
              <span className="font-medium">
                {data.progress.completed}/{data.progress.total}問 ({data.progress.percentage}%)
              </span>
            </div>
            <Progress value={data.progress.percentage} className="h-2" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 従業員情報 */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">部署</span>
                <p className="font-medium">{data.employee.department || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">等級</span>
                <p className="font-medium">{data.employee.grade || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">職種</span>
                <p className="font-medium">{data.employee.jobType || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 評価項目 */}
        <div className="space-y-4">
          {data.categories.map((category) => {
            const categoryCurrentScore = category.items.reduce(
              (sum, item) => sum + (item.selfScore || 0),
              0
            );
            const categoryMaxScore = category.items.reduce(
              (sum, item) => sum + item.maxScore,
              0
            );
            const categoryAnswered = category.items.filter(
              (item) => item.selfScore !== null
            ).length;

            return (
              <Card key={category.name}>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      {category.name}
                    </div>
                    <span
                      className={cn(
                        "font-medium",
                        categoryAnswered === category.items.length
                          ? "text-emerald-600"
                          : "text-foreground"
                      )}
                    >
                      {categoryCurrentScore}/{categoryMaxScore}点
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {category.items.map((item) => (
                    <EvaluationItemCard
                      key={item.id}
                      item={item}
                      onScoreChange={(score) =>
                        handleScoreChange(item.id, score)
                      }
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 自己評価コメント */}
        <Card className="mt-6">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              総合コメント（任意）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="自己評価に関するコメントがあれば入力してください"
              value={selfComment}
              onChange={(e) => handleCommentChange(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* 提出エラーメッセージ */}
        {submitResult && !submitResult.success && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitResult.message}</AlertDescription>
          </Alert>
        )}
      </main>

      {/* 提出ボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 safe-area-inset-bottom">
        <div className="max-w-4xl mx-auto">
          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={data.progress.percentage < 100 || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                提出中...
              </>
            ) : data.progress.percentage < 100 ? (
              <>
                <Clock className="h-5 w-5 mr-2" />
                全ての項目に回答してください
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                自己評価を提出する
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// 評価項目カード
function EvaluationItemCard({
  item,
  onScoreChange,
}: {
  item: EvaluationItem;
  onScoreChange: (score: number) => void;
}) {
  const scores = Array.from({ length: item.maxScore }, (_, i) => i + 1);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium">{item.itemName}</p>
          {item.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {item.description}
            </p>
          )}
        </div>
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {item.selfScore !== null ? (
            <span className="text-emerald-600 font-medium">{item.selfScore}</span>
          ) : (
            <span>-</span>
          )}
          <span> / {item.maxScore}点</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {scores.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onScoreChange(score)}
            className={cn(
              "h-12 w-12 rounded-full font-bold text-lg transition-all duration-150",
              "border-2 hover:scale-105 active:scale-95",
              item.selfScore === score
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                : "bg-white text-slate-600 border-slate-200 hover:border-emerald-400"
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}
