import { PrismaClient } from "./src/generated/prisma/client.js"

const prisma = new PrismaClient()

async function test() {
  try {
    console.log("Testing employee360EvaluationItem model...")
    const count = await prisma.employee360EvaluationItem.count()
    console.log("Current count:", count)
    console.log("Model is accessible!")
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

test()
