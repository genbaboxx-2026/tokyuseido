import { prisma } from "@/lib/prisma"
import type { EvaluationRating } from "@/generated/prisma"
import type { EvaluationResultData, FinalizeSummary } from "@/types/evaluation-result"

const DEFAULT_THRESHOLDS: { rank: EvaluationRating; min: number }[] = [
  { rank: "S", min: 95 },
  { rank: "A", min: 85 },
  { rank: "B", min: 70 },
  { rank: "C", min: 50 },
  { rank: "D", min: 0 },
]

interface EmployeeScoreData {
  employeeId: string
  score360Raw: number | null
  score360Max: number | null
  scoreIndividualRaw: number | null
  scoreIndividualMax: number | null
  ratio360: number
  ratioIndividual: number
}

function scoreToRank(
  score: number,
  thresholds: { rank: EvaluationRating; min: number }[]
): EvaluationRating {
  const sorted = [...thresholds].sort((a, b) => b.min - a.min)
  for (const t of sorted) {
    if (score >= t.min) return t.rank
  }
  return "D"
}

function calculateCombinedScore(data: EmployeeScoreData): number {
  const has360 = data.score360Raw !== null && data.score360Max !== null && data.score360Max > 0
  const hasIndividual =
    data.scoreIndividualRaw !== null &&
    data.scoreIndividualMax !== null &&
    data.scoreIndividualMax > 0

  if (has360 && hasIndividual) {
    const s360 = (data.score360Raw! / data.score360Max!) * data.ratio360
    const sInd = (data.scoreIndividualRaw! / data.scoreIndividualMax!) * data.ratioIndividual
    return Math.round((s360 + sInd) * 10) / 10
  }
  if (has360) {
    return Math.round((data.score360Raw! / data.score360Max!) * 100 * 10) / 10
  }
  if (hasIndividual) {
    return Math.round((data.scoreIndividualRaw! / data.scoreIndividualMax!) * 100 * 10) / 10
  }
  return 0
}

