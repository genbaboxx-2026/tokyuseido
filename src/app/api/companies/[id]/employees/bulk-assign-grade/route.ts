/**
 * 従業員の等級・職種一括割り当てAPI
 * POST /api/companies/[id]/employees/bulk-assign-grade
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

interface Assignment {
  employeeId: string;
  gradeId: string | null;
  jobTypeId: string | null;
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: companyId } = await context.params;
    const body = await request.json();

    const assignments: Assignment[] = body.assignments;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json(
        { error: "割り当て情報が必要です" },
        { status: 400 }
      );
    }

    const employeeIds = assignments.map((a) => a.employeeId);
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, companyId },
      select: { id: true, gradeId: true },
    });

    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    const invalidIds = employeeIds.filter((id) => !employeeMap.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `従業員が見つかりません: ${invalidIds.join(", ")}` },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const assignment of assignments) {
        const current = employeeMap.get(assignment.employeeId);

        await tx.employee.update({
          where: { id: assignment.employeeId },
          data: {
            gradeId: assignment.gradeId,
            jobTypeId: assignment.jobTypeId,
          },
        });

        if (
          assignment.gradeId &&
          current?.gradeId !== assignment.gradeId
        ) {
          await tx.employeeGradeHistory.create({
            data: {
              employeeId: assignment.employeeId,
              gradeId: assignment.gradeId,
              effectiveDate: new Date(),
              reason: "等級制度設定から変更",
            },
          });
        }
      }
    });

    return NextResponse.json({
      message: `${assignments.length}件の割り当てを更新しました`,
      count: assignments.length,
    });
  } catch (error) {
    console.error("等級一括割り当てエラー:", error);
    return NextResponse.json(
      { error: "等級の一括割り当てに失敗しました" },
      { status: 500 }
    );
  }
}
