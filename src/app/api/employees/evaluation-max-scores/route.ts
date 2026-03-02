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

    // 1項目あたりの最大スコア（個別評価用、デフォルト5点満点）
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

    // 360度評価テンプレートを取得（会社全体で使用する最新のテンプレート）
    const template360 = await prisma.evaluation360Template.findFirst({
      where: { companyId },
      include: {
        categories: {
          include: {
            items: {
              select: { maxScore: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // 360度評価の満点を計算（全カテゴリ×全項目の満点合計）
    let totalMaxScore360 = 0
    if (template360) {
      for (const category of template360.categories) {
        for (const item of category.items) {
          totalMaxScore360 += item.maxScore
        }
      }
    }

    // 従業員ごとの満点を計算
    const maxScores360: Record<string, number> = {}
    const maxScoresIndividual: Record<string, number> = {}

    for (const employee of employees) {
      // 360度評価の満点（全員同じテンプレートを使用）
      if (employee.has360Evaluation) {
        maxScores360[employee.id] = totalMaxScore360
      }

      // 個別評価の満点を計算
      if (employee.hasIndividualEvaluation) {
        let itemCount = 0

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
            const items = JSON.parse(customEvaluation.evaluatorComment)
            if (Array.isArray(items)) {
              itemCount = items.length
            }
          } catch {
            // パースエラーは無視
          }
        }

        // カスタムがなければテンプレートまたは役割責任から取得
        if (itemCount === 0 && employee.gradeId && employee.jobTypeId) {
          const config = await prisma.gradeJobTypeConfig.findFirst({
            where: {
              gradeId: employee.gradeId,
              jobTypeId: employee.jobTypeId,
              isEnabled: true,
            },
          })

          if (config) {
            // テンプレートを確認
            const template = await prisma.evaluationTemplate.findUnique({
              where: { gradeJobTypeConfigId: config.id },
              include: {
                items: { select: { id: true } },
              },
            })

            if (template) {
              itemCount = template.items.length
            } else {
              // 役割責任から取得
              const role = await prisma.gradeRole.findUnique({
                where: { gradeJobTypeConfigId: config.id },
              })

              if (role?.responsibilities) {
                const responsibilities = role.responsibilities as string[]
                itemCount = responsibilities.length
              }
            }
          }
        }

        maxScoresIndividual[employee.id] = itemCount * maxScorePerItem
      }
    }

    return NextResponse.json({
      maxScores360,
      maxScoresIndividual,
      maxScorePerItem,
    })
  } catch (error) {
    console.error("満点取得エラー:", error)
    return NextResponse.json(
      { error: "取得に失敗しました" },
      { status: 500 }
    )
  }
}
