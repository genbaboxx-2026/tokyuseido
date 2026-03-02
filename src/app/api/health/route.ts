import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    },
  }

  try {
    const userCount = await prisma.user.count()
    checks.db = { connected: true, userCount }

    if (userCount > 0) {
      const user = await prisma.user.findFirst({
        where: { email: "admin@example.com" },
        select: { id: true, email: true, password: true },
      })
      checks.adminUser = user
        ? { exists: true, hasPassword: !!user.password }
        : { exists: false }

      if (user?.password) {
        const valid = await bcrypt.compare("password123", user.password)
        checks.bcryptCheck = { valid }
      }
    }
  } catch (e) {
    checks.db = {
      connected: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }

  return NextResponse.json(checks)
}
