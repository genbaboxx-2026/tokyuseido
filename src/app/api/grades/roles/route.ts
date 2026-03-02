import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { gradeRoleSchema } from "@/lib/grade/schemas"

// GET: 役割責任一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    if (!companyId) {
      return NextResponse.json({ error: "会社IDは必須です" }, { status: 400 })
    }

    // 全ての等級×職種設定と役割責任を取得
    const configs = await prisma.gradeJobTypeConfig.findMany({
      where: {
        grade: { companyId },
        isEnabled: true,
      },
      include: {
        grade: true,
        jobType: {
          include: {
            jobCategory: true,
          },
        },
        gradeRole: true,
      },
      orderBy: [
        { grade: { level: "desc" } },
        { jobType: { name: "asc" } },
      ],
    })

    // 該当従業員を取得
    const employees = await prisma.employee.findMany({
      where: { companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        gradeId: true,
        jobTypeId: true,
        position: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // 等級×職種ごとに該当従業員をマッピング
    const employeeMap = new Map<string, typeof employees>()
    employees.forEach((employee) => {
      if (employee.gradeId && employee.jobTypeId) {
        const key = `${employee.gradeId}-${employee.jobTypeId}`
        const existing = employeeMap.get(key) || []
        existing.push(employee)
        employeeMap.set(key, existing)
      }
    })

    const roles = configs.map((config) => ({
      config,
      role: config.gradeRole,
      employees: employeeMap.get(`${config.gradeId}-${config.jobTypeId}`) || [],
    }))

    return NextResponse.json(roles)
  } catch (error) {
    console.error("役割責任一覧取得エラー:", error)
    return NextResponse.json({ error: "役割責任の取得に失敗しました" }, { status: 500 })
  }
}

// POST: 役割責任作成
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = gradeRoleSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "入力データが不正です", details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { gradeJobTypeConfigId, responsibilities, positionNames } = validationResult.data

    // 設定の存在確認
    const config = await prisma.gradeJobTypeConfig.findUnique({
      where: { id: gradeJobTypeConfigId },
      include: { gradeRole: true },
    })

    if (!config) {
      return NextResponse.json({ error: "等級×職種設定が見つかりません" }, { status: 404 })
    }

    // 既に役割責任が存在する場合はエラー
    if (config.gradeRole) {
      return NextResponse.json({ error: "役割責任が既に存在します。更新APIを使用してください" }, { status: 400 })
    }

    const gradeRole = await prisma.gradeRole.create({
      data: {
        gradeJobTypeConfigId,
        responsibilities,
        positionNames,
      },
      include: {
        gradeJobTypeConfig: {
          include: {
            grade: true,
            jobType: true,
          },
        },
      },
    })

    return NextResponse.json(gradeRole, { status: 201 })
  } catch (error) {
    console.error("役割責任作成エラー:", error)
    return NextResponse.json({ error: "役割責任の作成に失敗しました" }, { status: 500 })
  }
}
