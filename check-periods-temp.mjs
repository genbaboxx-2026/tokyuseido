import { PrismaClient } from "./src/generated/prisma/client.js"

const prisma = new PrismaClient()

async function test() {
  try {
    console.log("Checking evaluation periods...")
    const periods = await prisma.evaluationPeriod.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    console.log("Evaluation Periods:", JSON.stringify(periods, null, 2))
    
    const count = await prisma.evaluationPeriod.count()
    console.log("Total count:", count)
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

test()
