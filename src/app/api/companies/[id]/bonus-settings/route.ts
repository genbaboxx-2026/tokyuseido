/**
 * 賞与設定API
 * GET /api/companies/[id]/bonus-settings - 賞与設定一覧取得
 * POST /api/companies/[id]/bonus-settings - 賞与設定作成
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CreateBonusSettingDto } from "@/types/company";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 賞与設定一覧取得
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

    const { id } = await context.params;

    // 会社存在確認
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json(
        { error: "会社が見つかりません" },
        { status: 404 }
      );
    }

    const bonusSettings = await prisma.bonusSetting.findMany({
      where: { companyId: id },
      orderBy: { paymentDate: "asc" },
    });

    return NextResponse.json({
      bonusSettings,
    });
  } catch (error) {
    console.error("賞与設定一覧取得エラー:", error);
    return NextResponse.json(
      { error: "賞与設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * 賞与設定作成
 */
export async function POST(
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

    const { id } = await context.params;
    const body = await request.json();

    // 会社存在確認
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json(
        { error: "会社が見つかりません" },
        { status: 404 }
      );
    }

    // バリデーション
    if (!body.name) {
      return NextResponse.json(
        { error: "賞与名は必須です" },
        { status: 400 }
      );
    }

    if (!body.assessmentStartDate || !body.assessmentEndDate) {
      return NextResponse.json(
        { error: "査定対象期間は必須です" },
        { status: 400 }
      );
    }

    if (!body.evaluationStartDate || !body.evaluationEndDate) {
      return NextResponse.json(
        { error: "評価実施期間は必須です" },
        { status: 400 }
      );
    }

    if (!body.paymentDate) {
      return NextResponse.json(
        { error: "支給日は必須です" },
        { status: 400 }
      );
    }

    const data: CreateBonusSettingDto = {
      companyId: id,
      name: body.name,
      assessmentStartDate: body.assessmentStartDate,
      assessmentEndDate: body.assessmentEndDate,
      evaluationStartDate: body.evaluationStartDate,
      evaluationEndDate: body.evaluationEndDate,
      paymentDate: body.paymentDate,
    };

    const bonusSetting = await prisma.bonusSetting.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        assessmentStartDate: new Date(data.assessmentStartDate),
        assessmentEndDate: new Date(data.assessmentEndDate),
        evaluationStartDate: new Date(data.evaluationStartDate),
        evaluationEndDate: new Date(data.evaluationEndDate),
        paymentDate: new Date(data.paymentDate),
      },
    });

    return NextResponse.json(bonusSetting, { status: 201 });
  } catch (error) {
    console.error("賞与設定作成エラー:", error);
    return NextResponse.json(
      { error: "賞与設定の作成に失敗しました" },
      { status: 500 }
    );
  }
}
