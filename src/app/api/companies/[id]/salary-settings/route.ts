/**
 * 会社給与設定API
 * GET /api/companies/[id]/salary-settings - 給与設定取得
 * PUT /api/companies/[id]/salary-settings - 給与設定更新
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UpdateCompanySalarySettingsDto } from "@/types/company";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 給与設定取得
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

    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        salaryReflectionMonth: true,
        salaryReflectionDay: true,
        evaluationPeriodStart: true,
        evaluationPeriodEnd: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: "会社が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      salaryReflectionMonth: company.salaryReflectionMonth,
      salaryReflectionDay: company.salaryReflectionDay,
      evaluationPeriodStart: company.evaluationPeriodStart,
      evaluationPeriodEnd: company.evaluationPeriodEnd,
    });
  } catch (error) {
    console.error("給与設定取得エラー:", error);
    return NextResponse.json(
      { error: "給与設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * 給与設定更新
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

    const { id } = await context.params;
    const body = await request.json();

    // 会社存在確認
    const existingCompany = await prisma.company.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingCompany) {
      return NextResponse.json(
        { error: "会社が見つかりません" },
        { status: 404 }
      );
    }

    // バリデーション
    if (body.salaryReflectionMonth !== undefined && body.salaryReflectionMonth !== null) {
      const month = parseInt(body.salaryReflectionMonth, 10);
      if (isNaN(month) || month < 1 || month > 12) {
        return NextResponse.json(
          { error: "号俸反映月は1〜12の間で指定してください" },
          { status: 400 }
        );
      }
    }

    if (body.salaryReflectionDay !== undefined && body.salaryReflectionDay !== null) {
      const day = parseInt(body.salaryReflectionDay, 10);
      if (isNaN(day) || day < 1 || day > 31) {
        return NextResponse.json(
          { error: "号俸反映日は1〜31の間で指定してください" },
          { status: 400 }
        );
      }
    }

    const data: UpdateCompanySalarySettingsDto = {
      salaryReflectionMonth: body.salaryReflectionMonth !== undefined
        ? (body.salaryReflectionMonth === null ? null : parseInt(body.salaryReflectionMonth, 10))
        : undefined,
      salaryReflectionDay: body.salaryReflectionDay !== undefined
        ? (body.salaryReflectionDay === null ? null : parseInt(body.salaryReflectionDay, 10))
        : undefined,
      evaluationPeriodStart: body.evaluationPeriodStart !== undefined
        ? (body.evaluationPeriodStart ? new Date(body.evaluationPeriodStart) : null)
        : undefined,
      evaluationPeriodEnd: body.evaluationPeriodEnd !== undefined
        ? (body.evaluationPeriodEnd ? new Date(body.evaluationPeriodEnd) : null)
        : undefined,
    };

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(data.salaryReflectionMonth !== undefined && {
          salaryReflectionMonth: data.salaryReflectionMonth,
        }),
        ...(data.salaryReflectionDay !== undefined && {
          salaryReflectionDay: data.salaryReflectionDay,
        }),
        ...(data.evaluationPeriodStart !== undefined && {
          evaluationPeriodStart: data.evaluationPeriodStart,
        }),
        ...(data.evaluationPeriodEnd !== undefined && {
          evaluationPeriodEnd: data.evaluationPeriodEnd,
        }),
      },
      select: {
        salaryReflectionMonth: true,
        salaryReflectionDay: true,
        evaluationPeriodStart: true,
        evaluationPeriodEnd: true,
      },
    });

    return NextResponse.json({
      salaryReflectionMonth: company.salaryReflectionMonth,
      salaryReflectionDay: company.salaryReflectionDay,
      evaluationPeriodStart: company.evaluationPeriodStart,
      evaluationPeriodEnd: company.evaluationPeriodEnd,
    });
  } catch (error) {
    console.error("給与設定更新エラー:", error);
    return NextResponse.json(
      { error: "給与設定の更新に失敗しました" },
      { status: 500 }
    );
  }
}
