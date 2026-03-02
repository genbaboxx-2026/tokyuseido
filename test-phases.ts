import 'dotenv/config'
import { PrismaClient } from "./src/generated/prisma/client"

const prisma = new PrismaClient()

async function main() {
  const companyId = 'test-company-1'
  const periodId = 'cmm5i7ou900018zawu628zrat'
  
  // Get current employees
  const employees = await prisma.employee.findMany({
    where: { companyId, status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true, gradeId: true, jobTypeId: true }
  })
  
  console.log('Current employees:', employees.length)
  
  // Get the evaluation template
  const template = await prisma.evaluationTemplate.findFirst({
    where: {
      gradeJobTypeConfig: {
        grade: { companyId },
        isEnabled: true,
      },
      isActive: true,
    },
    include: {
      items: { select: { id: true } },
    },
  })
  
  console.log('Template found:', template?.id)
  
  // Get current evaluations
  const currentEvals = await prisma.employeeEvaluation.findMany({
    where: { evaluationPeriodId: periodId },
    select: { id: true, employeeId: true, status: true }
  })
  
  console.log('Current evaluations:')
  for (const e of currentEvals) {
    console.log(`  - ${e.id}: ${e.status}`)
  }
  
  // Check 360 records
  const current360 = await prisma.evaluation360Record.findMany({
    where: { evaluationPeriodId: periodId },
    select: { id: true, employeeId: true, status: true }
  })
  
  console.log('Current 360 records:')
  for (const r of current360) {
    console.log(`  - ${r.id}: ${r.status}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
