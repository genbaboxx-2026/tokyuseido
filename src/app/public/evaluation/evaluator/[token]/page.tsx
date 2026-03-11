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
  Lock,
  Users,
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
import { Input } from "@/components/ui/input";
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

interface EmployeeEvaluation {
  evaluationId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string | null;
  grade: string | null;
  jobType: string | null;
  deadline: string | null;
  isCompleted: boolean;
  categories: Category[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  evaluatorComment: string | null;
}

interface EvaluatorData {
  evaluator: {
    id: string;
    firstName: string;
    lastName: string;
  };
  company: {
    id: string;
    name: string;
  } | null;
  period: {
    id: string;
    name: string;
  } | null;
  employees: EmployeeEvaluation[];
  overallProgress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

export default function EvaluatorPortal({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [submitResult, setSubmitResult] = useState<Record<string, { success: boolean; message: string }>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  // デバウンス用のタイマー参照
  const saveTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  // パスワード検証
  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyError(null);

    try {
      const res = await fetch(`/api/public/evaluation/evaluator/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "認証に失敗しました");
      }

      setIsVerified(true);
    } catch (error) {
      setVerifyError(error instanceof Error ? error.message : "認証に失敗しました");
    } finally {
      setIsVerifying(false);
    }
  };

  // 評価データを取得
  const { data, isLoading, error } = useQuery<EvaluatorData>({
    queryKey: ["publicEvaluator", token, password],
    queryFn: async () => {
      const res = await fetch(
        `/api/public/evaluation/evaluator/${token}/employees?password=${encodeURIComponent(password)}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "データの取得に失敗しました");
      }
      return res.json();
    },
    enabled: isVerified,
    refetchOnWindowFocus: false,
  });

