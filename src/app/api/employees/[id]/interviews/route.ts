/**
 * 面談記録API
 * GET /api/employees/[id]/interviews - 面談記録一覧取得
 * POST /api/employees/[id]/interviews - 面談記録作成
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CreateInterviewRecordDto } from "@/types/employee";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 面談記録一覧取得
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

    const records = await prisma.interviewRecord.findMany({
      where: { employeeId: id },
      orderBy: { interviewDate: "desc" },
    });

    return NextResponse.json({
      records,
      total: records.length,
    });
  } catch (error) {
    console.error("面談記録一覧取得エラー:", error);
    return NextResponse.json(
      { error: "面談記録の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * 面談記録作成
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

    // バリデーション
    if (!body.interviewDate) {
      return NextResponse.json(
        { error: "面談日は必須です" },
        { status: 400 }
      );
    }

    const data: CreateInterviewRecordDto = {
      employeeId: id,
      interviewDate: body.interviewDate,
      notes: body.notes || null,
      documentUrl: body.documentUrl || null,
    };

    const record = await prisma.interviewRecord.create({
      data: {
        employeeId: data.employeeId,
        interviewDate: new Date(data.interviewDate),
        notes: data.notes,
        documentUrl: data.documentUrl,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("面談記録作成エラー:", error);
    return NextResponse.json(
      { error: "面談記録の作成に失敗しました" },
      { status: 500 }
    );
  }
}
