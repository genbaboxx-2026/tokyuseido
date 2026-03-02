import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { departmentSchema } from '@/lib/company/validation';

interface Params {
  params: Promise<{ id: string; departmentId: string }>;
}

/**
 * PUT /api/companies/[id]/departments/[departmentId]
 * 部署を更新
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId, departmentId } = await params;

    const existingDepartment = await prisma.department.findFirst({
      where: { id: departmentId, companyId },
    });

    if (!existingDepartment) {
      return NextResponse.json({ error: '部署が見つかりません' }, { status: 404 });
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

    // 自分自身を親部署に設定できない
    if (parentId === departmentId) {
      return NextResponse.json(
        { error: '自分自身を親部署に設定できません' },
        { status: 400 }
      );
    }

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

    // 同じ会社に同名の部署がないか確認（自分自身を除く）
    const duplicateDepartment = await prisma.department.findFirst({
      where: {
        companyId,
        name,
        id: { not: departmentId },
      },
    });

    if (duplicateDepartment) {
      return NextResponse.json(
        { error: '同名の部署が既に存在します' },
        { status: 400 }
      );
    }

    const department = await prisma.department.update({
      where: { id: departmentId },
      data: {
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

    return NextResponse.json(department);
  } catch (error) {
    console.error('PUT /api/companies/[id]/departments/[departmentId] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/companies/[id]/departments/[departmentId]
 * 部署を削除
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId, departmentId } = await params;

    const existingDepartment = await prisma.department.findFirst({
      where: { id: departmentId, companyId },
      include: {
        _count: {
          select: {
            employees: true,
            children: true,
          },
        },
      },
    });

    if (!existingDepartment) {
      return NextResponse.json({ error: '部署が見つかりません' }, { status: 404 });
    }

    // 従業員が所属している場合は削除不可
    if (existingDepartment._count.employees > 0) {
      return NextResponse.json(
        { error: '従業員が所属している部署は削除できません' },
        { status: 400 }
      );
    }

    // 子部署がある場合は削除不可
    if (existingDepartment._count.children > 0) {
      return NextResponse.json(
        { error: '子部署が存在する部署は削除できません' },
        { status: 400 }
      );
    }

    await prisma.department.delete({
      where: { id: departmentId },
    });

    return NextResponse.json({ message: '削除しました' });
  } catch (error) {
    console.error('DELETE /api/companies/[id]/departments/[departmentId] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
