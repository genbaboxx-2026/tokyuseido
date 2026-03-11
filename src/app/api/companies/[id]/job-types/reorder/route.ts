import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';

interface Params {
  params: Promise<{ id: string }>;
}

const reorderSchema = z.object({
  jobCategoryId: z.string().min(1),
  jobTypeIds: z.array(z.string()).min(1),
});

/**
 * PUT /api/companies/[id]/job-types/reorder
 * 職種の表示順を更新
 */
export async function PUT(request: NextRequest, { params }: Params) {
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
    const validationResult = reorderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { jobCategoryId, jobTypeIds } = validationResult.data;

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

    // トランザクションで順番を更新
    await prisma.$transaction(
      jobTypeIds.map((jobTypeId, index) =>
        prisma.jobType.update({
          where: { id: jobTypeId },
          data: { displayOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/companies/[id]/job-types/reorder error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
