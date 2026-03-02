import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { positionSchema } from '@/lib/company/validation';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/companies/[id]/positions
 * 会社の役職一覧を取得
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

    const positions = await prisma.position.findMany({
      where: { companyId },
      orderBy: { level: 'desc' },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    return NextResponse.json({ positions });
  } catch (error) {
    console.error('GET /api/companies/[id]/positions error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/companies/[id]/positions
 * 役職を作成
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
    const validationResult = positionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { name } = validationResult.data;

    // 同じ会社に同名の役職がないか確認
    const existingPosition = await prisma.position.findUnique({
      where: {
        companyId_name: {
          companyId,
          name,
        },
      },
    });

    if (existingPosition) {
      return NextResponse.json(
        { error: '同名の役職が既に存在します' },
        { status: 400 }
      );
    }

    // 現在の最大レベルを取得
    const maxLevelPosition = await prisma.position.findFirst({
      where: { companyId },
      orderBy: { level: 'desc' },
      select: { level: true },
    });
    const nextLevel = (maxLevelPosition?.level ?? 0) + 1;

    const position = await prisma.position.create({
      data: {
        companyId,
        name,
        level: nextLevel,
      },
    });

    return NextResponse.json(position, { status: 201 });
  } catch (error) {
    console.error('POST /api/companies/[id]/positions error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
