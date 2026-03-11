/**
 * 会社設定一括保存API
 * PUT /api/companies/[id]/settings-bulk - 全設定を一括保存
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { companySchema } from '@/lib/company/validation';
import type { PendingChanges } from '@/types/company-settings';
import { isTempId } from '@/types/company-settings';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 会社設定一括保存
 */
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id: companyId } = await context.params;
    const pendingChanges: PendingChanges = await request.json();

    // 会社存在確認
    const existingCompany = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!existingCompany) {
      return NextResponse.json({ error: '会社が見つかりません' }, { status: 404 });
    }

    // バリデーション
    if (pendingChanges.basicInfo) {
      const validationResult = companySchema.safeParse({
        name: pendingChanges.basicInfo.name,
        address: pendingChanges.basicInfo.address,
        representative: pendingChanges.basicInfo.representative,
        establishedDate: pendingChanges.basicInfo.establishedDate,
        businessDescription: pendingChanges.basicInfo.businessDescription,
        evaluationCycle: pendingChanges.basicInfo.evaluationCycle,
      });

      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'バリデーションエラー', details: validationResult.error.issues },
          { status: 400 }
        );
      }
    }

    // トランザクションで一括処理
    await prisma.$transaction(async (tx) => {
      // ============================================
      // 1. 削除処理（外部キー制約を考慮した順序）
      // ============================================

      // 1.1 職種（JobType）の削除（子を先に削除）
      if (pendingChanges.jobCategories?.jobTypesDeleted?.length) {
        await tx.jobType.deleteMany({
          where: {
            id: { in: pendingChanges.jobCategories.jobTypesDeleted },
            jobCategory: { companyId },
          },
        });
      }

      // 1.2 職種大分類（JobCategory）の削除
      if (pendingChanges.jobCategories?.deleted?.length) {
        // 紐づく職種も削除（カスケード削除がない場合）
        await tx.jobType.deleteMany({
          where: {
            jobCategoryId: { in: pendingChanges.jobCategories.deleted },
          },
        });
        await tx.jobCategory.deleteMany({
          where: {
            id: { in: pendingChanges.jobCategories.deleted },
            companyId,
          },
        });
      }

      // 1.3 役職（Position）の削除
      if (pendingChanges.positions?.deleted?.length) {
        await tx.position.deleteMany({
          where: {
            id: { in: pendingChanges.positions.deleted },
            companyId,
          },
        });
      }

      // 1.4 賞与設定（BonusSetting）の削除
      if (pendingChanges.bonusSettings?.deleted?.length) {
        await tx.bonusSetting.deleteMany({
          where: {
            id: { in: pendingChanges.bonusSettings.deleted },
            companyId,
          },
        });
      }

      // ============================================
      // 2. 基本情報の更新
      // ============================================
      if (pendingChanges.basicInfo) {
        const { establishedDate, ...basicData } = pendingChanges.basicInfo;
        await tx.company.update({
          where: { id: companyId },
          data: {
            ...basicData,
            establishedDate: establishedDate ? new Date(establishedDate) : null,
          },
        });
      }

      // ============================================
      // 3. 給与設定の更新
      // ============================================
      if (pendingChanges.salarySettings) {
        const { evaluationPeriodStart, evaluationPeriodEnd, ...salaryData } =
          pendingChanges.salarySettings;
        await tx.company.update({
          where: { id: companyId },
          data: {
            ...salaryData,
            evaluationPeriodStart: evaluationPeriodStart
              ? new Date(evaluationPeriodStart)
              : null,
            evaluationPeriodEnd: evaluationPeriodEnd
              ? new Date(evaluationPeriodEnd)
              : null,
          },
        });
      }

      // ============================================
      // 4. 職種大分類の追加・更新（IDマッピング用）
      // ============================================
      const categoryIdMap = new Map<string, string>();

      // 4.1 職種大分類の追加
      if (pendingChanges.jobCategories?.added?.length) {
        for (const category of pendingChanges.jobCategories.added) {
          const created = await tx.jobCategory.create({
            data: {
              companyId,
              name: category.name,
            },
          });
          categoryIdMap.set(category.tempId, created.id);
        }
      }

      // 4.2 職種大分類の更新
      if (pendingChanges.jobCategories?.updated?.length) {
        for (const category of pendingChanges.jobCategories.updated) {
          await tx.jobCategory.update({
            where: { id: category.id },
            data: { name: category.name },
          });
        }
      }

      // ============================================
      // 5. 職種の追加・更新
      // ============================================

      // 5.1 職種の追加
      if (pendingChanges.jobCategories?.jobTypesAdded?.length) {
        for (const jobType of pendingChanges.jobCategories.jobTypesAdded) {
          // categoryIdがtempIdの場合はマッピングから実IDを取得
          const realCategoryId = isTempId(jobType.categoryId)
            ? categoryIdMap.get(jobType.categoryId)
            : jobType.categoryId;

          if (!realCategoryId) {
            throw new Error(`職種大分類が見つかりません: ${jobType.categoryId}`);
          }

          await tx.jobType.create({
            data: {
              jobCategoryId: realCategoryId,
              name: jobType.name,
            },
          });
        }
      }

      // 5.2 職種の更新
      if (pendingChanges.jobCategories?.jobTypesUpdated?.length) {
        for (const jobType of pendingChanges.jobCategories.jobTypesUpdated) {
          await tx.jobType.update({
            where: { id: jobType.id },
            data: { name: jobType.name },
          });
        }
      }

      // ============================================
      // 6. 役職の追加・更新
      // ============================================

      // 6.1 役職の追加
      if (pendingChanges.positions?.added?.length) {
        for (const position of pendingChanges.positions.added) {
          await tx.position.create({
            data: {
              companyId,
              name: position.name,
              level: position.level,
            },
          });
        }
      }

      // 6.2 役職の更新
      if (pendingChanges.positions?.updated?.length) {
        for (const position of pendingChanges.positions.updated) {
          await tx.position.update({
            where: { id: position.id },
            data: {
              name: position.name,
              level: position.level,
            },
          });
        }
      }

      // ============================================
      // 7. 賞与設定の追加・更新
      // ============================================

      // 7.1 賞与設定の追加
      if (pendingChanges.bonusSettings?.added?.length) {
        for (const bonus of pendingChanges.bonusSettings.added) {
          await tx.bonusSetting.create({
            data: {
              companyId,
              name: bonus.name,
              paymentDate: new Date(bonus.paymentDate),
              assessmentStartDate: new Date(bonus.assessmentStartDate),
              assessmentEndDate: new Date(bonus.assessmentEndDate),
              evaluationStartDate: new Date(bonus.evaluationStartDate),
              evaluationEndDate: new Date(bonus.evaluationEndDate),
            },
          });
        }
      }

      // 7.2 賞与設定の更新
      if (pendingChanges.bonusSettings?.updated?.length) {
        for (const bonus of pendingChanges.bonusSettings.updated) {
          await tx.bonusSetting.update({
            where: { id: bonus.id },
            data: {
              name: bonus.name,
              paymentDate: new Date(bonus.paymentDate),
              assessmentStartDate: new Date(bonus.assessmentStartDate),
              assessmentEndDate: new Date(bonus.assessmentEndDate),
              evaluationStartDate: new Date(bonus.evaluationStartDate),
              evaluationEndDate: new Date(bonus.evaluationEndDate),
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/companies/[id]/settings-bulk error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '設定の一括保存に失敗しました',
      },
      { status: 500 }
    );
  }
}
