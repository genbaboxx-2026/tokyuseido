import { PrismaClient } from './src/generated/prisma/index.js'

const prisma = new PrismaClient()

async function main() {
  const periods = await prisma.evaluationPeriod.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  console.log('Evaluation Periods:', JSON.stringify(periods, null, 2))
  
  const count = await prisma.evaluationPeriod.count()
  console.log('Total count:', count)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
