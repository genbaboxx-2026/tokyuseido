import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { departmentSchema } from '@/lib/company/validation';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/companies/[id]/departments
 * 会社の部署一覧を取得
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId } = await params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json({ error: '会社が見つかりません' }, { status: 404 });
    }

    const departments = await prisma.department.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error('GET /api/companies/[id]/departments error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/companies/[id]/departments
 * 部署を作成
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId } = await params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json({ error: '会社が見つかりません' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = departmentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { name, parentId } = validationResult.data;

    // 親部署が指定されている場合、同じ会社に属していることを確認
    if (parentId) {
      const parentDepartment = await prisma.department.findFirst({
        where: { id: parentId, companyId },
      });

      if (!parentDepartment) {
        return NextResponse.json(
          { error: '親部署が見つかりません' },
          { status: 400 }
        );
      }
    }

    // 同じ会社に同名の部署がないか確認
    const existingDepartment = await prisma.department.findFirst({
      where: { companyId, name },
    });

    if (existingDepartment) {
      return NextResponse.json(
        { error: '同名の部署が既に存在します' },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        companyId,
        name,
        parentId: parentId || null,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error('POST /api/companies/[id]/departments error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
