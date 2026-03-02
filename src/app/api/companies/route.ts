import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { companySchema } from '@/lib/company/validation';
import { PAGINATION } from '@/lib/company/constants';

/**
 * GET /api/companies
 * 会社一覧を取得（ページネーション対応）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Number(searchParams.get('page')) || PAGINATION.DEFAULT_PAGE;
    const limit = Number(searchParams.get('limit')) || PAGINATION.DEFAULT_LIMIT;
    const name = searchParams.get('name') || undefined;

    const skip = (page - 1) * limit;

    const where = name
      ? { name: { contains: name, mode: 'insensitive' as const } }
      : {};

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              employees: true,
              departments: true,
            },
          },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return NextResponse.json({
      companies,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('GET /api/companies error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/companies
 * 会社を作成
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = companySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { establishedDate, ...data } = validationResult.data;

    const company = await prisma.company.create({
      data: {
        ...data,
        establishedDate: establishedDate ? new Date(establishedDate) : null,
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error('POST /api/companies error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
