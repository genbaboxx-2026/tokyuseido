import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { jobCategorySchema } from '@/lib/company/validation';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/companies/[id]/job-categories
 * 会社の職種大分類一覧を取得（小分類を含む）
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

    const jobCategories = await prisma.jobCategory.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: {
        jobTypes: {
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: {
                employees: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ jobCategories });
  } catch (error) {
    console.error('GET /api/companies/[id]/job-categories error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/companies/[id]/job-categories
 * 職種大分類を作成
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
    const validationResult = jobCategorySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { name } = validationResult.data;

    // 同じ会社に同名の職種大分類がないか確認
    const existingCategory = await prisma.jobCategory.findUnique({
      where: {
        companyId_name: {
          companyId,
          name,
        },
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: '同名の職種大分類が既に存在します' },
        { status: 400 }
      );
    }

    const jobCategory = await prisma.jobCategory.create({
      data: {
        companyId,
        name,
      },
      include: {
        jobTypes: true,
      },
    });

    return NextResponse.json(jobCategory, { status: 201 });
  } catch (error) {
    console.error('POST /api/companies/[id]/job-categories error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
