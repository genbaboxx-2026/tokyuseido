import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { jobTypeSchema } from '@/lib/company/validation';

interface Params {
  params: Promise<{ id: string; typeId: string }>;
}

/**
 * GET /api/companies/[id]/job-types/[typeId]
 * 職種小分類の詳細を取得
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId, typeId } = await params;

    const jobType = await prisma.jobType.findFirst({
      where: {
        id: typeId,
        jobCategory: { companyId },
      },
      include: {
        jobCategory: {
          select: { id: true, name: true },
        },
        _count: {
          select: { employees: true },
        },
      },
    });

    if (!jobType) {
      return NextResponse.json(
        { error: '職種小分類が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(jobType);
  } catch (error) {
    console.error('GET /api/companies/[id]/job-types/[typeId] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/companies/[id]/job-types/[typeId]
 * 職種小分類を更新
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId, typeId } = await params;

    // 対象の職種小分類が存在するか確認
    const existingJobType = await prisma.jobType.findFirst({
      where: {
        id: typeId,
        jobCategory: { companyId },
      },
    });

    if (!existingJobType) {
      return NextResponse.json(
        { error: '職種小分類が見つかりません' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validationResult = jobTypeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { name, jobCategoryId } = validationResult.data;

    // 職種大分類が同じ会社に属しているか確認
    const jobCategory = await prisma.jobCategory.findFirst({
      where: { id: jobCategoryId, companyId },
    });

    if (!jobCategory) {
      return NextResponse.json(
        { error: '職種大分類が見つかりません' },
        { status: 400 }
      );
    }

    // 同じ職種大分類内に同名の小分類が存在しないか確認（自分自身は除く）
    const duplicateJobType = await prisma.jobType.findFirst({
      where: {
        jobCategoryId,
        name,
        id: { not: typeId },
      },
    });

    if (duplicateJobType) {
      return NextResponse.json(
        { error: '同名の職種小分類が既に存在します' },
        { status: 400 }
      );
    }

    const updatedJobType = await prisma.jobType.update({
      where: { id: typeId },
      data: {
        name,
        jobCategoryId,
      },
      include: {
        jobCategory: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(updatedJobType);
  } catch (error) {
    console.error('PUT /api/companies/[id]/job-types/[typeId] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/companies/[id]/job-types/[typeId]
 * 職種小分類を削除
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId, typeId } = await params;

    // 対象の職種小分類が存在するか確認
    const existingJobType = await prisma.jobType.findFirst({
      where: {
        id: typeId,
        jobCategory: { companyId },
      },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });

    if (!existingJobType) {
      return NextResponse.json(
        { error: '職種小分類が見つかりません' },
        { status: 404 }
      );
    }

    // 紐づく従業員がいる場合は削除不可
    if (existingJobType._count.employees > 0) {
      return NextResponse.json(
        { error: 'この職種小分類に紐づく従業員がいるため削除できません' },
        { status: 400 }
      );
    }

    await prisma.jobType.delete({
      where: { id: typeId },
    });

    return NextResponse.json({ success: true, message: '職種小分類を削除しました' });
  } catch (error) {
    console.error('DELETE /api/companies/[id]/job-types/[typeId] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
