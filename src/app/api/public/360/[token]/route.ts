import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 公開360度評価フォームAPI（認証不要）
 * GET: トークンから評価データを取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // トークンを検証
    const accessToken = await prisma.evaluation360AccessToken.findUnique({
      where: { token },
      include: {
        reviewerAssignment: {
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            record: {
              include: {
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    department: { select: { name: true } },
                    grade: { select: { name: true } },
                    jobType: { select: { name: true } },
                  },
                },
                evaluationPeriod: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                company: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            scores: {
              include: {
                evaluationCustomItem: {
                  select: {
                    id: true,
                    itemName: true,
                    description: true,
                    maxScore: true,
                    sortOrder: true,
                    categoryName: true,
                    categorySortOrder: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!accessToken) {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 404 }
      );
    }

    // トークンの有効期限をチェック
    if (accessToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "このリンクは期限切れです" },
        { status: 410 }
      );
    }

    const { reviewerAssignment } = accessToken;
    const { record, reviewer, scores } = reviewerAssignment;

    // この評価者が担当する全ての被評価者を取得
    const allAssignments = await prisma.evaluation360ReviewerAssignment.findMany({
      where: {
        reviewerId: reviewer.id,
        record: {
          companyId: record.companyId,
          evaluationPeriodId: record.evaluationPeriodId,
          status: { in: ["distributing", "collecting"] },
        },
      },
      include: {
        record: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
                grade: { select: { name: true } },
                jobType: { select: { name: true } },
              },
            },
          },
        },
        scores: {
          include: {
            evaluationCustomItem: {
              select: {
                id: true,
                itemName: true,
                description: true,
                maxScore: true,
                sortOrder: true,
                categoryName: true,
                categorySortOrder: true,
              },
            },
          },
        },
      },
    });

    // 各被評価者の評価項目を取得
    const targetEmployees = await Promise.all(
      allAssignments.map(async (assignment) => {
        const employeeId = assignment.record.employeeId;
        const periodId = record.evaluationPeriodId;
        const companyId = record.companyId;

        // カスタム評価項目を取得
        const customItems = await prisma.evaluationCustomItem.findMany({
          where: {
            companyId,
            employeeId,
            periodId,
            evaluationType: "360",
            isDeleted: false,
          },
          orderBy: [
            { categorySortOrder: "asc" },
            { sortOrder: "asc" },
          ],
        });

        // カテゴリごとにグループ化
        const categoriesMap = new Map<
          string,
          {
            name: string;
            sortOrder: number;
            items: Array<{
              id: string;
              itemName: string;
              description: string | null;
              maxScore: number;
              sortOrder: number;
              score: number | null;
              comment: string | null;
            }>;
          }
        >();

        for (const item of customItems) {
          const categoryName = item.categoryName || "その他";
          const categorySortOrder = item.categorySortOrder ?? 999;

          if (!categoriesMap.has(categoryName)) {
            categoriesMap.set(categoryName, {
              name: categoryName,
              sortOrder: categorySortOrder,
              items: [],
            });
          }

          // 既存のスコアを取得
          const existingScore = assignment.scores.find(
            (s) => s.evaluationCustomItemId === item.id
          );

          categoriesMap.get(categoryName)!.items.push({
            id: item.id,
            itemName: item.itemName,
            description: item.description,
            maxScore: Number(item.maxScore),
            sortOrder: item.sortOrder,
            score: existingScore?.score ?? null,
            comment: existingScore?.comment ?? null,
          });
        }

        // カテゴリをソート
        const categories = Array.from(categoriesMap.values()).sort(
          (a, b) => a.sortOrder - b.sortOrder
        );

        // 各カテゴリ内のアイテムもソート
        for (const category of categories) {
          category.items.sort((a, b) => a.sortOrder - b.sortOrder);
        }

        // 完了率を計算
        const totalItems = customItems.length;
        const answeredItems = assignment.scores.filter(
          (s) => s.score !== null
        ).length;

        return {
          id: employeeId,
          assignmentId: assignment.id,
          firstName: assignment.record.employee.firstName,
          lastName: assignment.record.employee.lastName,
          department: assignment.record.employee.department?.name || null,
          grade: assignment.record.employee.grade?.name || null,
          jobType: assignment.record.employee.jobType?.name || null,
          status: assignment.status,
          categories,
          progress: totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0,
          totalItems,
          answeredItems,
        };
      })
    );

    // 全体の完了率
    const totalAllItems = targetEmployees.reduce((sum, e) => sum + e.totalItems, 0);
    const answeredAllItems = targetEmployees.reduce((sum, e) => sum + e.answeredItems, 0);

    return NextResponse.json({
      reviewer: {
        id: reviewer.id,
        firstName: reviewer.firstName,
        lastName: reviewer.lastName,
      },
      company: {
        id: record.company.id,
        name: record.company.name,
      },
      period: {
        id: record.evaluationPeriod.id,
        name: record.evaluationPeriod.name,
      },
      deadline: record.responseDeadline,
      isAnonymous: record.isAnonymous,
      targetEmployees,
      overallProgress: totalAllItems > 0 ? Math.round((answeredAllItems / totalAllItems) * 100) : 0,
    });
  } catch (error) {
    console.error("公開360度評価データ取得エラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
