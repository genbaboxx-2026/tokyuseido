import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { companySchema } from '@/lib/company/validation';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/companies/[id]
 * 会社詳細を取得（部署、役職、職種を含む）
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        departments: {
          orderBy: { name: 'asc' },
        },
        positions: {
          orderBy: { level: 'desc' },
        },
        jobCategories: {
          orderBy: { name: 'asc' },
          include: {
            jobTypes: {
              orderBy: { name: 'asc' },
            },
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: '会社が見つかりません' }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error('GET /api/companies/[id] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/companies/[id]
 * 会社情報を更新
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validationResult = companySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const existingCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!existingCompany) {
      return NextResponse.json({ error: '会社が見つかりません' }, { status: 404 });
    }

    const { establishedDate, ...data } = validationResult.data;

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...data,
        establishedDate: establishedDate ? new Date(establishedDate) : null,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error('PUT /api/companies/[id] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/companies/[id]
 * 会社を削除
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id } = await params;

    const existingCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!existingCompany) {
      return NextResponse.json({ error: '会社が見つかりません' }, { status: 404 });
    }

    await prisma.company.delete({
      where: { id },
    });

    return NextResponse.json({ message: '削除しました' });
  } catch (error) {
    console.error('DELETE /api/companies/[id] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
