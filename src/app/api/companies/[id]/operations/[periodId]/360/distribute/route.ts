import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  sendEvaluation360RequestEmail,
  APP_URL,
} from "@/lib/email";
import { randomBytes } from "crypto";

/**
 * 360度評価配布API
 * POST: 評価フォームを評価者にメール送信し、アクセストークンを生成
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
    const { responseDeadline, employeeIds } = body as {
      responseDeadline: string;
      employeeIds?: string[];
    };

    if (!responseDeadline) {
      return NextResponse.json(
        { error: "回答期限が必要です" },
        { status: 400 }
      );
    }

    const deadline = new Date(responseDeadline);
    if (isNaN(deadline.getTime())) {
      return NextResponse.json(
        { error: "無効な回答期限です" },
        { status: 400 }
      );
    }

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

    // 配布対象の360度評価レコードを取得
    const records = await prisma.evaluation360Record.findMany({
      where: {
        companyId,
        evaluationPeriodId: periodId,
        status: { in: ["draft", "preparing_items", "preparing_reviewers", "ready"] },
        ...(employeeIds && employeeIds.length > 0
          ? { employeeId: { in: employeeIds } }
          : {}),
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

    if (records.length === 0) {
      return NextResponse.json(
        { error: "配布対象のレコードが見つかりません" },
        { status: 400 }
      );
    }

    // 評価者がアサインされていないレコードをチェック
    const recordsWithoutReviewers = records.filter(
      (r) => r.reviewerAssignments.length === 0
    );
    if (recordsWithoutReviewers.length > 0) {
      const names = recordsWithoutReviewers
        .map((r) => `${r.employee.lastName} ${r.employee.firstName}`)
        .join(", ");
      return NextResponse.json(
        {
          error: `評価者が設定されていない従業員がいます: ${names}`,
        },
        { status: 400 }
      );
    }

    // トークン有効期限（期日 + 3日）
    const tokenExpiry = new Date(deadline);
    tokenExpiry.setDate(tokenExpiry.getDate() + 3);

    // 評価者ごとに担当する被評価者をまとめる
    const reviewerAssignmentsMap = new Map<
      string,
      {
        reviewer: {
          id: string;
          firstName: string;
          lastName: string;
          email: string | null;
        };
        assignments: Array<{
          assignmentId: string;
          employeeName: string;
          recordId: string;
          existingToken: string | null;
        }>;
      }
    >();

    for (const record of records) {
      for (const assignment of record.reviewerAssignments) {
        const reviewerId = assignment.reviewer.id;
        if (!reviewerAssignmentsMap.has(reviewerId)) {
          reviewerAssignmentsMap.set(reviewerId, {
            reviewer: assignment.reviewer,
            assignments: [],
          });
        }
        reviewerAssignmentsMap.get(reviewerId)!.assignments.push({
          assignmentId: assignment.id,
          employeeName: `${record.employee.lastName} ${record.employee.firstName}`,
          recordId: record.id,
          existingToken: assignment.accessToken?.token || null,
        });
      }
    }

    const results = {
      totalReviewers: 0,
      emailsSent: 0,
      emailsFailed: 0,
      tokensCreated: 0,
      errors: [] as string[],
    };

    // 各評価者にメール送信
    for (const [, data] of reviewerAssignmentsMap) {
      results.totalReviewers++;
      const { reviewer, assignments } = data;

      if (!reviewer.email) {
        results.errors.push(
          `${reviewer.lastName} ${reviewer.firstName}: メールアドレスが設定されていません`
        );
        results.emailsFailed++;
        continue;
      }

      // 最初のアサインメントのトークンを使用（または新規作成）
      let accessToken = assignments[0].existingToken;

      if (!accessToken) {
        // 新しいトークンを生成
        accessToken = generateSecureToken();

        // 最初のアサインメントにトークンを作成
        try {
          await prisma.evaluation360AccessToken.create({
            data: {
              token: accessToken,
              reviewerAssignmentId: assignments[0].assignmentId,
              expiresAt: tokenExpiry,
            },
          });
          results.tokensCreated++;
        } catch (error) {
          console.error("Token creation error:", error);
          results.errors.push(
            `${reviewer.lastName} ${reviewer.firstName}: トークン生成に失敗しました`
          );
          results.emailsFailed++;
          continue;
        }
      }

      // メール送信
      const accessUrl = `${APP_URL}/public/360/${accessToken}`;

      try {
        const emailResult = await sendEvaluation360RequestEmail({
          reviewerName: `${reviewer.lastName} ${reviewer.firstName}`,
          reviewerEmail: reviewer.email,
          targetEmployees: assignments.map((a) => ({ name: a.employeeName })),
          deadline,
          accessUrl,
          companyName: company.name,
        });

        if (emailResult.success) {
          results.emailsSent++;

          // メール送信日時を更新
          await prisma.evaluation360ReviewerAssignment.updateMany({
            where: {
              id: { in: assignments.map((a) => a.assignmentId) },
            },
            data: {
              emailSentAt: new Date(),
            },
          });
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
        console.error("Email send error:", error);
      }
    }

    // レコードのステータスと配布情報を更新
    await prisma.evaluation360Record.updateMany({
      where: {
        id: { in: records.map((r) => r.id) },
      },
      data: {
        status: "distributing",
        responseDeadline: deadline,
        distributedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `${results.emailsSent}名の評価者にメールを送信しました`,
      ...results,
      recordsDistributed: records.length,
    });
  } catch (error) {
    console.error("360度評価配布エラー:", error);
    return NextResponse.json(
      { error: "配布処理に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * セキュアなトークンを生成
 */
function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}