export async function generateEvaluationResults(
  companyId: string,
  periodId: string
): Promise<{ results: EvaluationResultData[]; summary: FinalizeSummary }> {
  const period = await prisma.evaluationPeriod.findFirst({
    where: { id: periodId, companyId },
  })
  if (!period) throw new Error("評価期間が見つかりません")

  // 1. 完了済み個別評価を取得
  const individualEvals = await prisma.employeeEvaluation.findMany({
    where: {
      evaluationPeriodId: periodId,
      status: "COMPLETED",
    },
    include: {
      items: { include: { evaluationTemplateItem: true } },
      employee: {
        include: {
          grade: true,
          jobType: true,
          department: true,
        },
      },
    },
  })

  // 2. 完了済み360度評価を取得
  const eval360Records = await prisma.evaluation360Record.findMany({
    where: {
      evaluationPeriodId: periodId,
      companyId,
      status: "completed",
    },
    include: {
      employee: {
        include: {
          grade: true,
          jobType: true,
          department: true,
        },
      },
      reviewerAssignments: {
        where: { status: "submitted" },
        include: {
          scores: {
            include: { evaluationCustomItem: true },
          },
        },
      },
    },
  })

  // 3. 割合設定を取得
  const weights = await prisma.employeeEvaluationWeight.findMany({
    where: { companyId, periodId },
  })
  const weightMap = new Map(weights.map((w) => [w.employeeId, w.weight360]))

  const defaultWeight360 = 70

  // 4. ランク閾値を取得
  const scoringMethod = await prisma.evaluationScoringMethod.findUnique({
    where: { companyId },
    include: { ranks: { orderBy: { sortOrder: "asc" } } },
  })
  const thresholds: { rank: EvaluationRating; min: number }[] =
    scoringMethod?.ranks?.length
      ? scoringMethod.ranks.map((r) => ({
          rank: r.rankName as EvaluationRating,
          min: r.minScore,
        }))
      : DEFAULT_THRESHOLDS

  // 5. 前期結果を取得（年2回の場合）
  let previousResults: Map<string, EvaluationRating> | null = null
  if (period.periodType === "SECOND_HALF") {
    const previousPeriod = await prisma.evaluationPeriod.findFirst({
      where: {
        companyId,
        periodType: "FIRST_HALF",
        id: { not: periodId },
        finalizedAt: { not: null },
      },
      orderBy: { endDate: "desc" },
    })
    if (previousPeriod) {
      const prevResults = await prisma.evaluationResult.findMany({
        where: {
          evaluationPeriodId: previousPeriod.id,
          status: "CONFIRMED",
        },
      })
      previousResults = new Map(prevResults.map((r) => [r.employeeId, r.periodRank]))
    }
  }

  // 6. EvaluationCriteria（前期×後期マトリクス）を取得
  const criteriaList = await prisma.evaluationCriteria.findMany({
    where: { companyId },
  })
  const criteriaMap = new Map(
    criteriaList.map((c) => [`${c.firstHalfRating}_${c.secondHalfRating}`, c.finalRating])
  )

  // 7. 号俸改定基準を取得
  const adjustmentRules = await prisma.gradeAdjustmentRule.findMany({
    where: {
      grade: { companyId },
    },
  })
  const adjustmentMap = new Map(
    adjustmentRules.map((r) => [`${r.gradeId}_${r.currentRank}_${r.rating}`, r.stepAdjustment])
  )

  // 8. 号俸テーブルを取得
  const salaryTable = await prisma.salaryTable.findFirst({
    where: { companyId, isActive: true },
    include: {
      entries: { orderBy: { stepNumber: "asc" } },
    },
  })

  // 全対象従業員をまとめる（個別 + 360度の合算）
  const employeeMap = new Map<
    string,
    {
      employee: NonNullable<(typeof individualEvals)[0]>["employee"]
      individualScore: number | null
      individualMax: number | null
      score360: number | null
      score360Max: number | null
    }
  >()

  for (const ev of individualEvals) {
    const evalScore = ev.items.reduce((sum, item) => sum + (item.evaluatorScore ?? 0), 0)
    const evalMax = ev.items.reduce(
      (sum, item) => sum + (item.evaluationTemplateItem?.maxScore ?? 0),
      0
    )
    const existing = employeeMap.get(ev.employeeId)
    employeeMap.set(ev.employeeId, {
      employee: ev.employee,
      individualScore: evalScore,
      individualMax: evalMax,
      score360: existing?.score360 ?? null,
      score360Max: existing?.score360Max ?? null,
    })
  }

  for (const rec of eval360Records) {
    const allScores = rec.reviewerAssignments.flatMap((ra) => ra.scores)
    if (allScores.length === 0) continue

    const itemScores = new Map<string, number[]>()
    for (const s of allScores) {
      if (s.score === null) continue
      const existing = itemScores.get(s.evaluationCustomItemId) ?? []
      existing.push(s.score)
      itemScores.set(s.evaluationCustomItemId, existing)
    }

    let totalAvg = 0
    let totalMax = 0
    for (const [itemId, scores] of itemScores) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      totalAvg += avg
      const item = allScores.find((s) => s.evaluationCustomItemId === itemId)
      totalMax += item?.evaluationCustomItem?.maxScore ?? 5
    }

    const existing = employeeMap.get(rec.employeeId)
    employeeMap.set(rec.employeeId, {
      employee: existing?.employee ?? rec.employee,
      individualScore: existing?.individualScore ?? null,
      individualMax: existing?.individualMax ?? null,
      score360: Math.round(totalAvg * 10) / 10,
      score360Max: totalMax,
    })
  }

  // 9. 各従業員の結果を計算
  const results: EvaluationResultData[] = []

  for (const [employeeId, data] of employeeMap) {
    const warnings: string[] = []
    const w360 = weightMap.get(employeeId) ?? defaultWeight360
    const ratio360 = w360
    const ratioIndividual = 100 - w360

    const combinedScore = calculateCombinedScore({
      employeeId,
      score360Raw: data.score360,
      score360Max: data.score360Max,
      scoreIndividualRaw: data.individualScore,
      scoreIndividualMax: data.individualMax,
      ratio360,
      ratioIndividual,
    })

    const periodRank = scoreToRank(combinedScore, thresholds)

    let previousPeriodRank: EvaluationRating | null = null
    let annualRank = periodRank

    if (previousResults) {
      previousPeriodRank = previousResults.get(employeeId) ?? null
      if (previousPeriodRank) {
        const key = `${previousPeriodRank}_${periodRank}`
        annualRank = criteriaMap.get(key) ?? periodRank
      }
    }

    const emp = data.employee
    const previousStep = emp.currentStep
    const previousRank = emp.currentRank
    const previousBaseSalary = emp.baseSalary

    let stepAdjustment = 0
    let newStep: number | null = null
    let newRank: string | null = null
    let newBaseSalary: number | null = null

    if (previousStep !== null && emp.gradeId && previousRank) {
      const rankLetter = previousRank.replace(/[0-9]/g, "")
      const adjustKey = `${emp.gradeId}_${rankLetter}_${annualRank}`
      const adj = adjustmentMap.get(adjustKey)

      if (adj !== undefined) {
        stepAdjustment = adj
      } else {
        warnings.push("改定基準未設定")
      }

      newStep = Math.max(1, previousStep + stepAdjustment)

      if (salaryTable && emp.gradeId) {
        const maxStep = salaryTable.entries
          .filter((e) => e.gradeId === emp.gradeId)
          .reduce((max, e) => Math.max(max, e.stepNumber), 0)
        if (maxStep > 0) {
          newStep = Math.min(newStep, maxStep)
        }

        const entry = salaryTable.entries.find(
          (e) => e.gradeId === emp.gradeId && e.stepNumber === newStep
        )
        if (entry) {
          newRank = entry.rank
          newBaseSalary = entry.baseSalary
        }
      }
    } else {
      if (previousStep === null) warnings.push("号俸未設定")
    }

    results.push({
      id: "",
      employeeId,
      employee: {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        employeeCode: emp.employeeCode,
        grade: emp.grade ? { id: emp.grade.id, name: emp.grade.name, level: emp.grade.level } : null,
        jobType: emp.jobType ? { id: emp.jobType.id, name: emp.jobType.name } : null,
        department: emp.department ? { id: emp.department.id, name: emp.department.name } : null,
      },
      score360Raw: data.score360,
      score360Max: data.score360Max,
      scoreIndividualRaw: data.individualScore,
      scoreIndividualMax: data.individualMax,
      ratio360,
      ratioIndividual,
      combinedScore,
      periodRank,
      previousPeriodRank,
      annualRank,
      previousStep,
      previousRank,
      previousBaseSalary,
      stepAdjustment,
      newStep,
      newRank,
      newBaseSalary,
      status: "DRAFT",
      warnings,
    })
  }

  results.sort((a, b) => b.combinedScore - a.combinedScore)

  // 10. DBに保存（upsert）
  for (const r of results) {
    const saved = await prisma.evaluationResult.upsert({
      where: {
        evaluationPeriodId_employeeId: {
          evaluationPeriodId: periodId,
          employeeId: r.employeeId,
        },
      },
      create: {
        evaluationPeriodId: periodId,
        employeeId: r.employeeId,
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
        status: "DRAFT",
      },
      update: {
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
        status: "DRAFT",
        confirmedAt: null,
        confirmedBy: null,
      },
    })
    r.id = saved.id
  }

  const summary = buildSummary(results)

  return { results, summary }
}

