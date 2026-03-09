/**
 * 給与履歴API
 * GET /api/employees/[id]/salary-history - 給与変遷履歴取得
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 給与変遷履歴取得
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

    // 従業員存在確認
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      );
    }

    // 給与履歴を取得
    const salaryHistory = await prisma.employeeSalary.findMany({
      where: { employeeId: id },
      include: {
        salaryTableEntry: {
          select: {
            stepNumber: true,
            rank: true,
            baseSalary: true,
            grade: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { effectiveDate: "asc" },
    });

    // レスポンス形式に変換
    const history = salaryHistory.map((item) => ({
      id: item.id,
      effectiveDate: item.effectiveDate,
      baseSalary: item.baseSalary,
      stepNumber: item.salaryTableEntry?.stepNumber ?? null,
      rank: item.salaryTableEntry?.rank ?? null,
      gradeName: item.salaryTableEntry?.grade?.name ?? null,
      reason: item.reason ?? null,
    }));

    return NextResponse.json({
      history,
    });
  } catch (error) {
    console.error("給与履歴取得エラー:", error);
    return NextResponse.json(
      { error: "給与履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}
