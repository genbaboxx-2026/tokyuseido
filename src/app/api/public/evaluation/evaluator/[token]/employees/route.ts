import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"

/**
 * 評価者担当従業員一覧API（認証不要、パスワード必要）
 * GET: 担当従業員一覧を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { searchParams } = new URL(request.url)
    const password = searchParams.get("password")

    if (!password) {
      return NextResponse.json(
        { error: "パスワードが必要です" },
        { status: 401 }
      )
    }

    // トークンを検証
    const accessToken = await prisma.individualEvaluationAccessToken.findUnique({
      where: { token },
      include: {
        employeeEvaluation: {
          include: {
            employee: {
              select: {
                id: true,
                companyId: true,
              },
            },
            evaluator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
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

    // 評価者トークンかチェック
    if (accessToken.type !== "evaluator") {
      return NextResponse.json(
        { error: "無効なトークンタイプです" },
        { status: 403 }
      )
    }

    // パスワードをハッシュ化して比較
    const hashedPassword = createHash("sha256").update(password).digest("hex")

    if (accessToken.password !== hashedPassword) {
      return NextResponse.json(
        { error: "パスワードが正しくありません" },
        { status: 401 }
      )
    }

    const { employeeEvaluation } = accessToken
    const { evaluator, employee } = employeeEvaluation

    if (!evaluator) {
      return NextResponse.json(
        { error: "評価者が設定されていません" },
        { status: 400 }
      )
    }

    // 会社情報を取得
    const company = await prisma.company.findUnique({
      where: { id: employee.companyId },
      select: { id: true, name: true },
    })

    // 評価期間情報を取得
    let period = null
    if (employeeEvaluation.evaluationPeriodId) {
      period = await prisma.evaluationPeriod.findUnique({
        where: { id: employeeEvaluation.evaluationPeriodId },
        select: { id: true, name: true },
      })
    }

    // 同じ評価者が担当する全評価を取得（自己評価完了済みのもの）
    const evaluations = await prisma.employeeEvaluation.findMany({
      where: {
        evaluatorId: evaluator.id,
        evaluationPeriodId: employeeEvaluation.evaluationPeriodId,
        evaluationType: "individual",
        status: { in: ["DISTRIBUTED", "COLLECTED"] },
        selfCompletedAt: { not: null },
      },
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
      orderBy: [
        { employee: { lastName: "asc" } },
        { employee: { firstName: "asc" } },
      ],
    })

    // 従業員ごとにデータを整形
    const employees = evaluations.map((evaluation) => {
      const items = evaluation.items

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
      const evaluatorScoredItems = items.filter(
        (i) => i.evaluatorScore !== null
      ).length
      const isCompleted = evaluation.evaluatorCompletedAt !== null

      return {
        evaluationId: evaluation.id,
        employeeId: evaluation.employee.id,
        firstName: evaluation.employee.firstName,
        lastName: evaluation.employee.lastName,
        department: evaluation.employee.department?.name || null,
        grade: evaluation.employee.grade?.name || null,
        jobType: evaluation.employee.jobType?.name || null,
        deadline: evaluation.responseDeadline,
        isCompleted,
        categories,
        progress: {
          total: totalItems,
          completed: evaluatorScoredItems,
          percentage:
            totalItems > 0
              ? Math.round((evaluatorScoredItems / totalItems) * 100)
              : 0,
        },
        evaluatorComment: evaluation.evaluatorComment,
      }
    })

    // 全体の進捗
    const totalEmployees = employees.length
    const completedEmployees = employees.filter((e) => e.isCompleted).length

    return NextResponse.json({
      evaluator: {
        id: evaluator.id,
        firstName: evaluator.firstName,
        lastName: evaluator.lastName,
      },
      company,
      period,
      employees,
      overallProgress: {
        total: totalEmployees,
        completed: completedEmployees,
        percentage:
          totalEmployees > 0
            ? Math.round((completedEmployees / totalEmployees) * 100)
            : 0,
      },
    })
  } catch (error) {
    console.error("従業員一覧取得エラー:", error)
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    )
  }
}
