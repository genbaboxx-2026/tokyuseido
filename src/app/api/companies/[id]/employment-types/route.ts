import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { EmploymentTypeLabels } from '@/types/employee';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/companies/[id]/employment-types
 * 会社の雇用形態一覧を取得
 * 現在はシステム共通の雇用形態を返すが、将来的に会社ごとのカスタマイズに対応可能
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // システム共通の雇用形態を返す
    const employmentTypes = Object.entries(EmploymentTypeLabels).map(([value, label]) => ({
      value,
      label,
    }));

    return NextResponse.json({ employmentTypes });
  } catch (error) {
    console.error('GET /api/companies/[id]/employment-types error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
