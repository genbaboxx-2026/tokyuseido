/**
 * 従業員管理ビジネスロジック
 */

import { prisma } from "@/lib/prisma";
import type {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeSearchQuery,
  EmployeeWithRelations,
  EmployeeListResponse,
  EmployeeDetailResponse,
  EmployeeGradeHistoryWithGrade,
} from "@/types/employee";

/**
 * 従業員一覧を取得
 */
export async function getEmployees(
  query: EmployeeSearchQuery & { jobCategoryId?: string | string[] }
): Promise<EmployeeListResponse> {
  const {
    companyId,
    keyword,
    jobCategoryId,
    employmentType,
    jobTypeId,
    gradeId,
    positionId,
    status,
    page = 1,
    limit = 20,
    sortBy = "employeeCode",
    sortOrder = "asc",
  } = query;

  // 検索条件を構築
  const where: Record<string, unknown> = {
    companyId,
  };

  if (keyword) {
    where.OR = [
      { firstName: { contains: keyword, mode: "insensitive" } },
      { lastName: { contains: keyword, mode: "insensitive" } },
      { employeeCode: { contains: keyword, mode: "insensitive" } },
    ];
  }

  if (employmentType) {
    where.employmentType = Array.isArray(employmentType) ? { in: employmentType } : employmentType;
  }

  if (jobTypeId) {
    where.jobTypeId = Array.isArray(jobTypeId) ? { in: jobTypeId } : jobTypeId;
  } else if (jobCategoryId) {
    // jobTypeIdが指定されていない場合のみjobCategoryIdでフィルタ
    where.jobType = {
      jobCategoryId: Array.isArray(jobCategoryId) ? { in: jobCategoryId } : jobCategoryId,
    };
  }

  if (gradeId) {
    where.gradeId = Array.isArray(gradeId) ? { in: gradeId } : gradeId;
  }

  if (positionId) {
    where.positionId = Array.isArray(positionId) ? { in: positionId } : positionId;
  }

  if (status) {
    where.status = status;
  }

  // ソート条件
  let orderBy: Record<string, unknown> = {};
  if (sortBy === "gradeLevel") {
    orderBy = { grade: { level: sortOrder } };
  } else {
    orderBy[sortBy] = sortOrder;
  }

  // データ取得
  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        department: {
          select: { id: true, name: true },
        },
        jobType: {
          select: {
            id: true,
            name: true,
            jobCategory: { select: { name: true } },
          },
        },
        grade: {
          select: { id: true, name: true, level: true, isManagement: true },
        },
        position: {
          select: { id: true, name: true, level: true },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);

  // NOTE: emailフィールドはEmployeeモデルに含まれているため、
  // includeせずとも自動的に返される

  // レスポンス形式に変換
  const employeesWithRelations: EmployeeWithRelations[] = employees.map(
    (emp) => ({
      ...emp,
      jobType: emp.jobType
        ? {
            id: emp.jobType.id,
            name: emp.jobType.name,
            categoryName: emp.jobType.jobCategory.name,
          }
        : null,
    })
  );

  return {
    employees: employeesWithRelations,
    total,
    page,
    limit,
  };
}

/**
 * 従業員詳細を取得
 */
export async function getEmployeeById(
  id: string
): Promise<EmployeeDetailResponse | null> {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: {
        select: { id: true, name: true },
      },
      jobType: {
        select: {
          id: true,
          name: true,
          jobCategory: { select: { name: true } },
        },
      },
      grade: {
        select: { id: true, name: true, level: true, isManagement: true },
      },
      position: {
        select: { id: true, name: true, level: true },
      },
      gradeHistory: {
        include: {
          grade: { select: { name: true, level: true } },
        },
        orderBy: { effectiveDate: "desc" },
      },
      interviewRecords: {
        orderBy: { interviewDate: "desc" },
      },
    },
  });

  if (!employee) {
    return null;
  }

  // 等級履歴を変換
  const gradeHistory: EmployeeGradeHistoryWithGrade[] = employee.gradeHistory.map(
    (history) => ({
      ...history,
      gradeName: history.grade.name,
      gradeLevel: history.grade.level,
    })
  );

  // 年齢を計算
  const age = employee.birthDate
    ? calculateAge(employee.birthDate)
    : null;

  // 勤続年数を計算
  const yearsOfService = calculateYearsOfService(employee.hireDate);

  // 年収を計算（基本給 × 12 + ボーナス想定は単純化）
  const annualSalary = employee.baseSalary
    ? employee.baseSalary * 12
    : null;

  // フルネーム
  const fullName = `${employee.lastName} ${employee.firstName}`;

  return {
    ...employee,
    jobType: employee.jobType
      ? {
          id: employee.jobType.id,
          name: employee.jobType.name,
          categoryName: employee.jobType.jobCategory.name,
        }
      : null,
    fullName,
    age,
    yearsOfService,
    annualSalary,
    gradeHistory,
    interviewRecords: employee.interviewRecords,
    currentRole: null, // TODO: GradeRoleから取得
  };
}

/**
 * 従業員を作成
 */
