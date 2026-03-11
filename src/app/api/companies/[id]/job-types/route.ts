import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { jobTypeSchema } from '@/lib/company/validation';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/companies/[id]/job-types
 * 会社の職種一覧を取得
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

    const jobTypes = await prisma.jobType.findMany({
      where: {
        jobCategory: { companyId },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        jobCategoryId: true,
        displayOrder: true,
        jobCategory: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({ jobTypes });
  } catch (error) {
    console.error('GET /api/companies/[id]/job-types error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/companies/[id]/job-types
 * 職種小分類を作成
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

    // 同じ職種大分類に同名の小分類がないか確認
    const existingJobType = await prisma.jobType.findUnique({
      where: {
        jobCategoryId_name: {
          jobCategoryId,
          name,
        },
      },
    });

    if (existingJobType) {
      return NextResponse.json(
        { error: '同名の職種小分類が既に存在します' },
        { status: 400 }
      );
    }

    // 同じカテゴリ内の最大displayOrderを取得
    const maxOrderResult = await prisma.jobType.aggregate({
      where: { jobCategoryId },
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrderResult._max.displayOrder ?? -1) + 1;

    const jobType = await prisma.jobType.create({
      data: {
        jobCategoryId,
        name,
        displayOrder: nextOrder,
      },
    });

    return NextResponse.json(jobType, { status: 201 });
  } catch (error) {
    console.error('POST /api/companies/[id]/job-types error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
