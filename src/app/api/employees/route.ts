/**
 * 従業員API - 一覧取得・作成
 * GET /api/employees - 従業員一覧取得
 * POST /api/employees - 従業員作成
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getEmployees,
  createEmployee,
  checkEmployeeCodeExists,
} from "@/lib/employee";
import type { CreateEmployeeDto, EmploymentType, EmployeeStatus } from "@/types/employee";

/**
 * 従業員一覧取得
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyIdは必須です" },
        { status: 400 }
      );
    }

    const query = {
      companyId,
      keyword: searchParams.get("search") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
      gradeId: searchParams.get("gradeId") || undefined,
      jobTypeId: searchParams.get("jobTypeId") || undefined,
      employmentType: searchParams.get("employmentType") as EmploymentType || undefined,
      positionId: searchParams.get("positionId") || undefined,
      status: searchParams.get("status") as EmployeeStatus || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
      sortBy: (searchParams.get("sortBy") || "employeeCode") as
        | "employeeCode"
        | "lastName"
        | "hireDate"
        | "gradeLevel"
        | "baseSalary"
        | "createdAt",
      sortOrder: (searchParams.get("sortOrder") || "asc") as "asc" | "desc",
    };

    const result = await getEmployees(query);

    return NextResponse.json(result);
  } catch (error) {
    console.error("従業員一覧取得エラー:", error);
    return NextResponse.json(
      { error: "従業員一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * 従業員作成
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // バリデーション
    if (!body.companyId) {
      return NextResponse.json(
        { error: "companyIdは必須です" },
        { status: 400 }
      );
    }

    if (!body.employeeCode) {
      return NextResponse.json(
        { error: "社員番号は必須です" },
        { status: 400 }
      );
    }

    if (!body.firstName || !body.lastName) {
      return NextResponse.json(
        { error: "氏名は必須です" },
        { status: 400 }
      );
    }

    if (!body.hireDate) {
      return NextResponse.json(
        { error: "入社日は必須です" },
        { status: 400 }
      );
    }

    if (!body.employmentType) {
      return NextResponse.json(
        { error: "雇用形態は必須です" },
        { status: 400 }
      );
    }

    // 社員番号の重複チェック
    const exists = await checkEmployeeCodeExists(
      body.companyId,
      body.employeeCode
    );
    if (exists) {
      return NextResponse.json(
        { error: "この社員番号は既に使用されています" },
        { status: 400 }
      );
    }

    const data: CreateEmployeeDto = {
      companyId: body.companyId,
      employeeCode: body.employeeCode,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || undefined,
      gender: body.gender || undefined,
      birthDate: body.birthDate || undefined,
      hireDate: body.hireDate,
      departmentId: body.departmentId || undefined,
      employmentType: body.employmentType,
      jobTypeId: body.jobTypeId || undefined,
      gradeId: body.gradeId || undefined,
      positionId: body.positionId || undefined,
      currentStep: body.currentStep || undefined,
      currentRank: body.currentRank || undefined,
      baseSalary: body.baseSalary || undefined,
      status: body.status || "ACTIVE",
    };

    const employee = await createEmployee(data);

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("従業員作成エラー:", error);
    return NextResponse.json(
      { error: "従業員の作成に失敗しました" },
      { status: 500 }
    );
  }
}