  // データ読み込み後に最初の未完了従業員を展開
  useEffect(() => {
    if (data && !initialized) {
      const firstIncomplete = data.employees.find((e) => !e.isCompleted);
      if (firstIncomplete) {
        setExpandedIds(new Set([firstIncomplete.employeeId]));
      }
      // コメントの初期値を設定
      const initialComments: Record<string, string> = {};
      for (const emp of data.employees) {
        if (emp.evaluatorComment) {
          initialComments[emp.employeeId] = emp.evaluatorComment;
        }
      }
      setComments(initialComments);
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
      employeeId,
      itemId,
      evaluatorScore,
      evaluatorComment,
    }: {
      employeeId: string;
      itemId?: string;
      evaluatorScore?: number;
      evaluatorComment?: string;
    }) => {
      const res = await fetch(
        `/api/public/evaluation/evaluator/${token}/${employeeId}/scores`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password,
            scores: itemId !== undefined ? [{ itemId, evaluatorScore }] : [],
            evaluatorComment,
          }),
        }
      );
      if (!res.ok) {
        throw new Error("保存に失敗しました");
      }
      return res.json();
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["publicEvaluator", token, password] });
    },
  });

  // キャッシュを直接更新する関数
  const updateCacheScore = useCallback(
    (employeeId: string, itemId: string, score: number) => {
      queryClient.setQueryData<EvaluatorData>(
        ["publicEvaluator", token, password],
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            employees: oldData.employees.map((emp) => {
              if (emp.employeeId !== employeeId) return emp;

              let completed = 0;
              const updatedCategories = emp.categories.map((category) => ({
                ...category,
                items: category.items.map((item) => {
                  const newScore = item.id === itemId ? score : item.evaluatorScore;
                  if (newScore !== null) completed++;
                  return item.id === itemId
                    ? { ...item, evaluatorScore: score }
                    : item;
                }),
              }));

              const total = updatedCategories.reduce(
                (sum, cat) => sum + cat.items.length,
                0
              );

              return {
                ...emp,
                categories: updatedCategories,
                progress: {
                  total,
                  completed,
                  percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
                },
              };
            }),
          };
        }
      );
    },
    [queryClient, token, password]
  );

  // 提出mutation
  const submitMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const res = await fetch(
        `/api/public/evaluation/evaluator/${token}/${employeeId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "提出に失敗しました");
      }
      return res.json();
    },
    onSuccess: (result, employeeId) => {
      setSubmitResult((prev) => ({
        ...prev,
        [employeeId]: { success: true, message: result.message },
      }));
      queryClient.invalidateQueries({ queryKey: ["publicEvaluator", token, password] });
    },
    onError: (error: Error, employeeId) => {
      setSubmitResult((prev) => ({
        ...prev,
        [employeeId]: { success: false, message: error.message },
      }));
    },
  });

  // スコア変更ハンドラー
  const handleScoreChange = useCallback(
    (employeeId: string, itemId: string, score: number) => {
      const key = `${employeeId}-${itemId}`;

      updateCacheScore(employeeId, itemId, score);

      if (saveTimerRef.current[key]) {
        clearTimeout(saveTimerRef.current[key]);
      }

      saveTimerRef.current[key] = setTimeout(() => {
        saveScoreMutation.mutate({ employeeId, itemId, evaluatorScore: score });
        delete saveTimerRef.current[key];
      }, 300);
    },
    [saveScoreMutation, updateCacheScore]
  );

  // コメント変更ハンドラー
  const handleCommentChange = useCallback(
    (employeeId: string, comment: string) => {
      setComments((prev) => ({ ...prev, [employeeId]: comment }));

      const key = `comment-${employeeId}`;
      if (saveTimerRef.current[key]) {
        clearTimeout(saveTimerRef.current[key]);
      }

      saveTimerRef.current[key] = setTimeout(() => {
        saveScoreMutation.mutate({ employeeId, evaluatorComment: comment });
        delete saveTimerRef.current[key];
      }, 500);
    },
    [saveScoreMutation]
  );

  // 提出ハンドラー
  const handleSubmit = (employeeId: string) => {
    setSubmitResult((prev) => ({ ...prev, [employeeId]: { success: false, message: "" } }));
    submitMutation.mutate(employeeId);
  };

  // パスワード認証画面
  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              パスワード認証
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              メールに記載されたパスワードを入力してください。
            </p>
            <Input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            />
            {verifyError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{verifyError}</AlertDescription>
              </Alert>
            )}
            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={!password || isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  認証中...
                </>
              ) : (
                "認証"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  // 全員完了の場合
  const allCompleted = data.employees.every((e) => e.isCompleted);

  if (allCompleted && data.employees.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">全ての評価が完了しました</h2>
            <p className="text-muted-foreground mb-6">
              ご協力ありがとうございました。
            </p>
            <p className="text-sm text-muted-foreground">
              このページを閉じていただいて構いません。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* ヘッダー */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-amber-600 flex items-center gap-2">
                <Users className="h-5 w-5" />
                評価者ポータル
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {data.company?.name}
                {data.period && ` - ${data.period.name}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm flex items-center gap-1 justify-end">
                <User className="h-3 w-3" />
                {data.evaluator.lastName} {data.evaluator.firstName} 様
              </p>
              <p className="text-sm text-muted-foreground">
                評価対象: {data.employees.length}名
              </p>
            </div>
          </div>

          {/* 全体進捗 */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>全体の進捗</span>
              <span className="font-medium">
                {data.overallProgress.completed}/{data.overallProgress.total}名完了
              </span>
            </div>
            <Progress value={data.overallProgress.percentage} className="h-2" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 対象者リスト */}
        <div className="space-y-4">
          {data.employees.map((employee, index) => {
            const isExpanded = expandedIds.has(employee.employeeId);
            const result = submitResult[employee.employeeId];

            return (
              <Collapsible
                key={employee.employeeId}
                open={isExpanded}
                onOpenChange={() => toggleExpanded(employee.employeeId)}
              >
                {/* ヘッダー */}
                <CollapsibleTrigger asChild>
                  <Card
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-slate-50",
                      employee.isCompleted && "bg-green-50 border-green-200",
                      isExpanded && !employee.isCompleted && "border-amber-400"
                    )}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center text-white font-bold",
                            employee.isCompleted
                              ? "bg-green-500"
                              : employee.progress.percentage === 100
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          )}
                        >
                          {employee.isCompleted ? (
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
                            {employee.department && <span>{employee.department}</span>}
                            {employee.grade && <span>{employee.grade}</span>}
                            {employee.jobType && <span>{employee.jobType}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {employee.isCompleted ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              提出済み
                            </Badge>
                          ) : employee.progress.percentage === 100 ? (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                              入力完了
                            </Badge>
                          ) : employee.progress.completed === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              未着手
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              入力中 {employee.progress.percentage}%
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

                {/* 評価項目 */}
                <CollapsibleContent>
                  {employee.isCompleted ? (
                    <Card className="mt-2 border-green-200 bg-green-50/50">
                      <CardContent className="py-6 text-center">
                        <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
                        <p className="text-green-700 font-medium">評価は完了しています</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {/* 評価項目一覧 */}
                      {employee.categories.map((category) => {
                        const categorySelfScore = category.items.reduce(
                          (sum, item) => sum + (item.selfScore || 0),
                          0
                        );
                        const categoryEvaluatorScore = category.items.reduce(
                          (sum, item) => sum + (item.evaluatorScore || 0),
                          0
                        );
                        const categoryMaxScore = category.items.reduce(
                          (sum, item) => sum + item.maxScore,
                          0
                        );

                        return (
                          <Card key={category.name}>
                            <CardHeader className="pb-2 pt-4">
                              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ChevronRight className="h-4 w-4" />
                                  {category.name}
                                </div>
                                <div className="flex gap-4 text-xs">
                                  <span className="text-blue-600">
                                    自己: {categorySelfScore}/{categoryMaxScore}
                                  </span>
                                  <span className="text-amber-600 font-medium">
                                    評価: {categoryEvaluatorScore}/{categoryMaxScore}
                                  </span>
                                </div>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-0">
                              {category.items.map((item) => (
                                <EvaluatorItemCard
                                  key={item.id}
                                  item={item}
                                  onScoreChange={(score) =>
                                    handleScoreChange(employee.employeeId, item.id, score)
                                  }
                                />
                              ))}
                            </CardContent>
                          </Card>
                        );
                      })}

                      {/* 評価者コメント */}
                      <Card>
                        <CardHeader className="pb-2 pt-4">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            評価者コメント（任意）
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Textarea
                            placeholder="評価に関するコメントがあれば入力してください"
                            value={comments[employee.employeeId] || ""}
                            onChange={(e) =>
                              handleCommentChange(employee.employeeId, e.target.value)
                            }
                            rows={3}
                          />
                        </CardContent>
                      </Card>

                      {/* 提出ボタン */}
                      <Card className="border-amber-200 bg-amber-50/50">
                        <CardContent className="py-4">
                          {result?.success === false && result.message && (
                            <Alert variant="destructive" className="mb-4">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{result.message}</AlertDescription>
                            </Alert>
                          )}
                          <Button
                            className="w-full bg-amber-600 hover:bg-amber-700"
                            disabled={
                              employee.progress.percentage < 100 ||
                              submitMutation.isPending
                            }
                            onClick={() => handleSubmit(employee.employeeId)}
                          >
                            {submitMutation.isPending &&
                            submitMutation.variables === employee.employeeId ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                提出中...
                              </>
                            ) : employee.progress.percentage < 100 ? (
                              <>
                                <Clock className="h-5 w-5 mr-2" />
                                全ての項目に評価を入力してください
                              </>
                            ) : (
                              <>
                                <Send className="h-5 w-5 mr-2" />
                                {employee.lastName}さんの評価を提出する
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// 評価者用項目カード
function EvaluatorItemCard({
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
        <div className="text-sm whitespace-nowrap flex gap-3">
          <div className="text-center">
            <div className="text-blue-600 font-medium">
              {item.selfScore !== null ? item.selfScore : "-"}
            </div>
            <div className="text-[10px] text-muted-foreground">自己</div>
          </div>
          <div className="text-center">
            <div className="text-amber-600 font-medium">
              {item.evaluatorScore !== null ? item.evaluatorScore : "-"}
            </div>
            <div className="text-[10px] text-muted-foreground">評価</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">{item.maxScore}</div>
            <div className="text-[10px] text-muted-foreground">満点</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {scores.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onScoreChange(score)}
            className={cn(
              "h-10 w-10 rounded-full font-bold transition-all duration-150",
              "border-2 hover:scale-105 active:scale-95",
              item.evaluatorScore === score
                ? "bg-amber-500 text-white border-amber-500 shadow-md"
                : "bg-white text-slate-600 border-slate-200 hover:border-amber-400"
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}
