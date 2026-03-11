/**
 * 賞与設定詳細API
 * GET /api/companies/[id]/bonus-settings/[bonusId] - 賞与設定詳細取得
 * PUT /api/companies/[id]/bonus-settings/[bonusId] - 賞与設定更新
 * DELETE /api/companies/[id]/bonus-settings/[bonusId] - 賞与設定削除
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string; bonusId: string }>;
};

/**
 * 賞与設定詳細取得
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { id, bonusId } = await context.params;

    const bonusSetting = await prisma.bonusSetting.findFirst({
      where: {
        id: bonusId,
        companyId: id,
      },
    });

    if (!bonusSetting) {
      return NextResponse.json(
        { error: "賞与設定が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(bonusSetting);
  } catch (error) {
    console.error("賞与設定詳細取得エラー:", error);
    return NextResponse.json(
      { error: "賞与設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * 賞与設定更新
 */
export async function PUT(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { id, bonusId } = await context.params;
    const body = await request.json();

    // 賞与設定存在確認
    const existingBonusSetting = await prisma.bonusSetting.findFirst({
      where: {
        id: bonusId,
        companyId: id,
      },
    });

    if (!existingBonusSetting) {
      return NextResponse.json(
        { error: "賞与設定が見つかりません" },
        { status: 404 }
      );
    }

    const bonusSetting = await prisma.bonusSetting.update({
      where: { id: bonusId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.assessmentStartDate !== undefined && {
          assessmentStartDate: new Date(body.assessmentStartDate),
        }),
        ...(body.assessmentEndDate !== undefined && {
          assessmentEndDate: new Date(body.assessmentEndDate),
        }),
        ...(body.paymentDate !== undefined && {
          paymentDate: new Date(body.paymentDate),
        }),
      },
    });

    return NextResponse.json(bonusSetting);
  } catch (error) {
    console.error("賞与設定更新エラー:", error);
    return NextResponse.json(
      { error: "賞与設定の更新に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * 賞与設定削除
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { id, bonusId } = await context.params;

    // 賞与設定存在確認
    const existingBonusSetting = await prisma.bonusSetting.findFirst({
      where: {
        id: bonusId,
        companyId: id,
      },
    });

    if (!existingBonusSetting) {
      return NextResponse.json(
        { error: "賞与設定が見つかりません" },
        { status: 404 }
      );
    }

    await prisma.bonusSetting.delete({
      where: { id: bonusId },
    });

    return NextResponse.json({ message: "賞与設定を削除しました" });
  } catch (error) {
    console.error("賞与設定削除エラー:", error);
    return NextResponse.json(
      { error: "賞与設定の削除に失敗しました" },
      { status: 500 }
    );
  }
}
