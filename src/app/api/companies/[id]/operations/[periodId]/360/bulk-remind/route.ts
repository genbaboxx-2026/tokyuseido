import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  sendEvaluation360ReminderEmail,
  APP_URL,
} from "@/lib/email";

/**
 * 360度評価リマインダー一括送信API
 * POST: 未提出の評価者にリマインダーメールを送信
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: companyId, periodId } = await params;
    const body = await request.json();
    const { reviewerIds } = body as { reviewerIds?: string[] };

    // 会社情報を取得
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    if (!company) {
      return NextResponse.json(
        { error: "会社が見つかりません" },
        { status: 404 }
      );
    }

    // 配布中の360度評価レコードを取得
    const records = await prisma.evaluation360Record.findMany({
      where: {
        companyId,
        evaluationPeriodId: periodId,
        status: { in: ["distributing", "collecting"] },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewerAssignments: {
          where: {
            status: { not: "submitted" },
            ...(reviewerIds && reviewerIds.length > 0
              ? { reviewerId: { in: reviewerIds } }
              : {}),
          },
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            accessToken: true,
          },
        },
      },
    });

    // 回答期限を取得（最初のレコードから）
    const deadline = records.find((r) => r.responseDeadline)?.responseDeadline;
    if (!deadline) {
      return NextResponse.json(
        { error: "回答期限が設定されていません" },
        { status: 400 }
      );
    }

    // 評価者ごとに担当する被評価者をまとめる
    const reviewerDataMap = new Map<
      string,
      {
        reviewer: {
          id: string;
          firstName: string;
          lastName: string;
          email: string | null;
        };
        assignments: Array<{
          employeeName: string;
          isCompleted: boolean;
          token: string | null;
        }>;
      }
    >();

    // 完了した評価も含めて全アサインメントを取得
    const allAssignments = await prisma.evaluation360ReviewerAssignment.findMany({
      where: {
        record: {
          companyId,
          evaluationPeriodId: periodId,
          status: { in: ["distributing", "collecting"] },
        },
        ...(reviewerIds && reviewerIds.length > 0
          ? { reviewerId: { in: reviewerIds } }
          : {}),
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        record: {
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        accessToken: true,
      },
    });

    // 評価者ごとにグループ化
    for (const assignment of allAssignments) {
      const reviewerId = assignment.reviewer.id;
      if (!reviewerDataMap.has(reviewerId)) {
        reviewerDataMap.set(reviewerId, {
          reviewer: assignment.reviewer,
          assignments: [],
        });
      }
      reviewerDataMap.get(reviewerId)!.assignments.push({
        employeeName: `${assignment.record.employee.lastName} ${assignment.record.employee.firstName}`,
        isCompleted: assignment.status === "submitted",
        token: assignment.accessToken?.token || null,
      });
    }

    // 未完了の評価がない評価者は除外
    const reviewersWithPending = Array.from(reviewerDataMap.entries()).filter(
      ([, data]) => data.assignments.some((a) => !a.isCompleted)
    );

    const results = {
      totalReviewers: reviewersWithPending.length,
      emailsSent: 0,
      emailsFailed: 0,
      errors: [] as string[],
    };

    // 各評価者にリマインダーメール送信
    for (const [, data] of reviewersWithPending) {
      const { reviewer, assignments } = data;

      if (!reviewer.email) {
        results.errors.push(
          `${reviewer.lastName} ${reviewer.firstName}: メールアドレスが設定されていません`
        );
        results.emailsFailed++;
        continue;
      }

      // トークンを取得（最初のアサインメントから）
      const token = assignments.find((a) => a.token)?.token;
      if (!token) {
        results.errors.push(
          `${reviewer.lastName} ${reviewer.firstName}: アクセストークンが見つかりません`
        );
        results.emailsFailed++;
        continue;
      }

      const accessUrl = `${APP_URL}/public/360/${token}`;

      try {
        const emailResult = await sendEvaluation360ReminderEmail({
          reviewerName: `${reviewer.lastName} ${reviewer.firstName}`,
          reviewerEmail: reviewer.email,
          targetEmployees: assignments.map((a) => ({
            name: a.employeeName,
            isCompleted: a.isCompleted,
          })),
          deadline,
          accessUrl,
          companyName: company.name,
        });

        if (emailResult.success) {
          results.emailsSent++;
        } else {
          results.emailsFailed++;
          results.errors.push(
            `${reviewer.lastName} ${reviewer.firstName}: ${emailResult.error}`
          );
        }
      } catch (error) {
        results.emailsFailed++;
        results.errors.push(
          `${reviewer.lastName} ${reviewer.firstName}: メール送信中にエラーが発生しました`
        );
        console.error("Reminder email send error:", error);
      }
    }

    return NextResponse.json({
      success: true,
      message:
        results.emailsSent > 0
          ? `${results.emailsSent}名の評価者にリマインダーを送信しました`
          : "リマインダーの送信対象がありませんでした",
      ...results,
    });
  } catch (error) {
    console.error("360度評価リマインダー送信エラー:", error);
    return NextResponse.json(
      { error: "リマインダー送信に失敗しました" },
      { status: 500 }
    );
  }
}
