import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 公開360度評価スコア保存API（認証不要）
 * PUT: スコアを保存（自動保存用）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { assignmentId, itemId, score, comment } = body as {
      assignmentId: string;
      itemId: string;
      score?: number | null;
      comment?: string | null;
    };

    if (!assignmentId || !itemId) {
      return NextResponse.json(
        { error: "assignmentIdとitemIdが必要です" },
        { status: 400 }
      );
    }

    // トークンを検証
    const accessToken = await prisma.evaluation360AccessToken.findUnique({
      where: { token },
      include: {
        reviewerAssignment: {
          select: {
            reviewerId: true,
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

    // アサインメントがこの評価者のものか確認
    const assignment = await prisma.evaluation360ReviewerAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        reviewerId: true,
        status: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "アサインメントが見つかりません" },
        { status: 404 }
      );
    }

    if (assignment.reviewerId !== accessToken.reviewerAssignment.reviewerId) {
      return NextResponse.json(
        { error: "このアサインメントにアクセスする権限がありません" },
        { status: 403 }
      );
    }

    // 既に提出済みの場合は更新不可
    if (assignment.status === "submitted") {
      return NextResponse.json(
        { error: "既に提出済みです" },
        { status: 400 }
      );
    }

    // スコアをupsert
    const existingScore = await prisma.evaluation360Score.findUnique({
      where: {
        evaluationCustomItemId_reviewerAssignmentId: {
          evaluationCustomItemId: itemId,
          reviewerAssignmentId: assignmentId,
        },
      },
    });

    if (existingScore) {
      await prisma.evaluation360Score.update({
        where: { id: existingScore.id },
        data: {
          score: score ?? existingScore.score,
          comment: comment ?? existingScore.comment,
        },
      });
    } else {
      await prisma.evaluation360Score.create({
        data: {
          evaluationCustomItemId: itemId,
          reviewerAssignmentId: assignmentId,
          score,
          comment,
        },
      });
    }

    // アサインメントのステータスを進行中に更新（まだ開始していない場合）
    if (assignment.status === "not_started") {
      await prisma.evaluation360ReviewerAssignment.update({
        where: { id: assignmentId },
        data: { status: "in_progress" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("スコア保存エラー:", error);
    return NextResponse.json(
      { error: "スコアの保存に失敗しました" },
      { status: 500 }
    );
  }
}
