import "dotenv/config"
import { PrismaClient, UserRole, EmploymentType, EvaluationCycle } from "../generated/prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // 1. テスト用会社を作成
  const company = await prisma.company.upsert({
    where: { id: "test-company-1" },
    update: {},
    create: {
      id: "test-company-1",
      name: "株式会社サンプル解体",
      address: "東京都渋谷区渋谷1-1-1",
      representative: "山田太郎",
      businessDescription: "解体工事業",
      evaluationCycle: EvaluationCycle.HALF_YEARLY,
    },
  })
  console.log(`Created company: ${company.name}`)

  // 2. テスト用ユーザーを作成（パスワードをハッシュ化）
  const hashedPassword = await bcrypt.hash("password123", 10)

  // 管理者ユーザー
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { password: hashedPassword },
    create: {
      email: "admin@example.com",
      password: hashedPassword,
      name: "システム管理者",
      role: UserRole.ADMIN,
    },
  })
  console.log(`Created admin user: ${adminUser.email}`)

  // 会社管理者ユーザー
  const companyAdmin = await prisma.user.upsert({
    where: { email: "company-admin@example.com" },
    update: { password: hashedPassword },
    create: {
      email: "company-admin@example.com",
      password: hashedPassword,
      name: "会社管理者",
      role: UserRole.COMPANY_ADMIN,
      companyId: company.id,
    },
  })
  console.log(`Created company admin: ${companyAdmin.email}`)

  // 3. 部署を作成
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { id: "dept-1" },
      update: {},
      create: {
        id: "dept-1",
        companyId: company.id,
        name: "現場部門",
      },
    }),
    prisma.department.upsert({
      where: { id: "dept-2" },
      update: {},
      create: {
        id: "dept-2",
        companyId: company.id,
        name: "管理部門",
      },
    }),
  ])
  console.log(`Created ${departments.length} departments`)

  // 4. 役職を作成
  const positions = await Promise.all([
    prisma.position.upsert({
      where: { companyId_name: { companyId: company.id, name: "部長" } },
      update: {},
      create: { companyId: company.id, name: "部長", level: 5 },
    }),
    prisma.position.upsert({
      where: { companyId_name: { companyId: company.id, name: "次長" } },
      update: {},
      create: { companyId: company.id, name: "次長", level: 4 },
    }),
    prisma.position.upsert({
      where: { companyId_name: { companyId: company.id, name: "課長" } },
      update: {},
      create: { companyId: company.id, name: "課長", level: 3 },
    }),
    prisma.position.upsert({
      where: { companyId_name: { companyId: company.id, name: "職長" } },
      update: {},
      create: { companyId: company.id, name: "職長", level: 2 },
    }),
    prisma.position.upsert({
      where: { companyId_name: { companyId: company.id, name: "一般" } },
      update: {},
      create: { companyId: company.id, name: "一般", level: 1 },
    }),
  ])
  console.log(`Created ${positions.length} positions`)

  // 5. 職種大分類を作成
  const jobCategories = await Promise.all([
    prisma.jobCategory.upsert({
      where: { companyId_name: { companyId: company.id, name: "現場" } },
      update: {},
      create: { companyId: company.id, name: "現場" },
    }),
    prisma.jobCategory.upsert({
      where: { companyId_name: { companyId: company.id, name: "管理" } },
      update: {},
      create: { companyId: company.id, name: "管理" },
    }),
  ])
  console.log(`Created ${jobCategories.length} job categories`)

  // 6. 職種小分類を作成
  const currentJobCategory = jobCategories.find((jc) => jc.name === "現場")!
  const managementJobCategory = jobCategories.find((jc) => jc.name === "管理")!

  const jobTypes = await Promise.all([
    prisma.jobType.upsert({
      where: { jobCategoryId_name: { jobCategoryId: currentJobCategory.id, name: "多能工" } },
      update: {},
      create: { jobCategoryId: currentJobCategory.id, name: "多能工" },
    }),
    prisma.jobType.upsert({
      where: { jobCategoryId_name: { jobCategoryId: currentJobCategory.id, name: "ドライバー" } },
      update: {},
      create: { jobCategoryId: currentJobCategory.id, name: "ドライバー" },
    }),
    prisma.jobType.upsert({
      where: { jobCategoryId_name: { jobCategoryId: currentJobCategory.id, name: "オペレーター" } },
      update: {},
      create: { jobCategoryId: currentJobCategory.id, name: "オペレーター" },
    }),
    prisma.jobType.upsert({
      where: { jobCategoryId_name: { jobCategoryId: currentJobCategory.id, name: "解体D" } },
      update: {},
      create: { jobCategoryId: currentJobCategory.id, name: "解体D" },
    }),
    prisma.jobType.upsert({
      where: { jobCategoryId_name: { jobCategoryId: managementJobCategory.id, name: "経営管理職群" } },
      update: {},
      create: { jobCategoryId: managementJobCategory.id, name: "経営管理職群" },
    }),
    prisma.jobType.upsert({
      where: { jobCategoryId_name: { jobCategoryId: managementJobCategory.id, name: "技術専門職群" } },
      update: {},
      create: { jobCategoryId: managementJobCategory.id, name: "技術専門職群" },
    }),
  ])
  console.log(`Created ${jobTypes.length} job types`)

  // 7. 等級を作成
  const grades = await Promise.all([
    prisma.grade.upsert({
      where: { companyId_name: { companyId: company.id, name: "正1" } },
      update: {},
      create: { companyId: company.id, name: "正1", level: 6, employmentType: EmploymentType.FULL_TIME, isManagement: true },
    }),
    prisma.grade.upsert({
      where: { companyId_name: { companyId: company.id, name: "正2" } },
      update: {},
      create: { companyId: company.id, name: "正2", level: 5, employmentType: EmploymentType.FULL_TIME, isManagement: true },
    }),
    prisma.grade.upsert({
      where: { companyId_name: { companyId: company.id, name: "正3" } },
      update: {},
      create: { companyId: company.id, name: "正3", level: 4, employmentType: EmploymentType.FULL_TIME, isManagement: false },
    }),
    prisma.grade.upsert({
      where: { companyId_name: { companyId: company.id, name: "正4" } },
      update: {},
      create: { companyId: company.id, name: "正4", level: 3, employmentType: EmploymentType.FULL_TIME, isManagement: false },
    }),
    prisma.grade.upsert({
      where: { companyId_name: { companyId: company.id, name: "正5" } },
      update: {},
      create: { companyId: company.id, name: "正5", level: 2, employmentType: EmploymentType.FULL_TIME, isManagement: false },
    }),
    prisma.grade.upsert({
      where: { companyId_name: { companyId: company.id, name: "正6" } },
      update: {},
      create: { companyId: company.id, name: "正6", level: 1, employmentType: EmploymentType.FULL_TIME, isManagement: false },
    }),
  ])
  console.log(`Created ${grades.length} grades`)

  // 8. 等級×職種の有効/無効設定を作成（要件定義書のマトリクスに基づく）
  const gradeJobTypeConfigs: { gradeId: string; jobTypeId: string; isEnabled: boolean }[] = []

  for (const grade of grades) {
    for (const jobType of jobTypes) {
      let isEnabled = true

      // 要件定義書のマトリクスに基づいて有効/無効を設定
      const gradeName = grade.name
      const jobTypeName = jobType.name

      // 多能工: 正1, 正2は存在しない
      if (jobTypeName === "多能工" && (gradeName === "正1" || gradeName === "正2")) {
        isEnabled = false
      }
      // ドライバー: 正1, 正2, 正6は存在しない
      if (jobTypeName === "ドライバー" && (gradeName === "正1" || gradeName === "正2" || gradeName === "正6")) {
        isEnabled = false
      }
      // オペレーター: 正1, 正5, 正6は存在しない
      if (jobTypeName === "オペレーター" && (gradeName === "正1" || gradeName === "正5" || gradeName === "正6")) {
        isEnabled = false
      }
      // 解体D: 正5, 正6は存在しない
      if (jobTypeName === "解体D" && (gradeName === "正5" || gradeName === "正6")) {
        isEnabled = false
      }

      gradeJobTypeConfigs.push({
        gradeId: grade.id,
        jobTypeId: jobType.id,
        isEnabled,
      })
    }
  }

  for (const config of gradeJobTypeConfigs) {
    await prisma.gradeJobTypeConfig.upsert({
      where: { gradeId_jobTypeId: { gradeId: config.gradeId, jobTypeId: config.jobTypeId } },
      update: { isEnabled: config.isEnabled },
      create: config,
    })
  }
  console.log(`Created ${gradeJobTypeConfigs.length} grade-job type configs`)

  // 9. テスト用従業員を作成
  const multiSkillJobType = jobTypes.find((jt) => jt.name === "多能工")!
  const driverJobType = jobTypes.find((jt) => jt.name === "ドライバー")!
  const operatorJobType = jobTypes.find((jt) => jt.name === "オペレーター")!
  const kaitaiDJobType = jobTypes.find((jt) => jt.name === "解体D")!
  const managementJobType = jobTypes.find((jt) => jt.name === "経営管理職群")!
  const technicalJobType = jobTypes.find((jt) => jt.name === "技術専門職群")!

  const grade1 = grades.find((g) => g.name === "正1")!
  const grade2 = grades.find((g) => g.name === "正2")!
  const grade3 = grades.find((g) => g.name === "正3")!
  const grade4 = grades.find((g) => g.name === "正4")!
  const grade5 = grades.find((g) => g.name === "正5")!
  const grade6 = grades.find((g) => g.name === "正6")!

  const positionBucho = positions.find((p) => p.name === "部長")!
  const positionJicho = positions.find((p) => p.name === "次長")!
  const positionKacho = positions.find((p) => p.name === "課長")!
  const positionShokucho = positions.find((p) => p.name === "職長")!
  const positionIppan = positions.find((p) => p.name === "一般")!

  const employeesData = [
    {
      employeeCode: "EMP001",
      firstName: "太郎",
      lastName: "田中",
      hireDate: new Date("2020-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: multiSkillJobType.id,
      gradeId: grade4.id,
      positionId: positionShokucho.id,
      currentStep: 30,
      currentRank: "B3",
      baseSalary: 280000,
      has360Evaluation: true,
      hasIndividualEvaluation: false,
    },
    {
      employeeCode: "EMP002",
      firstName: "花子",
      lastName: "佐藤",
      hireDate: new Date("2018-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[1].id,
      jobTypeId: managementJobType.id,
      gradeId: grade2.id,
      positionId: positionJicho.id,
      currentStep: 50,
      currentRank: "A2",
      baseSalary: 420000,
      has360Evaluation: true,
      hasIndividualEvaluation: true,
    },
    {
      employeeCode: "EMP003",
      firstName: "健一",
      lastName: "山本",
      hireDate: new Date("2019-10-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: driverJobType.id,
      gradeId: grade4.id,
      positionId: positionIppan.id,
      currentStep: 25,
      currentRank: "C1",
      baseSalary: 260000,
      has360Evaluation: false,
      hasIndividualEvaluation: true,
    },
    {
      employeeCode: "EMP004",
      firstName: "美咲",
      lastName: "鈴木",
      hireDate: new Date("2021-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: operatorJobType.id,
      gradeId: grade3.id,
      positionId: positionKacho.id,
      currentStep: 40,
      currentRank: "A5",
      baseSalary: 350000,
      has360Evaluation: true,
      hasIndividualEvaluation: true,
    },
    {
      employeeCode: "EMP005",
      firstName: "大輔",
      lastName: "高橋",
      hireDate: new Date("2022-07-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: multiSkillJobType.id,
      gradeId: grade5.id,
      positionId: positionIppan.id,
      currentStep: 15,
      currentRank: "D2",
      baseSalary: 220000,
      has360Evaluation: false,
      hasIndividualEvaluation: true,
    },
    {
      employeeCode: "EMP006",
      firstName: "雄一",
      lastName: "伊藤",
      hireDate: new Date("2015-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[1].id,
      jobTypeId: managementJobType.id,
      gradeId: grade1.id,
      positionId: positionBucho.id,
      currentStep: 70,
      currentRank: "S3",
      baseSalary: 550000,
      has360Evaluation: true,
      hasIndividualEvaluation: false,
    },
    {
      employeeCode: "EMP007",
      firstName: "由美",
      lastName: "渡辺",
      hireDate: new Date("2023-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: multiSkillJobType.id,
      gradeId: grade6.id,
      positionId: positionIppan.id,
      currentStep: 5,
      currentRank: "D7",
      baseSalary: 195000,
      has360Evaluation: false,
      hasIndividualEvaluation: false,
    },
    {
      employeeCode: "EMP008",
      firstName: "翔太",
      lastName: "小林",
      hireDate: new Date("2020-10-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: kaitaiDJobType.id,
      gradeId: grade3.id,
      positionId: positionShokucho.id,
      currentStep: 35,
      currentRank: "B1",
      baseSalary: 310000,
      has360Evaluation: true,
      hasIndividualEvaluation: true,
    },
    {
      employeeCode: "EMP009",
      firstName: "真一",
      lastName: "加藤",
      hireDate: new Date("2017-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[1].id,
      jobTypeId: technicalJobType.id,
      gradeId: grade2.id,
      positionId: positionKacho.id,
      currentStep: 55,
      currentRank: "A1",
      baseSalary: 450000,
      has360Evaluation: true,
      hasIndividualEvaluation: false,
    },
    {
      employeeCode: "EMP010",
      firstName: "さくら",
      lastName: "吉田",
      hireDate: new Date("2022-04-01"),
      employmentType: EmploymentType.CONTRACT,
      departmentId: departments[0].id,
      jobTypeId: driverJobType.id,
      gradeId: grade5.id,
      positionId: positionIppan.id,
      currentStep: 10,
      currentRank: "D5",
      baseSalary: 200000,
      has360Evaluation: false,
      hasIndividualEvaluation: true,
    },
    {
      employeeCode: "EMP011",
      firstName: "隆",
      lastName: "中村",
      hireDate: new Date("2019-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: operatorJobType.id,
      gradeId: grade4.id,
      positionId: positionShokucho.id,
      currentStep: 28,
      currentRank: "C3",
      baseSalary: 275000,
      has360Evaluation: true,
      hasIndividualEvaluation: true,
    },
  ]

  for (const empData of employeesData) {
    const employee = await prisma.employee.upsert({
      where: { companyId_employeeCode: { companyId: company.id, employeeCode: empData.employeeCode } },
      update: {
        has360Evaluation: empData.has360Evaluation,
        hasIndividualEvaluation: empData.hasIndividualEvaluation,
      },
      create: {
        companyId: company.id,
        ...empData,
      },
    })
    console.log(`Created employee: ${employee.lastName} ${employee.firstName}`)
  }

  console.log("Seeding completed!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
