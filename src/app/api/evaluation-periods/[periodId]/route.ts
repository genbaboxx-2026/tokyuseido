import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// GET: 評価期間の詳細を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { periodId } = await params

    const evaluationPeriod = await prisma.evaluationPeriod.findUnique({
      where: { id: periodId },
      include: {
        company: {
          select: {
            salaryReflectionMonth: true,
            salaryReflectionDay: true,
            evaluationPeriodStart: true,
            evaluationPeriodEnd: true,
          },
        },
      },
    })

    if (!evaluationPeriod) {
      return NextResponse.json(
        { error: "評価期間が見つかりません" },
        { status: 404 }
      )
    }

    // 賞与設定と評価を並列取得
    const [bonusSettings, evaluations] = await Promise.all([
      prisma.bonusSetting.findMany({
        where: { companyId: evaluationPeriod.companyId },
        select: {
          id: true,
          name: true,
          paymentDate: true,
          assessmentStartDate: true,
          assessmentEndDate: true,
        },
      }),
      prisma.employeeEvaluation.findMany({
        where: { evaluationPeriodId: periodId },
        include: {
          employee: {
            select: {
              id: true,
              lastName: true,
              firstName: true,
              grade: { select: { name: true } },
              jobType: { select: { name: true } },
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [
          { employee: { lastName: "asc" } },
          { employee: { firstName: "asc" } },
        ],
      }),
    ])

    const { company, ...periodData } = evaluationPeriod

    return NextResponse.json({
      ...periodData,
      evaluations,
      salarySettings: {
        reflectionMonth: company?.salaryReflectionMonth,
        reflectionDay: company?.salaryReflectionDay,
        evaluationPeriodStart: company?.evaluationPeriodStart,
        evaluationPeriodEnd: company?.evaluationPeriodEnd,
      },
      bonusSettings,
      _count: {
        evaluations: evaluations.length,
      },
    })
  } catch (error) {
    console.error("評価期間取得エラー:", error instanceof Error ? error.message : error)
    console.error("Stack:", error instanceof Error ? error.stack : "")
    return NextResponse.json(
      { error: "評価期間の取得に失敗しました", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
