/**
 * 評価シートPDF出力API
 * GET /api/pdf/evaluation-sheet/[evaluationId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { EvaluationSheetPDF } from '@/lib/pdf/evaluation-sheet';
import type { EvaluationSheet, EvaluationSheetCategory } from '@/types/evaluation';

interface RouteParams {
  params: Promise<{ evaluationId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { evaluationId } = await params;

    // 個別評価データを取得
    const evaluation = await prisma.individualEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        evaluationPeriod: true,
        employee: {
          include: {
            department: true,
            grade: true,
            jobType: true,
          },
        },
        evaluator: true,
        scores: {
          include: {
            evaluationItem: true,
          },
        },
      },
    });

    if (!evaluation) {
      return NextResponse.json(
        { error: '評価データが見つかりません' },
        { status: 404 }
      );
    }

    // 前回の評価スコアを取得（存在する場合）
    const previousScores: Map<string, number | null> = new Map();
    const previousEvaluation = await prisma.individualEvaluation.findFirst({
      where: {
        employeeId: evaluation.employeeId,
        evaluationPeriodId: { not: evaluation.evaluationPeriodId },
        status: 'COMPLETED',
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        scores: true,
      },
    });

    if (previousEvaluation) {
      previousEvaluation.scores.forEach((score) => {
        previousScores.set(score.evaluationItemId, score.evaluatorScore);
      });
    }

    // 評価項目をカテゴリ別にグループ化
    const categoryMap = new Map<string, EvaluationSheetCategory['items']>();
    evaluation.scores.forEach((score) => {
      const category = score.evaluationItem.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push({
        name: score.evaluationItem.name,
        description: score.evaluationItem.description,
        weight: score.evaluationItem.weight,
        selfScore: score.selfScore,
        evaluatorScore: score.evaluatorScore,
        previousScore: previousScores.get(score.evaluationItemId) ?? null,
        comment: score.comment,
      });
    });

    // カテゴリ配列を生成
    const categories: EvaluationSheetCategory[] = [];
    categoryMap.forEach((items, name) => {
      categories.push({ name, items });
    });

    // カテゴリがない場合は空のカテゴリを追加（デモ用）
    if (categories.length === 0) {
      categories.push({
        name: '評価項目',
        items: [
          {
            name: '評価項目なし',
            description: null,
            weight: null,
            selfScore: null,
            evaluatorScore: null,
            previousScore: null,
            comment: '評価項目が登録されていません',
          },
        ],
      });
    }

    // 評価シートデータを構築
    const sheetData: EvaluationSheet = {
      period: {
        name: evaluation.evaluationPeriod.name,
        startDate: evaluation.evaluationPeriod.startDate.toISOString().split('T')[0],
        endDate: evaluation.evaluationPeriod.endDate.toISOString().split('T')[0],
      },
      employee: {
        name: `${evaluation.employee.lastName} ${evaluation.employee.firstName}`,
        employeeCode: evaluation.employee.employeeCode,
        department: evaluation.employee.department?.name || '未所属',
        grade: evaluation.employee.grade?.name || '未設定',
        jobType: evaluation.employee.jobType?.name || '未設定',
      },
      evaluator: {
        name: evaluation.evaluator.name || '評価者',
      },
      categories,
      totalScore: evaluation.totalScore,
      finalRating: evaluation.finalRating as EvaluationSheet['finalRating'],
    };

    // PDFをバッファとして生成
    const pdfBuffer = await renderToBuffer(
      EvaluationSheetPDF({ data: sheetData })
    );

    // Uint8Arrayに変換してレスポンスを返す
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="evaluation-sheet-${evaluationId}.pdf"`,
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
