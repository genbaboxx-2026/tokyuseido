import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type RouteParams = {
  params: Promise<{ id: string }>
}

// GET: 従業員別の評価設定一覧を取得
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId } = await params
    const { searchParams } = new URL(request.url)
    const periodId = searchParams.get("periodId") || undefined

    // 評価対象の従業員を取得（360度評価 または 個別評価が有効な従業員のみ）
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        status: "ACTIVE",
        OR: [
          { has360Evaluation: true },
          { hasIndividualEvaluation: true },
        ],
      },
      include: {
        department: { select: { id: true, name: true } },
        jobType: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true, level: true } },
        evaluationWeights: {
          where: periodId ? { periodId } : { periodId: null },
        },
      },
      orderBy: [
        { grade: { level: "desc" } },
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    })

    // 360度テンプレートを取得（等級×職種ごと）
    const templates360 = await prisma.evaluation360Template.findMany({
      where: {
        companyId,
        status: "confirmed",
        isActive: true,
      },
      include: {
        grades: { select: { id: true } },
        jobTypes: { select: { id: true } },
        categories: {
          include: {
            items: { select: { maxScore: true } },
          },
        },
      },
    })

    // 個別評価テンプレートを取得（等級×職種ごと）
    const individualTemplates = await prisma.evaluationTemplate.findMany({
      where: {
        gradeJobTypeConfig: {
          grade: { companyId },
        },
        status: "confirmed",
        isActive: true,
      },
      include: {
        gradeJobTypeConfig: {
          include: {
            grade: { select: { id: true } },
            jobType: { select: { id: true } },
          },
        },
        items: { select: { maxScore: true } },
      },
    })

    // 個人カスタマイズ項目を取得
    const customItems = await prisma.evaluationCustomItem.findMany({
      where: {
        companyId,
        periodId: periodId || null,
        isDeleted: false,
      },
      select: {
        employeeId: true,
        evaluationType: true,
        maxScore: true,
        isCustomized: true,
        isAdded: true,
      },
    })

    // 従業員ごとのカスタマイズ項目をグループ化
    const customItemsByEmployee = customItems.reduce((acc, item) => {
      if (!acc[item.employeeId]) {
        acc[item.employeeId] = { "360": [], individual: [] }
      }
      acc[item.employeeId][item.evaluationType as "360" | "individual"].push(item)
      return acc
    }, {} as Record<string, { "360": typeof customItems; individual: typeof customItems }>)

    // 従業員データを整形
    const result = employees.map((employee) => {
      // 360度テンプレートの満点を計算
      let score360Max: number | null = null
      let score360MaxCustomized = false

      const empCustom360 = customItemsByEmployee[employee.id]?.["360"]
      if (empCustom360 && empCustom360.length > 0) {
        score360Max = empCustom360.reduce((sum, item) => sum + item.maxScore, 0)
        score360MaxCustomized = empCustom360.some(item => item.isCustomized || item.isAdded)
      } else {
        // テンプレートから取得
        const matching360Template = templates360.find((t) =>
          t.grades.some((g) => g.id === employee.gradeId) &&
          t.jobTypes.some((jt) => jt.id === employee.jobTypeId)
        )
        if (matching360Template) {
          score360Max = matching360Template.categories.reduce(
            (sum, cat) => sum + cat.items.reduce((s, item) => s + item.maxScore, 0),
            0
          )
        }
      }

      // 個別評価テンプレートの満点を計算
      let scoreIndividualMax: number | null = null
      let scoreIndividualMaxCustomized = false

      const empCustomIndividual = customItemsByEmployee[employee.id]?.individual
      if (empCustomIndividual && empCustomIndividual.length > 0) {
        scoreIndividualMax = empCustomIndividual.reduce((sum, item) => sum + item.maxScore, 0)
        scoreIndividualMaxCustomized = empCustomIndividual.some(item => item.isCustomized || item.isAdded)
      } else {
        // テンプレートから取得
        const matchingIndividualTemplate = individualTemplates.find(
          (t) =>
            t.gradeJobTypeConfig.grade.id === employee.gradeId &&
            t.gradeJobTypeConfig.jobType.id === employee.jobTypeId
        )
        if (matchingIndividualTemplate) {
          scoreIndividualMax = matchingIndividualTemplate.items.reduce(
            (sum, item) => sum + item.maxScore,
            0
          )
        }
      }

      // 割合を取得（設定がなければデフォルト100%）
      const weightRecord = employee.evaluationWeights[0]
      const weight360 = weightRecord?.weight360 ?? 100
      const hasCustomWeight = !!weightRecord

      return {
        id: employee.id,
        employeeNumber: employee.employeeCode,
        name: `${employee.lastName} ${employee.firstName}`,
        department: employee.department?.name || null,
        jobType: employee.jobType?.name || null,
        grade: employee.grade?.name || null,
        gradeLevel: employee.grade?.level || 0,
        score360Max,
        scoreIndividualMax,
        score360MaxCustomized,
        scoreIndividualMaxCustomized,
        weight360,
        weightIndividual: 100 - weight360,
        hasCustomWeight,
      }
    })

    return NextResponse.json({ employees: result })
  } catch (error) {
    console.error("従業員評価設定取得エラー:", error)
    return NextResponse.json(
      { error: "従業員評価設定の取得に失敗しました" },
      { status: 500 }
    )
  }
}

// PUT: 従業員の評価割合を一括保存
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId } = await params
    const { searchParams } = new URL(request.url)
    const periodId = searchParams.get("periodId") || null
    const body = await request.json()
    const { weights } = body as {
      weights: { employeeId: string; weight360: number }[]
    }

    if (!Array.isArray(weights)) {
      return NextResponse.json(
        { error: "weights は配列である必要があります" },
        { status: 400 }
      )
    }

    // バリデーション
    for (const w of weights) {
      if (typeof w.weight360 !== "number" || w.weight360 < 0 || w.weight360 > 100) {
        return NextResponse.json(
          { error: "weight360 は0〜100の数値である必要があります" },
          { status: 400 }
        )
      }
    }

    // 一括upsert (periodIdがnullableなので、findFirst + update/createで対応)
    await prisma.$transaction(async (tx) => {
      for (const w of weights) {
        const existing = await tx.employeeEvaluationWeight.findFirst({
          where: {
            companyId,
            employeeId: w.employeeId,
            periodId,
          },
        })

        if (existing) {
          await tx.employeeEvaluationWeight.update({
            where: { id: existing.id },
            data: { weight360: w.weight360 },
          })
        } else {
          await tx.employeeEvaluationWeight.create({
            data: {
              companyId,
              employeeId: w.employeeId,
              periodId,
              weight360: w.weight360,
            },
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("従業員評価設定保存エラー:", error)
    return NextResponse.json(
      { error: "従業員評価設定の保存に失敗しました" },
      { status: 500 }
    )
  }
}
