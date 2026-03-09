import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 公開360度評価提出API（認証不要）
 * POST: 全評価を提出
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { assignmentIds } = body as { assignmentIds?: string[] };

    // トークンを検証
    const accessToken = await prisma.evaluation360AccessToken.findUnique({
      where: { token },
      include: {
        reviewerAssignment: {
          include: {
            record: {
              select: {
                companyId: true,
                evaluationPeriodId: true,
              },
            },
            reviewer: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!accessToken) {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 404 }
      );
    }

    // トークンの有効期限をチェック
    if (accessToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "このリンクは期限切れです" },
        { status: 410 }
      );
    }

    const { record, reviewer } = accessToken.reviewerAssignment;

    // この評価者の全アサインメントを取得
    const allAssignments = await prisma.evaluation360ReviewerAssignment.findMany({
      where: {
        reviewerId: reviewer.id,
        record: {
          companyId: record.companyId,
          evaluationPeriodId: record.evaluationPeriodId,
          status: { in: ["distributing", "collecting"] },
        },
        // 特定のアサインメントIDが指定されている場合はフィルタ
        ...(assignmentIds && assignmentIds.length > 0
          ? { id: { in: assignmentIds } }
          : {}),
      },
      include: {
        record: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        scores: true,
      },
    });

    // 各アサインメントの評価項目数を取得して完了チェック
    const results: Array<{
      assignmentId: string;
      employeeName: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const assignment of allAssignments) {
      // 既に提出済みならスキップ
      if (assignment.status === "submitted") {
        results.push({
          assignmentId: assignment.id,
          employeeName: `${assignment.record.employee.lastName} ${assignment.record.employee.firstName}`,
          success: true,
        });
        continue;
      }

      // 評価項目数を取得
      const itemCount = await prisma.evaluationCustomItem.count({
        where: {
          companyId: record.companyId,
          employeeId: assignment.record.employeeId,
          periodId: record.evaluationPeriodId,
          evaluationType: "360",
          isDeleted: false,
        },
      });

      // スコア入力済みの項目数
      const answeredCount = assignment.scores.filter(
        (s) => s.score !== null
      ).length;

      // 全項目が回答されているかチェック
      if (answeredCount < itemCount) {
        results.push({
          assignmentId: assignment.id,
          employeeName: `${assignment.record.employee.lastName} ${assignment.record.employee.firstName}`,
          success: false,
          error: `未回答の項目があります（${answeredCount}/${itemCount}）`,
        });
        continue;
      }

      // 提出処理
      await prisma.evaluation360ReviewerAssignment.update({
        where: { id: assignment.id },
        data: {
          status: "submitted",
          submittedAt: new Date(),
        },
      });

      results.push({
        assignmentId: assignment.id,
        employeeName: `${assignment.record.employee.lastName} ${assignment.record.employee.firstName}`,
        success: true,
      });

      // レコードの進捗を確認し、全員完了なら collecting に更新
      const recordAssignments = await prisma.evaluation360ReviewerAssignment.findMany({
        where: { recordId: assignment.record.id },
        select: { status: true },
      });

      const allSubmitted = recordAssignments.every(
        (ra) => ra.status === "submitted"
      );

      if (allSubmitted) {
        await prisma.evaluation360Record.update({
          where: { id: assignment.record.id },
          data: { status: "collecting" },
        });
      }
    }

    // トークン使用日時を記録
    if (!accessToken.usedAt) {
      await prisma.evaluation360AccessToken.update({
        where: { id: accessToken.id },
        data: { usedAt: new Date() },
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      message:
        failedCount === 0
          ? "全ての評価を提出しました"
          : `${successCount}件提出完了、${failedCount}件未完了`,
      results,
      totalSubmitted: successCount,
      totalFailed: failedCount,
    });
  } catch (error) {
    console.error("評価提出エラー:", error);
    return NextResponse.json(
      { error: "評価の提出に失敗しました" },
      { status: 500 }
    );
  }
}
