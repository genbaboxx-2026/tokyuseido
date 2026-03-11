import "dotenv/config"
import { PrismaClient, UserRole, EmploymentType, EvaluationCycle } from "../generated/prisma/client"
import bcrypt from "bcryptjs"
import { roleResponsibilities } from "./seed-role-responsibilities"

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

  // 8.5. 役割責任マトリクスのデータを作成
  // まず、作成したGradeJobTypeConfigを全て取得
  const createdConfigs = await prisma.gradeJobTypeConfig.findMany({
    where: { isEnabled: true },
    include: {
      grade: { select: { name: true } },
      jobType: { select: { name: true } },
    },
  })

  // 役割責任データをGradeRoleとして作成
  let roleCount = 0
  for (const config of createdConfigs) {
    const gradeName = config.grade.name
    const jobTypeName = config.jobType.name

    // 該当する役割責任データを検索
    const roleData = roleResponsibilities.find(
      (r) => r.gradeName === gradeName && r.jobTypeName === jobTypeName
    )

    if (roleData) {
      await prisma.gradeRole.upsert({
        where: { gradeJobTypeConfigId: config.id },
        update: {
          responsibilities: roleData.responsibilities,
          positionNames: roleData.positionNames,
        },
        create: {
          gradeJobTypeConfigId: config.id,
          responsibilities: roleData.responsibilities,
          positionNames: roleData.positionNames,
        },
      })
      roleCount++
    }
  }
  console.log(`Created ${roleCount} grade roles with responsibilities`)

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

  // 360度評価: 全員 true
  // 個別評価: 正1、正2、正3のみ true（それ以外はfalse）
  const employeesData = [
    {
      employeeCode: "EMP001",
      firstName: "太郎",
      lastName: "田中",
      hireDate: new Date("2020-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: multiSkillJobType.id,
      gradeId: grade4.id, // 正4
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
      gradeId: grade2.id, // 正2
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
      gradeId: grade4.id, // 正4
      positionId: positionIppan.id,
      currentStep: 25,
      currentRank: "C1",
      baseSalary: 260000,
      has360Evaluation: true,
      hasIndividualEvaluation: false,
    },
    {
      employeeCode: "EMP004",
      firstName: "美咲",
      lastName: "鈴木",
      hireDate: new Date("2021-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: operatorJobType.id,
      gradeId: grade3.id, // 正3
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
      gradeId: grade5.id, // 正5
      positionId: positionIppan.id,
      currentStep: 15,
      currentRank: "D2",
      baseSalary: 220000,
      has360Evaluation: true,
      hasIndividualEvaluation: false,
    },
    {
      employeeCode: "EMP006",
      firstName: "雄一",
      lastName: "伊藤",
      hireDate: new Date("2015-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[1].id,
      jobTypeId: managementJobType.id,
      gradeId: grade1.id, // 正1
      positionId: positionBucho.id,
      currentStep: 70,
      currentRank: "S3",
      baseSalary: 550000,
      has360Evaluation: true,
      hasIndividualEvaluation: true,
    },
    {
      employeeCode: "EMP007",
      firstName: "由美",
      lastName: "渡辺",
      hireDate: new Date("2023-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: multiSkillJobType.id,
      gradeId: grade6.id, // 正6
      positionId: positionIppan.id,
      currentStep: 5,
      currentRank: "D7",
      baseSalary: 195000,
      has360Evaluation: true,
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
      gradeId: grade3.id, // 正3
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
      gradeId: grade2.id, // 正2
      positionId: positionKacho.id,
      currentStep: 55,
      currentRank: "A1",
      baseSalary: 450000,
      has360Evaluation: true,
      hasIndividualEvaluation: true,
    },
    {
      employeeCode: "EMP010",
      firstName: "さくら",
      lastName: "吉田",
      hireDate: new Date("2022-04-01"),
      employmentType: EmploymentType.CONTRACT,
      departmentId: departments[0].id,
      jobTypeId: driverJobType.id,
      gradeId: grade5.id, // 正5
      positionId: positionIppan.id,
      currentStep: 10,
      currentRank: "D5",
      baseSalary: 200000,
      has360Evaluation: true,
      hasIndividualEvaluation: false,
    },
    {
      employeeCode: "EMP011",
      firstName: "隆",
      lastName: "中村",
      hireDate: new Date("2019-04-01"),
      employmentType: EmploymentType.FULL_TIME,
      departmentId: departments[0].id,
      jobTypeId: operatorJobType.id,
      gradeId: grade4.id, // 正4
      positionId: positionShokucho.id,
      currentStep: 28,
      currentRank: "C3",
      baseSalary: 275000,
      has360Evaluation: true,
      hasIndividualEvaluation: false,
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

  // 10. 360度評価テンプレートを作成
  // 既存のテンプレートがあれば削除して再作成（カテゴリ・項目も含めて）
  const existingTemplate = await prisma.evaluation360Template.findUnique({
    where: { id: "template-360-default" },
  })
  if (existingTemplate) {
    await prisma.evaluation360Template.delete({
      where: { id: "template-360-default" },
    })
    console.log("Deleted existing 360 template")
  }

  const template360 = await prisma.evaluation360Template.create({
    data: {
      id: "template-360-default",
      companyId: company.id,
      name: "標準360度評価テンプレート",
      description: "解体業向け標準評価項目",
      isActive: true,
      status: "active",
    },
  })
  console.log(`Created 360 template: ${template360.name}`)

  // カテゴリーと項目のデータ
  const categoriesData = [
    {
      id: "cat-360-important",
      name: "大切にしていること",
      sortOrder: 1,
      items: [
        { content: "新人・若手が能力に応じて働きやすい配置、環境を工夫している。", maxScore: 5, sortOrder: 1 },
        { content: "従業員、顧客に対して常に感謝の気持ちを持ち接している。", maxScore: 5, sortOrder: 2 },
        { content: "業務上必要な情報を漏れなく正確に、理解しやすい表現で伝達できている", maxScore: 5, sortOrder: 3 },
        { content: "業務に必要な資格取得の努力をしている", maxScore: 5, sortOrder: 4 },
        { content: "仕事の仕方について、生産性を高める為の改善・工夫をチームとしている", maxScore: 5, sortOrder: 5 },
        { content: "自身の役割を理解して、適切な行動が出来ている", maxScore: 5, sortOrder: 6 },
        { content: "業務フロー・方法を常に見直し、生産性を高めている", maxScore: 5, sortOrder: 7 },
        { content: "業務範囲や目標、その仕事を達成する意義を理解し、求められた成果を出す努力や意欲がある", maxScore: 5, sortOrder: 8 },
        { content: "仕事に対して意欲的に取り組み、自発的に提案したり、改善活動を行うことが出来ている", maxScore: 5, sortOrder: 9 },
        { content: "すべての人に対して偏見や先入観を持たず、敬意を持って接している", maxScore: 5, sortOrder: 10 },
        { content: "協力会社社員や後輩社員などに対して、言動が丁寧に出来ている", maxScore: 5, sortOrder: 11 },
        { content: "会社の一員として、第三者に迷惑をかける行為をしていない", maxScore: 5, sortOrder: 12 },
        { content: "分け隔てなく、言葉遣いなど注意し周囲と接することができる", maxScore: 5, sortOrder: 13 },
        { content: "安全会議に出席している", maxScore: 5, sortOrder: 14 },
        { content: "勉強会に出席している", maxScore: 5, sortOrder: 15 },
        { content: "会社指定のユニフォームを着用している※上下セットで評価してください。", maxScore: 0, sortOrder: 16 },
      ],
    },
    {
      id: "cat-360-attitude",
      name: "仕事への姿勢",
      sortOrder: 2,
      items: [
        { content: "現場単位でチームワークを図りフォローしながら施工出来ている", maxScore: 5, sortOrder: 1 },
        { content: "現場事務所・詰所の清掃、整理整頓が出来ている", maxScore: 5, sortOrder: 2 },
        { content: "使用した工具、機械等終わり仕舞い出来ている。また返却出来ている", maxScore: 5, sortOrder: 3 },
        { content: "現場への通勤相乗りが出来るよう協力している。", maxScore: 5, sortOrder: 4 },
        { content: "産廃の仕分けについて積極的に取り組んでいる。また混合廃棄物を減らす努力をしている", maxScore: 5, sortOrder: 5 },
        { content: "社員、協力業者に産廃について適切に指導できている。", maxScore: 5, sortOrder: 6 },
        { content: "有価物の適切な取扱いが出来ている", maxScore: 0, sortOrder: 7 },
        { content: "社内や社外に対して、業務プロセスの改善や新しいアイデアの提案を行っている", maxScore: 5, sortOrder: 8 },
        { content: "職場の雰囲気を良好に保つための努力をしている", maxScore: 5, sortOrder: 9 },
        { content: "リース品や時間の無駄、作業にロスを出さないよう考え行動している。", maxScore: 5, sortOrder: 10 },
        { content: "自身の作業での成功例を他者と共有できている。", maxScore: 5, sortOrder: 11 },
        { content: "他者の意見や考え方を認め、理解しようとしている", maxScore: 5, sortOrder: 12 },
        { content: "自分の将来像を意識し、積極的に仕事に取り組んでいる。", maxScore: 5, sortOrder: 13 },
        { content: "会社、上司の信頼を得るための努力をしている。", maxScore: 5, sortOrder: 14 },
      ],
    },
    {
      id: "cat-360-problem",
      name: "問題解決力",
      sortOrder: 3,
      items: [
        { content: "専門の業務にあたり常に改善をするよう心掛けている", maxScore: 5, sortOrder: 1 },
        { content: "効率的に課題を解決するための方法を考え、実行できている", maxScore: 5, sortOrder: 2 },
      ],
    },
    {
      id: "cat-360-communication",
      name: "コミュニケーション",
      sortOrder: 4,
      items: [
        { content: "相手の言葉の意図を理解してコミュニケーションがとれている", maxScore: 5, sortOrder: 1 },
        { content: "上司部下関係なく、相手に敬意をもって接せられる", maxScore: 5, sortOrder: 2 },
        { content: "私的な感情を入れずに業務のコミュニケーションがとれている", maxScore: 5, sortOrder: 3 },
        { content: "自身の役割を理解し、適切な行動が出来ている", maxScore: 5, sortOrder: 4 },
      ],
    },
    {
      id: "cat-360-cost",
      name: "コスト意識",
      sortOrder: 5,
      items: [
        { content: "【工場メンバー対象】メンテナンス費について少しでも抑えようと努力している。", maxScore: 10, sortOrder: 1 },
        { content: "【現場メンバー対象】外注費、リース費について少しでも抑えようと努力している。", maxScore: 10, sortOrder: 2 },
      ],
    },
    {
      id: "cat-360-powerhara",
      name: "パワハラ",
      sortOrder: 6,
      items: [
        { content: "殴る、蹴るなど、相手の体に危害を与える行為をしていない（身体的な攻撃）", maxScore: 0, sortOrder: 1 },
        { content: "脅しや暴言、侮辱、名誉を棄損する発言などによって、相手に精神的なダメージを与える行為をしていない（精神的な攻撃）", maxScore: 0, sortOrder: 2 },
        { content: "隔離・無視・仲間外れといった手段で孤立させる行為をしていない（人間関係からの切り離し）", maxScore: 0, sortOrder: 3 },
        { content: "明らかに1人では遂行が不可能な仕事、もしくは長時間労働しない限り完遂できない仕事などをしいる行為をしていない（過大な要求）", maxScore: 0, sortOrder: 4 },
        { content: "相手に対して、その能力や経験とかけ離れた仕事を命じたり、仕事を与えなかったりする行為をしていない（過小な要求）", maxScore: 0, sortOrder: 5 },
      ],
    },
    {
      id: "cat-360-sexhara",
      name: "セクハラ",
      sortOrder: 7,
      items: [
        { content: "対価型セクハラをしていない　例）人事考課などを条件に性的な関係を求める、立場を利用し性的関係を求める、性的な好意を求める", maxScore: 0, sortOrder: 1 },
        { content: "環境型セクハラをしていない　例）性的な話題を口にする、恋愛経験を執ように尋ねる、用事もないのに執ようにメールを送る", maxScore: 0, sortOrder: 2 },
      ],
    },
  ]

  // カテゴリーと項目を作成
  for (const categoryData of categoriesData) {
    const category = await prisma.evaluation360TemplateCategory.upsert({
      where: { id: categoryData.id },
      update: {},
      create: {
        id: categoryData.id,
        templateId: template360.id,
        name: categoryData.name,
        sortOrder: categoryData.sortOrder,
      },
    })

    for (const itemData of categoryData.items) {
      await prisma.evaluation360TemplateItem.upsert({
        where: { id: `${categoryData.id}-item-${itemData.sortOrder}` },
        update: {},
        create: {
          id: `${categoryData.id}-item-${itemData.sortOrder}`,
          categoryId: category.id,
          content: itemData.content,
          maxScore: itemData.maxScore,
          sortOrder: itemData.sortOrder,
        },
      })
    }
    console.log(`Created category: ${category.name} with ${categoryData.items.length} items`)
  }

  // 11. 号俸テーブルを作成
  const salaryTable = await prisma.salaryTable.upsert({
    where: { id: "salary-table-default" },
    update: {},
    create: {
      id: "salary-table-default",
      companyId: company.id,
      name: "号俸テーブル",
      baseSalaryMax: 506092,
      baseSalaryMin: 180000,
      rankDivision: 8,
      increaseRate: 1.05,
      initialStepDiff: 1900,
      totalRanks: 15,
      isActive: true,
    },
  })
  console.log(`Created salary table: ${salaryTable.name}`)

  // 12. 従業員の現基本給データを作成
  const employees = await prisma.employee.findMany({
    where: { companyId: company.id },
    select: { id: true, employeeCode: true, baseSalary: true },
  })

  // 現基本給のシードデータ（従業員コードと現基本給のマッピング）
  const currentSalaryData: Record<string, number> = {
    "EMP001": 280000,  // 田中太郎 正4
    "EMP002": 420000,  // 佐藤花子 正2
    "EMP003": 260000,  // 山本健一 正4
    "EMP004": 350000,  // 鈴木美咲 正3
    "EMP005": 220000,  // 高橋大輔 正5
    "EMP006": 550000,  // 伊藤雄一 正1
    "EMP007": 195000,  // 渡辺由美 正6
    "EMP008": 310000,  // 小林翔太 正3
    "EMP009": 450000,  // 加藤真一 正2
    "EMP010": 200000,  // 吉田さくら 正5
    "EMP011": 275000,  // 中村隆 正4
  }

  for (const emp of employees) {
    const currentSalary = currentSalaryData[emp.employeeCode] || emp.baseSalary || 0
    if (currentSalary > 0) {
      await prisma.employeeCurrentSalary.upsert({
        where: {
          employeeId_salaryTableId: {
            employeeId: emp.id,
            salaryTableId: salaryTable.id,
          },
        },
        update: { currentSalary },
        create: {
          employeeId: emp.id,
          salaryTableId: salaryTable.id,
          currentSalary,
        },
      })
    }
  }
  console.log(`Created current salary data for ${employees.length} employees`)

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