export async function createEmployee(
  data: CreateEmployeeDto
): Promise<EmployeeWithRelations> {
  // 等級名を取得して個別評価のデフォルト値を決定
  let hasIndividualEvaluation = false
  if (data.gradeId) {
    const grade = await prisma.grade.findUnique({
      where: { id: data.gradeId },
      select: { name: true },
    })
    // 正1、正2、正3の場合は個別評価対象
    if (grade && ["正1", "正2", "正3"].includes(grade.name)) {
      hasIndividualEvaluation = true
    }
  }

  const employee = await prisma.employee.create({
    data: {
      companyId: data.companyId,
      employeeCode: data.employeeCode,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      gender: data.gender,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
      departmentId: data.departmentId || null,
      employmentType: data.employmentType || "FULL_TIME",
      jobTypeId: data.jobTypeId || null,
      gradeId: data.gradeId || null,
      positionId: data.positionId || null,
      currentStep: data.currentStep || null,
      currentRank: data.currentRank || null,
      baseSalary: data.baseSalary || null,
      status: data.status || "ACTIVE",
      has360Evaluation: true, // 360度評価は全員デフォルトでチェック
      hasIndividualEvaluation, // 個別評価は正1、正2、正3のみ
    },
    include: {
      department: {
        select: { id: true, name: true },
      },
      jobType: {
        select: {
          id: true,
          name: true,
          jobCategory: { select: { name: true } },
        },
      },
      grade: {
        select: { id: true, name: true, level: true, isManagement: true },
      },
      position: {
        select: { id: true, name: true, level: true },
      },
    },
  });

  // 等級履歴を自動作成
  if (data.gradeId) {
    await prisma.employeeGradeHistory.create({
      data: {
        employeeId: employee.id,
        gradeId: data.gradeId,
        effectiveDate: data.hireDate ? new Date(data.hireDate) : new Date(),
        reason: "入社時付与",
      },
    });
  }

  return {
    ...employee,
    jobType: employee.jobType
      ? {
          id: employee.jobType.id,
          name: employee.jobType.name,
          categoryName: employee.jobType.jobCategory.name,
        }
      : null,
  };
}

/**
 * 従業員を更新
 */
export async function updateEmployee(
  id: string,
  data: UpdateEmployeeDto
): Promise<EmployeeWithRelations> {
  // 現在の従業員情報を取得（等級・給与の変更確認用）
  const currentEmployee = await prisma.employee.findUnique({
    where: { id },
    select: { gradeId: true, baseSalary: true },
  });

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      gender: data.gender,
      birthDate: data.birthDate ? new Date(data.birthDate as string) : undefined,
      hireDate: data.hireDate ? new Date(data.hireDate as string) : undefined,
      departmentId: data.departmentId,
      employmentType: data.employmentType,
      jobTypeId: data.jobTypeId,
      gradeId: data.gradeId,
      positionId: data.positionId,
      currentStep: data.currentStep,
      currentRank: data.currentRank,
      baseSalary: data.baseSalary,
      status: data.status,
    },
    include: {
      department: {
        select: { id: true, name: true },
      },
      jobType: {
        select: {
          id: true,
          name: true,
          jobCategory: { select: { name: true } },
        },
      },
      grade: {
        select: { id: true, name: true, level: true, isManagement: true },
      },
      position: {
        select: { id: true, name: true, level: true },
      },
    },
  });

  // 等級変更があれば履歴を追加
  if (data.gradeId && currentEmployee?.gradeId !== data.gradeId) {
    await prisma.employeeGradeHistory.create({
      data: {
        employeeId: id,
        gradeId: data.gradeId,
        effectiveDate: new Date(),
        reason: "等級変更",
      },
    });
  }

  // 給与変更があれば履歴を追加
  if (data.baseSalary !== undefined && currentEmployee?.baseSalary !== data.baseSalary) {
    await prisma.employeeSalary.create({
      data: {
        employeeId: id,
        baseSalary: data.baseSalary ?? 0,
        effectiveDate: new Date(),
        reason: "手動更新",
      },
    });
  }

  return {
    ...employee,
    jobType: employee.jobType
      ? {
          id: employee.jobType.id,
          name: employee.jobType.name,
          categoryName: employee.jobType.jobCategory.name,
        }
      : null,
  };
}

/**
 * 従業員を削除
 */
export async function deleteEmployee(id: string): Promise<void> {
  await prisma.employee.delete({
    where: { id },
  });
}

/**
 * 従業員コードの重複チェック
 */
export async function checkEmployeeCodeExists(
  companyId: string,
  employeeCode: string,
  excludeId?: string
): Promise<boolean> {
  const employee = await prisma.employee.findFirst({
    where: {
      companyId,
      employeeCode,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  return !!employee;
}

// ============================================
// ヘルパー関数
// ============================================

/**
 * 年齢を計算
 */
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

/**
 * 勤続年数を計算
 */
function calculateYearsOfService(hireDate: Date): number {
  const today = new Date();
  let years = today.getFullYear() - hireDate.getFullYear();
  const monthDiff = today.getMonth() - hireDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < hireDate.getDate())
  ) {
    years--;
  }
  return Math.max(0, years);
}
