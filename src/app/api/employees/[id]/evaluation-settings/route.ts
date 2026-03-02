/**
 * 従業員評価設定API
 * PATCH /api/employees/[id]/evaluation-settings - 評価有無の更新
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 評価有無の更新
 */
export async function PATCH(
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

    // 従業員存在確認
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      );
    }

    // 更新データの準備
    const updateData: {
      has360Evaluation?: boolean;
      hasIndividualEvaluation?: boolean;
    } = {};

    if (typeof body.has360Evaluation === "boolean") {
      updateData.has360Evaluation = body.has360Evaluation;
    }

    if (typeof body.hasIndividualEvaluation === "boolean") {
      updateData.hasIndividualEvaluation = body.hasIndividualEvaluation;
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        has360Evaluation: true,
        hasIndividualEvaluation: true,
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error("評価設定更新エラー:", error);
    return NextResponse.json(
      { error: "評価設定の更新に失敗しました" },
      { status: 500 }
    );
  }
}
