import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 公開個別評価フォームAPI（認証不要）
 * GET: トークンから評価データを取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // トークンを検証
    const accessToken = await prisma.individualEvaluationAccessToken.findUnique({
      where: { token },
      include: {
        employeeEvaluation: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
                grade: { select: { name: true } },
                jobType: { select: { name: true } },
                company: { select: { id: true, name: true } },
              },
            },
            evaluator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            evaluationTemplate: {
              select: {
                id: true,
                name: true,
              },
            },
            items: {
              include: {
                evaluationTemplateItem: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    category: true,
                    maxScore: true,
                    weight: true,
                    sortOrder: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!accessToken) {
      return NextResponse.json(
        { error: "無効なトークンです" },
        { status: 404 }
      )
    }

    // トークンの有効期限をチェック
    if (accessToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "このリンクは期限切れです" },
        { status: 410 }
      )
    }

    const { employeeEvaluation } = accessToken
    const { employee, items, evaluator } = employeeEvaluation

    // 評価期間情報を取得
    let period = null
    if (employeeEvaluation.evaluationPeriodId) {
      period = await prisma.evaluationPeriod.findUnique({
        where: { id: employeeEvaluation.evaluationPeriodId },
        select: { id: true, name: true },
      })
    }

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
          weight: number;
          sortOrder: number;
          selfScore: number | null;
          evaluatorScore: number | null;
          comment: string | null;
        }>;
      }
    >()

    for (const item of items) {
      const templateItem = item.evaluationTemplateItem
      if (!templateItem) continue

      const categoryName = templateItem.category || "その他"
      const categorySortOrder = templateItem.sortOrder

      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          name: categoryName,
          sortOrder: categorySortOrder,
          items: [],
        })
      }

      categoriesMap.get(categoryName)!.items.push({
        id: item.id,
        itemName: templateItem.name,
        description: templateItem.description,
        maxScore: templateItem.maxScore,
        weight: templateItem.weight,
        sortOrder: templateItem.sortOrder,
        selfScore: item.selfScore,
        evaluatorScore: item.evaluatorScore,
        comment: item.comment,
      })
    }

    // カテゴリをソート
    const categories = Array.from(categoriesMap.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    )

    // 各カテゴリ内のアイテムもソート
    for (const category of categories) {
      category.items.sort((a, b) => a.sortOrder - b.sortOrder)
    }

    // 進捗を計算
    const totalItems = items.length
    const selfScoredItems = items.filter((i) => i.selfScore !== null).length

    // 提出済みかどうか
    const isSubmitted = employeeEvaluation.selfCompletedAt !== null

    return NextResponse.json({
      tokenType: accessToken.type,
      isSubmitted,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        department: employee.department?.name || null,
        grade: employee.grade?.name || null,
        jobType: employee.jobType?.name || null,
      },
      evaluator: evaluator
        ? {
            id: evaluator.id,
            firstName: evaluator.firstName,
            lastName: evaluator.lastName,
          }
        : null,
      company: {
        id: employee.company.id,
        name: employee.company.name,
      },
      period: period,
      deadline: employeeEvaluation.responseDeadline,
      status: employeeEvaluation.status,
      selfComment: employeeEvaluation.selfComment,
      categories,
      progress: {
        total: totalItems,
        completed: selfScoredItems,
        percentage: totalItems > 0 ? Math.round((selfScoredItems / totalItems) * 100) : 0,
      },
    })
  } catch (error) {
    console.error("公開評価データ取得エラー:", error)
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    )
  }
}
