/**
 * 従業員の評価満点一括取得API
 * GET /api/employees/evaluation-max-scores?companyId=xxx
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    if (!companyId) {
      return NextResponse.json(
        { error: "companyIdが必要です" },
        { status: 400 }
      )
    }

    // 1項目あたりの最大スコア（デフォルト5点満点）
    const maxScorePerItem = 5

    // 会社の従業員を取得
    const employees = await prisma.employee.findMany({
      where: { companyId, status: "ACTIVE" },
      select: {
        id: true,
        gradeId: true,
        jobTypeId: true,
        has360Evaluation: true,
        hasIndividualEvaluation: true,
      },
    })

    // 会社のすべての評価テンプレート（個別評価用）を一括取得
    const allTemplates = await prisma.evaluationTemplate.findMany({
      where: {
        gradeJobTypeConfig: {
          grade: { companyId },
        },
      },
      include: {
        gradeJobTypeConfig: {
          select: {
            gradeId: true,
            jobTypeId: true,
          },
        },
        items: {
          select: { maxScore: true },
        },
      },
    })

    // gradeId-jobTypeId -> テンプレート満点のマップを作成
    const templateScoreMap = new Map<string, number>()
    console.log(`[満点API] テンプレート数: ${allTemplates.length}`)
    for (const template of allTemplates) {
      const key = `${template.gradeJobTypeConfig.gradeId}-${template.gradeJobTypeConfig.jobTypeId}`
      const totalScore = template.items.reduce((sum, item) => sum + item.maxScore, 0)
      console.log(`[満点API] テンプレート: ${key} -> ${totalScore}点 (${template.items.length}項目)`)
      templateScoreMap.set(key, totalScore)
    }

    // 会社のすべての役割責任を一括取得
    const allRoles = await prisma.gradeRole.findMany({
      where: {
        gradeJobTypeConfig: {
          grade: { companyId },
        },
      },
      include: {
        gradeJobTypeConfig: {
          select: {
            gradeId: true,
            jobTypeId: true,
          },
        },
      },
    })

    // gradeId-jobTypeId -> 役割責任数のマップを作成
    const roleCountMap = new Map<string, number>()
    for (const role of allRoles) {
      const key = `${role.gradeJobTypeConfig.gradeId}-${role.gradeJobTypeConfig.jobTypeId}`
      const responsibilities = role.responsibilities as string[] | null
      if (responsibilities && responsibilities.length > 0) {
        roleCountMap.set(key, responsibilities.length * maxScorePerItem)
      }
    }

    // 360度評価テンプレートを取得
    const templates360 = await prisma.evaluation360Template.findMany({
      where: { companyId, status: "confirmed" },
      include: {
        grades: { select: { gradeId: true } },
        jobTypes: { select: { jobTypeId: true } },
        categories: {
          include: {
            items: {
              select: { maxScore: true },
            },
          },
        },
      },
    })

    // テンプレートごとの満点を計算
    const templateMaxScores360 = new Map<string, number>()
    for (const template of templates360) {
      let total = 0
      for (const category of template.categories) {
        for (const item of category.items) {
          total += item.maxScore
        }
      }
      templateMaxScores360.set(template.id, total)
    }

    // 従業員ごとの満点を計算
    const maxScores360: Record<string, number> = {}
    const maxScoresIndividual: Record<string, number> = {}

    for (const employee of employees) {
      const gradeJobTypeKey = employee.gradeId && employee.jobTypeId
        ? `${employee.gradeId}-${employee.jobTypeId}`
        : null

      // 360度評価の満点
      if (employee.has360Evaluation) {
        // カスタマイズされた評価項目を確認
        const customItems = await prisma.employee360EvaluationItem.findMany({
          where: { employeeId: employee.id },
          select: { maxScore: true },
        })

        if (customItems.length > 0) {
          maxScores360[employee.id] = customItems.reduce((sum, item) => sum + item.maxScore, 0)
        } else {
          // 等級・職種に合致するテンプレートを使用
          const matchingTemplates = templates360.filter((t) => {
            const hasGrade = t.grades.some((g) => g.gradeId === employee.gradeId)
            const hasJobType = t.jobTypes.some((jt) => jt.jobTypeId === employee.jobTypeId)
            return hasGrade && hasJobType && t.categories.length > 0
          })

          if (matchingTemplates.length > 0) {
            const mostSpecific = matchingTemplates.sort((a, b) => {
              return (a.grades.length + a.jobTypes.length) - (b.grades.length + b.jobTypes.length)
            })[0]
            maxScores360[employee.id] = templateMaxScores360.get(mostSpecific.id) || 0
          } else {
            maxScores360[employee.id] = 0
          }
        }
      }

      // 個別評価の満点
      if (employee.hasIndividualEvaluation) {
        let totalMaxScore = 0
        console.log(`[満点API] 従業員: ${employee.id}, gradeId: ${employee.gradeId}, jobTypeId: ${employee.jobTypeId}, key: ${gradeJobTypeKey}`)

        // カスタム評価項目を確認
        const customEvaluation = await prisma.employeeEvaluation.findFirst({
          where: {
            employeeId: employee.id,
            evaluationType: "custom_items",
            evaluatorComment: { not: null },
          },
          select: { evaluatorComment: true },
        })

        if (customEvaluation?.evaluatorComment) {
          try {
            const items = JSON.parse(customEvaluation.evaluatorComment) as Array<{ maxScore?: number }>
            if (Array.isArray(items)) {
              totalMaxScore = items.reduce((sum, item) => sum + (item.maxScore ?? maxScorePerItem), 0)
            }
          } catch {
            // パースエラーは無視
          }
        }

        // カスタムがなければテンプレートから取得
        if (totalMaxScore === 0 && gradeJobTypeKey) {
          const templateScore = templateScoreMap.get(gradeJobTypeKey)
          console.log(`[満点API] key: ${gradeJobTypeKey}, templateScore: ${templateScore}`)
          if (templateScore && templateScore > 0) {
            totalMaxScore = templateScore
            console.log(`[満点API] テンプレートから取得: ${totalMaxScore}`)
          } else {
            // テンプレートがなければ役割責任から取得
            const roleScore = roleCountMap.get(gradeJobTypeKey)
            console.log(`[満点API] roleScore: ${roleScore}`)
            if (roleScore && roleScore > 0) {
              totalMaxScore = roleScore
              console.log(`[満点API] 役割責任から取得: ${totalMaxScore}`)
            }
          }
        }

        maxScoresIndividual[employee.id] = totalMaxScore
      }
    }

    // デバッグ情報
    const debug = {
      templateCount: allTemplates.length,
      templateKeys: Array.from(templateScoreMap.keys()),
      roleKeys: Array.from(roleCountMap.keys()),
      employeesWithIndividual: employees.filter(e => e.hasIndividualEvaluation).map(e => ({
        id: e.id,
        gradeId: e.gradeId,
        jobTypeId: e.jobTypeId,
        key: e.gradeId && e.jobTypeId ? `${e.gradeId}-${e.jobTypeId}` : null,
      })),
    }

    return NextResponse.json({
      maxScores360,
      maxScoresIndividual,
      maxScorePerItem,
      _debug: debug,
    })
  } catch (error) {
    console.error("満点取得エラー:", error)
    return NextResponse.json(
      { error: "取得に失敗しました" },
      { status: 500 }
    )
  }
}