export async function confirmEvaluationResults(
  companyId: string,
  periodId: string,
  userId?: string
): Promise<{ confirmedAt: string; updatedEmployees: number; skippedEmployees: number }> {
  const period = await prisma.evaluationPeriod.findFirst({
    where: { id: periodId, companyId },
  })
  if (!period) throw new Error("評価期間が見つかりません")
  if (period.finalizedAt) throw new Error("この評価期間は既に確定済みです")

  const results = await prisma.evaluationResult.findMany({
    where: { evaluationPeriodId: periodId, status: "DRAFT" },
  })
  if (results.length === 0) throw new Error("確定対象の評価結果がありません")

  const now = new Date()
  let updatedEmployees = 0
  let skippedEmployees = 0

  const salaryTable = await prisma.salaryTable.findFirst({
    where: { companyId, isActive: true },
    include: { entries: true },
  })

  await prisma.$transaction(async (tx) => {
    for (const r of results) {
      if (r.newStep === null || r.newBaseSalary === null) {
        skippedEmployees++
        await tx.evaluationResult.update({
          where: { id: r.id },
          data: { status: "CONFIRMED", confirmedAt: now, confirmedBy: userId },
        })
        continue
      }

      await tx.employee.update({
        where: { id: r.employeeId },
        data: {
          currentStep: r.newStep,
          currentRank: r.newRank,
          baseSalary: r.newBaseSalary,
        },
      })

      let salaryTableEntryId: string | null = null
      if (salaryTable) {
        const entry = salaryTable.entries.find(
          (e) => e.stepNumber === r.newStep && e.baseSalary === r.newBaseSalary
        )
        if (entry) salaryTableEntryId = entry.id

        await tx.employeeCurrentSalary.upsert({
          where: {
            employeeId_salaryTableId: {
              employeeId: r.employeeId,
              salaryTableId: salaryTable.id,
            },
          },
          create: {
            employeeId: r.employeeId,
            salaryTableId: salaryTable.id,
            currentSalary: r.newBaseSalary,
          },
          update: {
            currentSalary: r.newBaseSalary,
          },
        })
      }

      await tx.employeeSalary.create({
        data: {
          employeeId: r.employeeId,
          effectiveDate: now,
          baseSalary: r.newBaseSalary,
          salaryTableEntryId,
          reason: `評価確定: ${period.name}`,
        },
      })

      await tx.evaluationResult.update({
        where: { id: r.id },
        data: { status: "CONFIRMED", confirmedAt: now, confirmedBy: userId },
      })

      updatedEmployees++
    }

    await tx.evaluationPeriod.update({
      where: { id: periodId },
      data: {
        status: "COMPLETED",
        finalizedAt: now,
        finalizedBy: userId,
      },
    })
  })

  return {
    confirmedAt: now.toISOString(),
    updatedEmployees,
    skippedEmployees,
  }
}

function buildSummary(results: EvaluationResultData[]): FinalizeSummary {
  const rankDist: Record<EvaluationRating, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 }
  let up = 0, same = 0, down = 0
  let monthlyCostImpact = 0
  let missingAdjustmentRules = 0
  let missingStepEmployees = 0

  for (const r of results) {
    rankDist[r.annualRank]++

    if (r.stepAdjustment > 0) up++
    else if (r.stepAdjustment < 0) down++
    else same++

    if (r.newBaseSalary !== null && r.previousBaseSalary !== null) {
      monthlyCostImpact += r.newBaseSalary - r.previousBaseSalary
    }

    if (r.warnings.includes("改定基準未設定")) missingAdjustmentRules++
    if (r.warnings.includes("号俸未設定")) missingStepEmployees++
  }

  return {
    totalEmployees: results.length,
    rankDistribution: rankDist,
    stepChanges: { up, same, down },
    monthlyCostImpact,
    annualCostImpact: monthlyCostImpact * 12,
    missingAdjustmentRules,
    missingStepEmployees,
  }
}
