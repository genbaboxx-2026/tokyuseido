import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  generateEvaluationResults,
  confirmEvaluationResults,
} from "@/lib/evaluation-result"
import type { FinalizeSummary } from "@/types/evaluation-result"

// GET: 既存の評価結果を取得
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await params

    const period = await prisma.evaluationPeriod.findFirst({
      where: { id: periodId, companyId },
    })
    if (!period) {
      return NextResponse.json({ error: "評価期間が見つかりません" }, { status: 404 })
    }

    const results = await prisma.evaluationResult.findMany({
      where: { evaluationPeriodId: periodId },
      include: {
        employee: {
          include: {
            grade: true,
            jobType: true,
            department: true,
          },
        },
      },
      orderBy: { combinedScore: "desc" },
    })

    if (results.length === 0) {
      return NextResponse.json({ results: [], summary: null, isGenerated: false })
    }

    const mapped = results.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employee: {
        id: r.employee.id,
        firstName: r.employee.firstName,
        lastName: r.employee.lastName,
        employeeCode: r.employee.employeeCode,
        grade: r.employee.grade
          ? { id: r.employee.grade.id, name: r.employee.grade.name, level: r.employee.grade.level }
          : null,
        jobType: r.employee.jobType
          ? { id: r.employee.jobType.id, name: r.employee.jobType.name }
          : null,
        department: r.employee.department
          ? { id: r.employee.department.id, name: r.employee.department.name }
          : null,
      },
      score360Raw: r.score360Raw,
      score360Max: r.score360Max,
      scoreIndividualRaw: r.scoreIndividualRaw,
      scoreIndividualMax: r.scoreIndividualMax,
      ratio360: r.ratio360,
      ratioIndividual: r.ratioIndividual,
      combinedScore: r.combinedScore,
      periodRank: r.periodRank,
      previousPeriodRank: r.previousPeriodRank,
      annualRank: r.annualRank,
      previousStep: r.previousStep,
      previousRank: r.previousRank,
      previousBaseSalary: r.previousBaseSalary,
      stepAdjustment: r.stepAdjustment,
      newStep: r.newStep,
      newRank: r.newRank,
      newBaseSalary: r.newBaseSalary,
      status: r.status,
      warnings: [] as string[],
    }))

    const rankDist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 }
    let up = 0, same = 0, down = 0, monthlyImpact = 0
    let missingRules = 0, missingStep = 0

    for (const r of mapped) {
      rankDist[r.annualRank]++
      if (r.stepAdjustment > 0) up++
      else if (r.stepAdjustment < 0) down++
      else same++
      if (r.newBaseSalary !== null && r.previousBaseSalary !== null) {
        monthlyImpact += r.newBaseSalary - r.previousBaseSalary
      }
      if (r.previousStep === null) missingStep++
    }

    const summary: FinalizeSummary = {
      totalEmployees: mapped.length,
      rankDistribution: rankDist as Record<string, number> as FinalizeSummary["rankDistribution"],
      stepChanges: { up, same, down },
      monthlyCostImpact: monthlyImpact,
      annualCostImpact: monthlyImpact * 12,
      missingAdjustmentRules: missingRules,
      missingStepEmployees: missingStep,
    }

    const isConfirmed = results.every((r) => r.status === "CONFIRMED")

    return NextResponse.json({
      results: mapped,
      summary,
      isGenerated: true,
      isConfirmed,
      finalizedAt: period.finalizedAt,
    })
  } catch (error) {
    console.error("GET /finalize error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "エラーが発生しました" },
      { status: 500 }
    )
  }
}

// POST: 評価結果を生成（計算実行）or 確定
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; periodId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId, periodId } = await params
    const body = await req.json().catch(() => ({}))
    const action = body.action as string | undefined

    if (action === "confirm") {
      const userId = session.user.id ?? session.user.email ?? "unknown"
      const result = await confirmEvaluationResults(companyId, periodId, userId)
      return NextResponse.json({ success: true, ...result })
    }

    // default: generate
    const data = await generateEvaluationResults(companyId, periodId)
    return NextResponse.json(data)
  } catch (error) {
    console.error("POST /finalize error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "エラーが発生しました" },
      { status: 500 }
    )
  }
}
