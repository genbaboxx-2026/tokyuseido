import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { positionSchema } from '@/lib/company/validation';

interface Params {
  params: Promise<{ id: string; positionId: string }>;
}

/**
 * PUT /api/companies/[id]/positions/[positionId]
 * 役職を更新
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId, positionId } = await params;

    const existingPosition = await prisma.position.findFirst({
      where: { id: positionId, companyId },
    });

    if (!existingPosition) {
      return NextResponse.json({ error: '役職が見つかりません' }, { status: 404 });
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

    // 同じ会社に同名の役職がないか確認（自分自身を除く）
    const duplicatePosition = await prisma.position.findFirst({
      where: {
        companyId,
        name,
        id: { not: positionId },
      },
    });

    if (duplicatePosition) {
      return NextResponse.json(
        { error: '同名の役職が既に存在します' },
        { status: 400 }
      );
    }

    const position = await prisma.position.update({
      where: { id: positionId },
      data: {
        name,
      },
    });

    return NextResponse.json(position);
  } catch (error) {
    console.error('PUT /api/companies/[id]/positions/[positionId] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/companies/[id]/positions/[positionId]
 * 役職を削除
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId, positionId } = await params;

    const existingPosition = await prisma.position.findFirst({
      where: { id: positionId, companyId },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!existingPosition) {
      return NextResponse.json({ error: '役職が見つかりません' }, { status: 404 });
    }

    // 従業員が使用している場合は削除不可
    if (existingPosition._count.employees > 0) {
      return NextResponse.json(
        { error: '従業員が使用している役職は削除できません' },
        { status: 400 }
      );
    }

    await prisma.position.delete({
      where: { id: positionId },
    });

    return NextResponse.json({ message: '削除しました' });
  } catch (error) {
    console.error('DELETE /api/companies/[id]/positions/[positionId] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
