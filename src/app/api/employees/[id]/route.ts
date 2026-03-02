/**
 * 従業員API - 詳細取得・更新・削除
 * GET /api/employees/[id] - 従業員詳細取得
 * PUT /api/employees/[id] - 従業員更新
 * DELETE /api/employees/[id] - 従業員削除
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  checkEmployeeCodeExists,
} from "@/lib/employee";
import type { UpdateEmployeeDto } from "@/types/employee";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 従業員詳細取得
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
    const employee = await getEmployeeById(id);

    if (!employee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error("従業員詳細取得エラー:", error);
    return NextResponse.json(
      { error: "従業員詳細の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * 従業員更新
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

    // 従業員存在確認
    const existingEmployee = await getEmployeeById(id);
    if (!existingEmployee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      );
    }

    // バリデーション
    if (body.firstName !== undefined && !body.firstName) {
      return NextResponse.json(
        { error: "名は必須です" },
        { status: 400 }
      );
    }

    if (body.lastName !== undefined && !body.lastName) {
      return NextResponse.json(
        { error: "姓は必須です" },
        { status: 400 }
      );
    }

    const data: UpdateEmployeeDto = {
      firstName: body.firstName,
      lastName: body.lastName,
      gender: body.gender,
      birthDate: body.birthDate,
      hireDate: body.hireDate,
      departmentId: body.departmentId,
      employmentType: body.employmentType,
      jobTypeId: body.jobTypeId,
      gradeId: body.gradeId,
      positionId: body.positionId,
      currentStep: body.currentStep,
      currentRank: body.currentRank,
      baseSalary: body.baseSalary,
    };

    const employee = await updateEmployee(id, data);

    return NextResponse.json(employee);
  } catch (error) {
    console.error("従業員更新エラー:", error);
    return NextResponse.json(
      { error: "従業員の更新に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * 従業員削除
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

    const { id } = await context.params;

    // 従業員存在確認
    const existingEmployee = await getEmployeeById(id);
    if (!existingEmployee) {
      return NextResponse.json(
        { error: "従業員が見つかりません" },
        { status: 404 }
      );
    }

    await deleteEmployee(id);

    return NextResponse.json({ message: "従業員を削除しました" });
  } catch (error) {
    console.error("従業員削除エラー:", error);
    return NextResponse.json(
      { error: "従業員の削除に失敗しました" },
      { status: 500 }
    );
  }
}
