/**
 * 職種グループ管理API
 * GET /api/companies/[id]/job-type-groups - グループ一覧取得
 * POST /api/companies/[id]/job-type-groups - グループ作成/更新
 * DELETE /api/companies/[id]/job-type-groups - グループ削除
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string }>
}

// グループ一覧取得
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId } = await context.params

    const groups = await prisma.gradeJobTypeGroup.findMany({
      where: { companyId },
      include: {
        grade: { select: { id: true, name: true, level: true } },
      },
      orderBy: { grade: { level: "desc" } },
    })

    return NextResponse.json(groups)
  } catch (error) {
    console.error("職種グループ取得エラー:", error)
    return NextResponse.json(
      { error: "取得に失敗しました" },
      { status: 500 }
    )
  }
}

// グループ作成/更新
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId } = await context.params
    const body = await request.json()
    const { gradeId, jobTypeIds } = body

    if (!gradeId || !Array.isArray(jobTypeIds) || jobTypeIds.length < 2) {
      return NextResponse.json(
        { error: "gradeIdと2つ以上のjobTypeIdsが必要です" },
        { status: 400 }
      )
    }

    // 既存のグループを削除（同じ等級・職種を含むグループ）
    const existingGroups = await prisma.gradeJobTypeGroup.findMany({
      where: { companyId, gradeId },
    })

    // 重複チェック：新しいグループに含まれる職種が既存グループにないか確認
    for (const group of existingGroups) {
      const existingJobTypeIds = group.jobTypeIds as string[]
      const hasOverlap = jobTypeIds.some((id: string) => existingJobTypeIds.includes(id))
      if (hasOverlap) {
        // 重複がある場合は既存グループを削除
        await prisma.gradeJobTypeGroup.delete({
          where: { id: group.id },
        })
      }
    }

    // 新しいグループを作成
    const newGroup = await prisma.gradeJobTypeGroup.create({
      data: {
        companyId,
        gradeId,
        jobTypeIds,
      },
      include: {
        grade: { select: { id: true, name: true, level: true } },
      },
    })

    return NextResponse.json(newGroup)
  } catch (error) {
    console.error("職種グループ作成エラー:", error)
    return NextResponse.json(
      { error: "作成に失敗しました" },
      { status: 500 }
    )
  }
}

// グループ削除
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { id: companyId } = await context.params
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get("groupId")
    const gradeId = searchParams.get("gradeId")
    const jobTypeId = searchParams.get("jobTypeId")

    if (groupId) {
      // グループIDで削除
      await prisma.gradeJobTypeGroup.delete({
        where: { id: groupId, companyId },
      })
    } else if (gradeId && jobTypeId) {
      // 等級と職種で該当グループから職種を削除
      const groups = await prisma.gradeJobTypeGroup.findMany({
        where: { companyId, gradeId },
      })

      for (const group of groups) {
        const jobTypeIds = group.jobTypeIds as string[]
        if (jobTypeIds.includes(jobTypeId)) {
          const newJobTypeIds = jobTypeIds.filter((id) => id !== jobTypeId)
          if (newJobTypeIds.length < 2) {
            // 2つ未満になったらグループ削除
            await prisma.gradeJobTypeGroup.delete({
              where: { id: group.id },
            })
          } else {
            // グループを更新
            await prisma.gradeJobTypeGroup.update({
              where: { id: group.id },
              data: { jobTypeIds: newJobTypeIds },
            })
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("職種グループ削除エラー:", error)
    return NextResponse.json(
      { error: "削除に失敗しました" },
      { status: 500 }
    )
  }
}
