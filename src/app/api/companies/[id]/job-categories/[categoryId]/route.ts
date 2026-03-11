import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { jobCategorySchema } from '@/lib/company/validation';

interface Params {
  params: Promise<{ id: string; categoryId: string }>;
}

/**
 * GET /api/companies/[id]/job-categories/[categoryId]
 * 職種大分類の詳細を取得
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId, categoryId } = await params;

    const jobCategory = await prisma.jobCategory.findFirst({
      where: { id: categoryId, companyId },
      include: {
        jobTypes: {
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: { employees: true },
            },
          },
        },
      },
    });

    if (!jobCategory) {
      return NextResponse.json(
        { error: '職種大分類が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(jobCategory);
  } catch (error) {
    console.error('GET /api/companies/[id]/job-categories/[categoryId] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/companies/[id]/job-categories/[categoryId]
 * 職種大分類を更新
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId, categoryId } = await params;

    // 対象の職種大分類が存在するか確認
    const existingCategory = await prisma.jobCategory.findFirst({
      where: { id: categoryId, companyId },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: '職種大分類が見つかりません' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = jobCategorySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { name } = validationResult.data;

    // 同名の職種大分類が存在しないか確認（自分自身は除く）
    const duplicateCategory = await prisma.jobCategory.findFirst({
      where: {
        companyId,
        name,
        id: { not: categoryId },
      },
    });

    if (duplicateCategory) {
      return NextResponse.json(
        { error: '同名の職種大分類が既に存在します' },
        { status: 400 }
      );
    }

    const updatedCategory = await prisma.jobCategory.update({
      where: { id: categoryId },
      data: { name },
      include: {
        jobTypes: {
          orderBy: { name: 'asc' },
        },
      },
    });

    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error('PUT /api/companies/[id]/job-categories/[categoryId] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/companies/[id]/job-categories/[categoryId]
 * 職種大分類を削除
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId, categoryId } = await params;

    // 対象の職種大分類が存在するか確認
    const existingCategory = await prisma.jobCategory.findFirst({
      where: { id: categoryId, companyId },
      include: {
        jobTypes: {
          include: {
            _count: {
              select: { employees: true },
            },
          },
        },
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: '職種大分類が見つかりません' },
        { status: 404 }
      );
    }

    // 職種小分類に紐づく従業員がいる場合は削除不可
    const hasEmployees = existingCategory.jobTypes.some(
      (jt) => jt._count.employees > 0
    );

    if (hasEmployees) {
      return NextResponse.json(
        { error: 'この職種大分類に紐づく従業員がいるため削除できません' },
        { status: 400 }
      );
    }

    // 職種大分類を削除（関連する職種小分類もカスケード削除される）
    await prisma.jobCategory.delete({
      where: { id: categoryId },
    });

    return NextResponse.json({ success: true, message: '職種大分類を削除しました' });
  } catch (error) {
    console.error('DELETE /api/companies/[id]/job-categories/[categoryId] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
