"use client";

import React, { useState, useCallback, use, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Send,
  User,
  Building2,
  Calendar,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface EvaluationItem {
  id: string;
  itemName: string;
  description: string | null;
  maxScore: number;
  sortOrder: number;
  score: number | null;
  comment: string | null;
}

interface Category {
  name: string;
  sortOrder: number;
  items: EvaluationItem[];
}

interface TargetEmployee {
  id: string;
  assignmentId: string;
  firstName: string;
  lastName: string;
  department: string | null;
  grade: string | null;
  jobType: string | null;
  status: string;
  categories: Category[];
  progress: number;
  totalItems: number;
  answeredItems: number;
}

interface EvaluationData {
  reviewer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  company: {
    id: string;
    name: string;
  };
  period: {
    id: string;
    name: string;
  };
  deadline: string | null;
  isAnonymous: boolean;
  targetEmployees: TargetEmployee[];
  overallProgress: number;
}

export default function PublicEvaluationForm({
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

  // 展開状態を管理
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // 評価データを取得
  const { data, isLoading, error } = useQuery<EvaluationData>({
    queryKey: ["public360", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/360/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "データの取得に失敗しました");
      }
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  // デバウンス用のタイマー参照
  const saveTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  // データ読み込み後に最初の未完了従業員を展開
  useEffect(() => {
    if (data && !initialized) {
      const firstIncomplete = data.targetEmployees.find((e) => e.status !== "submitted");
      if (firstIncomplete) {
        setExpandedIds(new Set([firstIncomplete.id]));
      }
      setInitialized(true);
    }
  }, [data, initialized]);

  // 展開/折りたたみ切り替え
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // スコア保存mutation
  const saveScoreMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      itemId,
      score,
    }: {
      assignmentId: string;
      itemId: string;
      score: number;
    }) => {
      const res = await fetch(`/api/public/360/${token}/scores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, itemId, score }),
      });
      if (!res.ok) {
        throw new Error("保存に失敗しました");
      }
      return res.json();
    },
    onError: () => {
      // エラー時のみ最新データを取得（UIを正しい状態に戻す）
      queryClient.invalidateQueries({ queryKey: ["public360", token] });
    },
  });

  // キャッシュを直接更新する関数
  const updateCacheScore = useCallback(
    (assignmentId: string, itemId: string, score: number) => {
      queryClient.setQueryData<EvaluationData>(["public360", token], (oldData) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          targetEmployees: oldData.targetEmployees.map((employee) => {
            if (employee.assignmentId !== assignmentId) return employee;

            let answeredItems = 0;
            const updatedCategories = employee.categories.map((category) => ({
              ...category,
              items: category.items.map((item) => {
                const newScore = item.id === itemId ? score : item.score;
                if (newScore !== null) answeredItems++;
                return item.id === itemId ? { ...item, score } : item;
              }),
            }));

            const totalItems = employee.totalItems;
            const progress = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;

            return {
              ...employee,
              categories: updatedCategories,
              answeredItems,
              progress,
            };
          }),
          overallProgress: calculateOverallProgress(oldData.targetEmployees, assignmentId, itemId, score),
        };
      });
    },
    [queryClient, token]
  );

  // 全体進捗を計算
  const calculateOverallProgress = (
    employees: TargetEmployee[],
    updatedAssignmentId: string,
    updatedItemId: string,
    newScore: number
  ): number => {
    let totalAnswered = 0;
    let totalItems = 0;

    for (const employee of employees) {
      for (const category of employee.categories) {
        for (const item of category.items) {
          totalItems++;
          if (employee.assignmentId === updatedAssignmentId && item.id === updatedItemId) {
            if (newScore !== null) totalAnswered++;
          } else if (item.score !== null) {
            totalAnswered++;
          }
        }
      }
    }

    return totalItems > 0 ? Math.round((totalAnswered / totalItems) * 100) : 0;
  };

  // 提出mutation
  const submitMutation = useMutation({
    mutationFn: async (assignmentIds?: string[]) => {
      const res = await fetch(`/api/public/360/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "提出に失敗しました");
      }
      return res.json();
    },
    onSuccess: (result) => {
      setSubmitResult({
        success: result.totalFailed === 0,
        message: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ["public360", token] });
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

  // スコア変更ハンドラー（キャッシュ直接更新 + デバウンス）
  const handleScoreChange = useCallback(
    (assignmentId: string, itemId: string, score: number) => {
      const key = `${assignmentId}-${itemId}`;

      // 即座にキャッシュを更新（UIに即反映）
      updateCacheScore(assignmentId, itemId, score);

      // 既存のタイマーをクリア
      if (saveTimerRef.current[key]) {
        clearTimeout(saveTimerRef.current[key]);
      }

      // デバウンス: 300ms後にAPI呼び出し
      saveTimerRef.current[key] = setTimeout(() => {
        saveScoreMutation.mutate({ assignmentId, itemId, score });
        delete saveTimerRef.current[key];
      }, 300);
    },
    [saveScoreMutation, updateCacheScore]
  );

  // 提出ハンドラー
  const handleSubmit = () => {
    setIsSubmitting(true);
    setSubmitResult(null);
    submitMutation.mutate(undefined);
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

  // 全員提出済みの場合は完了画面
  const allSubmitted = data.targetEmployees.every(
    (e) => e.status === "submitted"
  );

  if (allSubmitted || submitResult?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">評価完了</h2>
            <p className="text-muted-foreground mb-6">
              360度評価へのご協力ありがとうございました。
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
              <h1 className="text-lg font-bold text-primary">360度評価</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {data.company.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm flex items-center gap-1 justify-end">
                <User className="h-3 w-3" />
                {data.reviewer.lastName} {data.reviewer.firstName} 様
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
              <span>全体の進捗</span>
              <span className="font-medium">{data.overallProgress}%</span>
            </div>
            <Progress value={data.overallProgress} className="h-2" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 対象者リスト（アコーディオン形式） */}
        <div className="space-y-4">
          {data.targetEmployees.map((employee, index) => {
            const isComplete = employee.status === "submitted";
            const isFullyAnswered = employee.progress === 100;
            const isExpanded = expandedIds.has(employee.id);

            return (
              <Collapsible
                key={employee.id}
                open={isExpanded}
                onOpenChange={() => toggleExpanded(employee.id)}
              >
                {/* ヘッダー（クリックで展開/折りたたみ） */}
                <CollapsibleTrigger asChild>
                  <Card
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-slate-50",
                      isComplete && "bg-green-50 border-green-200",
                      isExpanded && !isComplete && "border-primary"
                    )}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center text-white font-bold",
                            isComplete
                              ? "bg-green-500"
                              : isFullyAnswered
                              ? "bg-blue-500"
                              : "bg-slate-400"
                          )}
                        >
                          {isComplete ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold">
                            {employee.lastName} {employee.firstName}
                          </h3>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-2">
                            {employee.department && (
                              <span>{employee.department}</span>
                            )}
                            {employee.grade && <span>{employee.grade}</span>}
                            {employee.jobType && <span>{employee.jobType}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isComplete ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              提出済み
                            </Badge>
                          ) : isFullyAnswered ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                              回答完了
                            </Badge>
                          ) : employee.answeredItems === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              未着手
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              回答中
                            </Badge>
                          )}
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleTrigger>

                {/* 評価項目（展開時のみ表示） */}
                <CollapsibleContent>
                  {isComplete ? (
                    <Card className="mt-2 border-green-200 bg-green-50/50">
                      <CardContent className="py-6 text-center">
                        <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
                        <p className="text-green-700 font-medium">
                          評価は完了しています
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {/* スティッキーヘッダー：現在評価中の従業員名 */}
                      <div className="sticky top-[120px] z-10 bg-primary text-primary-foreground py-2 px-4 rounded-lg shadow-md flex items-center justify-between -mx-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">
                            {employee.lastName} {employee.firstName} さんを評価中
                          </span>
                        </div>
                        <span className="text-sm opacity-90">
                          {employee.answeredItems}/{employee.totalItems}問
                        </span>
                      </div>
                      {employee.categories.map((category) => {
                        const categoryCurrentScore = category.items.reduce(
                          (sum, item) => sum + (item.score || 0),
                          0
                        );
                        const categoryMaxScore = category.items.reduce(
                          (sum, item) => sum + item.maxScore,
                          0
                        );
                        const categoryAnswered = category.items.filter(
                          (item) => item.score !== null
                        ).length;

                        return (
                        <Card key={category.name}>
                          <CardHeader className="pb-2 pt-4">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ChevronRight className="h-4 w-4" />
                                {category.name}
                              </div>
                              <span className={cn(
                                "font-medium",
                                categoryAnswered === category.items.length
                                  ? "text-primary"
                                  : "text-foreground"
                              )}>
                                {categoryCurrentScore}/{categoryMaxScore}点
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 pt-0">
                            {category.items.map((item) => (
                              <EvaluationItemCard
                                key={item.id}
                                item={item}
                                maxScore={item.maxScore}
                                currentScore={item.score}
                                onScoreChange={(score) =>
                                  handleScoreChange(
                                    employee.assignmentId,
                                    item.id,
                                    score
                                  )
                                }
                              />
                            ))}
                          </CardContent>
                        </Card>
                        );
                      })}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* 提出エラーメッセージ */}
        {submitResult && !submitResult.success && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitResult.message}</AlertDescription>
          </Alert>
        )}
      </main>

      {/* 提出ボタン（フローティング） */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 safe-area-inset-bottom">
        <div className="max-w-4xl mx-auto">
          <Button
            size="lg"
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={data.overallProgress < 100 || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                提出中...
              </>
            ) : data.overallProgress < 100 ? (
              <>
                <Clock className="h-5 w-5 mr-2" />
                全ての項目に回答してください
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                評価を提出する
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
  maxScore,
  currentScore,
  onScoreChange,
}: {
  item: EvaluationItem;
  maxScore: number;
  currentScore: number | null;
  onScoreChange: (score: number) => void;
}) {
  const scores = Array.from({ length: maxScore }, (_, i) => i + 1);

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
          {currentScore !== null ? (
            <span className="text-primary font-medium">{currentScore}</span>
          ) : (
            <span>-</span>
          )}
          <span> / {maxScore}点</span>
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
              currentScore === score
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"
            )}
          >
            {score}
          </button>
        ))}
      </div>

    </div>
  );
}
