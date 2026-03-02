/**
 * 号俸テーブルPDF出力API
 * GET /api/pdf/salary-table/[tableId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { SalaryTablePDF } from '@/lib/pdf/salary-table';
import type { SalaryTableMatrixResponse, SalaryTableMatrixRow } from '@/types/salary';

interface RouteParams {
  params: Promise<{ tableId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableId } = await params;

    // 号俸テーブルデータを取得
    const salaryTable = await prisma.salaryTable.findUnique({
      where: { id: tableId },
      include: {
        entries: {
          include: {
            grade: true,
          },
          orderBy: [
            { stepNumber: 'asc' },
          ],
        },
        company: {
          include: {
            grades: {
              orderBy: { level: 'desc' },
            },
          },
        },
      },
    });

    if (!salaryTable) {
      return NextResponse.json(
        { error: '号俸テーブルが見つかりません' },
        { status: 404 }
      );
    }

    // 等級リストを構築
    const grades = salaryTable.company.grades.map((grade) => ({
      id: grade.id,
      name: grade.name,
      level: grade.level,
    }));

    // エントリをステップ番号でグループ化
    const stepMap = new Map<number, { rank: string; entries: SalaryTableMatrixRow['entries'] }>();

    salaryTable.entries.forEach((entry) => {
      if (!stepMap.has(entry.stepNumber)) {
        stepMap.set(entry.stepNumber, {
          rank: entry.rank,
          entries: [],
        });
      }
      stepMap.get(entry.stepNumber)!.entries.push({
        gradeId: entry.gradeId,
        baseSalary: entry.baseSalary,
        annualSalary: entry.baseSalary * 12,
      });
    });

    // 行データを構築
    const rows: SalaryTableMatrixRow[] = [];
    const sortedSteps = Array.from(stepMap.keys()).sort((a, b) => a - b);

    sortedSteps.forEach((stepNumber) => {
      const data = stepMap.get(stepNumber)!;
      rows.push({
        stepNumber,
        rank: data.rank,
        entries: data.entries,
      });
    });

    // エントリがない場合のサンプルデータ
    if (rows.length === 0) {
      // サンプル行を生成（テーブル設定に基づく）
      const sampleRanks = ['S1', 'S2', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];
      const stepCount = Math.min(salaryTable.totalRanks, 15);

      for (let i = 1; i <= stepCount; i++) {
        const rank = sampleRanks[Math.min(Math.floor((i - 1) * sampleRanks.length / stepCount), sampleRanks.length - 1)];
        rows.push({
          stepNumber: i,
          rank,
          entries: grades.map((grade) => ({
            gradeId: grade.id,
            baseSalary: Math.round(
              salaryTable.baseSalaryMin +
                (salaryTable.baseSalaryMax - salaryTable.baseSalaryMin) *
                  ((stepCount - i) / (stepCount - 1)) *
                  (grade.level / (grades.length || 1))
            ),
            annualSalary: 0,
          })).map(e => ({ ...e, annualSalary: e.baseSalary * 12 })),
        });
      }
    }

    // マトリクスレスポンスデータを構築
    const matrixData: SalaryTableMatrixResponse = {
      salaryTable: {
        id: salaryTable.id,
        companyId: salaryTable.companyId,
        name: salaryTable.name,
        baseSalaryMax: salaryTable.baseSalaryMax,
        baseSalaryMin: salaryTable.baseSalaryMin,
        rankDivision: salaryTable.rankDivision,
        increaseRate: salaryTable.increaseRate,
        initialStepDiff: salaryTable.initialStepDiff,
        totalRanks: salaryTable.totalRanks,
        isActive: salaryTable.isActive,
        createdAt: salaryTable.createdAt,
        updatedAt: salaryTable.updatedAt,
      },
      grades,
      rows,
    };

    // PDFをバッファとして生成
    const pdfBuffer = await renderToBuffer(
      SalaryTablePDF({ data: matrixData })
    );

    // Uint8Arrayに変換してレスポンスを返す
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="salary-table-${tableId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'PDF生成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
