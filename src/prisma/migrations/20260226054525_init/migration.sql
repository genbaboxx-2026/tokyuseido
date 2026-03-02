-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COMPANY_ADMIN', 'EVALUATOR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'CONTRACT', 'PART_TIME');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "EvaluationCycle" AS ENUM ('HALF_YEARLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('FIRST_HALF', 'SECOND_HALF');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FEEDBACK_DONE');

-- CreateEnum
CREATE TYPE "EvaluationRating" AS ENUM ('S', 'A', 'B', 'C', 'D');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "password" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "company_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "representative" TEXT,
    "established_date" TIMESTAMP(3),
    "business_description" TEXT,
    "evaluation_cycle" "EvaluationCycle" NOT NULL DEFAULT 'HALF_YEARLY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_types" (
    "id" TEXT NOT NULL,
    "job_category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "employment_type" "EmploymentType" NOT NULL,
    "is_management" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_job_type_configs" (
    "id" TEXT NOT NULL,
    "grade_id" TEXT NOT NULL,
    "job_type_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_job_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_roles" (
    "id" TEXT NOT NULL,
    "grade_job_type_config_id" TEXT NOT NULL,
    "responsibilities" JSONB NOT NULL,
    "position_names" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_tables" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_salary_max" INTEGER NOT NULL,
    "base_salary_min" INTEGER NOT NULL,
    "rank_division" INTEGER NOT NULL,
    "increase_rate" DOUBLE PRECISION NOT NULL,
    "initial_step_diff" INTEGER NOT NULL,
    "total_ranks" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_table_entries" (
    "id" TEXT NOT NULL,
    "salary_table_id" TEXT NOT NULL,
    "grade_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "rank" TEXT NOT NULL,
    "base_salary" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_table_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "gender" "Gender",
    "birth_date" TIMESTAMP(3),
    "hire_date" TIMESTAMP(3) NOT NULL,
    "department_id" TEXT,
    "employment_type" "EmploymentType" NOT NULL,
    "job_type_id" TEXT,
    "grade_id" TEXT,
    "position_id" TEXT,
    "current_step" INTEGER,
    "current_rank" TEXT,
    "base_salary" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_grade_history" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "grade_id" TEXT NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_grade_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "interview_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "document_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salaries" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "salary_table_entry_id" TEXT NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "base_salary" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_periods" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "individual_evaluations" (
    "id" TEXT NOT NULL,
    "evaluation_period_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "evaluator_id" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "total_score" DOUBLE PRECISION,
    "final_rating" "EvaluationRating",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "grade_job_type_config_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_scores" (
    "id" TEXT NOT NULL,
    "individual_evaluation_id" TEXT NOT NULL,
    "evaluation_item_id" TEXT NOT NULL,
    "self_score" INTEGER,
    "evaluator_score" INTEGER,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_360s" (
    "id" TEXT NOT NULL,
    "evaluation_period_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "average_score" DOUBLE PRECISION,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_360s_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluator_assignments" (
    "id" TEXT NOT NULL,
    "evaluation_360_id" TEXT NOT NULL,
    "evaluator_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_360_scores" (
    "id" TEXT NOT NULL,
    "evaluation_360_id" TEXT NOT NULL,
    "evaluator_assignment_id" TEXT NOT NULL,
    "evaluation_item_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_360_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_criteria" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "first_half_rating" "EvaluationRating" NOT NULL,
    "second_half_rating" "EvaluationRating" NOT NULL,
    "final_rating" "EvaluationRating" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_adjustment_rules" (
    "id" TEXT NOT NULL,
    "grade_id" TEXT NOT NULL,
    "current_rank" TEXT NOT NULL,
    "rating" "EvaluationRating" NOT NULL,
    "step_adjustment" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_adjustment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "departments_company_id_idx" ON "departments"("company_id");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "positions_company_id_idx" ON "positions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_company_id_name_key" ON "positions"("company_id", "name");

-- CreateIndex
CREATE INDEX "job_categories_company_id_idx" ON "job_categories"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_categories_company_id_name_key" ON "job_categories"("company_id", "name");

-- CreateIndex
CREATE INDEX "job_types_job_category_id_idx" ON "job_types"("job_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_types_job_category_id_name_key" ON "job_types"("job_category_id", "name");

-- CreateIndex
CREATE INDEX "grades_company_id_idx" ON "grades"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "grades_company_id_name_key" ON "grades"("company_id", "name");

-- CreateIndex
CREATE INDEX "grade_job_type_configs_grade_id_idx" ON "grade_job_type_configs"("grade_id");

-- CreateIndex
CREATE INDEX "grade_job_type_configs_job_type_id_idx" ON "grade_job_type_configs"("job_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_job_type_configs_grade_id_job_type_id_key" ON "grade_job_type_configs"("grade_id", "job_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_roles_grade_job_type_config_id_key" ON "grade_roles"("grade_job_type_config_id");

-- CreateIndex
CREATE INDEX "salary_tables_company_id_idx" ON "salary_tables"("company_id");

-- CreateIndex
CREATE INDEX "salary_table_entries_salary_table_id_idx" ON "salary_table_entries"("salary_table_id");

-- CreateIndex
CREATE INDEX "salary_table_entries_grade_id_idx" ON "salary_table_entries"("grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_table_entries_salary_table_id_grade_id_step_number_key" ON "salary_table_entries"("salary_table_id", "grade_id", "step_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_company_id_idx" ON "employees"("company_id");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE INDEX "employees_job_type_id_idx" ON "employees"("job_type_id");

-- CreateIndex
CREATE INDEX "employees_grade_id_idx" ON "employees"("grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_employee_code_key" ON "employees"("company_id", "employee_code");

-- CreateIndex
CREATE INDEX "employee_grade_history_employee_id_idx" ON "employee_grade_history"("employee_id");

-- CreateIndex
CREATE INDEX "employee_grade_history_grade_id_idx" ON "employee_grade_history"("grade_id");

-- CreateIndex
CREATE INDEX "interview_records_employee_id_idx" ON "interview_records"("employee_id");

-- CreateIndex
CREATE INDEX "employee_salaries_employee_id_idx" ON "employee_salaries"("employee_id");

-- CreateIndex
CREATE INDEX "employee_salaries_salary_table_entry_id_idx" ON "employee_salaries"("salary_table_entry_id");

-- CreateIndex
CREATE INDEX "evaluation_periods_company_id_idx" ON "evaluation_periods"("company_id");

-- CreateIndex
CREATE INDEX "individual_evaluations_evaluation_period_id_idx" ON "individual_evaluations"("evaluation_period_id");

-- CreateIndex
CREATE INDEX "individual_evaluations_employee_id_idx" ON "individual_evaluations"("employee_id");

-- CreateIndex
CREATE INDEX "individual_evaluations_evaluator_id_idx" ON "individual_evaluations"("evaluator_id");

-- CreateIndex
CREATE UNIQUE INDEX "individual_evaluations_evaluation_period_id_employee_id_key" ON "individual_evaluations"("evaluation_period_id", "employee_id");

-- CreateIndex
CREATE INDEX "evaluation_items_grade_job_type_config_id_idx" ON "evaluation_items"("grade_job_type_config_id");

-- CreateIndex
CREATE INDEX "evaluation_scores_individual_evaluation_id_idx" ON "evaluation_scores"("individual_evaluation_id");

-- CreateIndex
CREATE INDEX "evaluation_scores_evaluation_item_id_idx" ON "evaluation_scores"("evaluation_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_scores_individual_evaluation_id_evaluation_item__key" ON "evaluation_scores"("individual_evaluation_id", "evaluation_item_id");

-- CreateIndex
CREATE INDEX "evaluation_360s_evaluation_period_id_idx" ON "evaluation_360s"("evaluation_period_id");

-- CreateIndex
CREATE INDEX "evaluation_360s_employee_id_idx" ON "evaluation_360s"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_360s_evaluation_period_id_employee_id_key" ON "evaluation_360s"("evaluation_period_id", "employee_id");

-- CreateIndex
CREATE INDEX "evaluator_assignments_evaluation_360_id_idx" ON "evaluator_assignments"("evaluation_360_id");

-- CreateIndex
CREATE INDEX "evaluator_assignments_evaluator_id_idx" ON "evaluator_assignments"("evaluator_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluator_assignments_evaluation_360_id_evaluator_id_key" ON "evaluator_assignments"("evaluation_360_id", "evaluator_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluator_assignments_evaluation_360_id_order_key" ON "evaluator_assignments"("evaluation_360_id", "order");

-- CreateIndex
CREATE INDEX "evaluation_360_scores_evaluation_360_id_idx" ON "evaluation_360_scores"("evaluation_360_id");

-- CreateIndex
CREATE INDEX "evaluation_360_scores_evaluator_assignment_id_idx" ON "evaluation_360_scores"("evaluator_assignment_id");

-- CreateIndex
CREATE INDEX "evaluation_360_scores_evaluation_item_id_idx" ON "evaluation_360_scores"("evaluation_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_360_scores_evaluator_assignment_id_evaluation_it_key" ON "evaluation_360_scores"("evaluator_assignment_id", "evaluation_item_id");

-- CreateIndex
CREATE INDEX "evaluation_criteria_company_id_idx" ON "evaluation_criteria"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_criteria_company_id_first_half_rating_second_hal_key" ON "evaluation_criteria"("company_id", "first_half_rating", "second_half_rating");

-- CreateIndex
CREATE INDEX "grade_adjustment_rules_grade_id_idx" ON "grade_adjustment_rules"("grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_adjustment_rules_grade_id_current_rank_rating_key" ON "grade_adjustment_rules"("grade_id", "current_rank", "rating");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_categories" ADD CONSTRAINT "job_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_types" ADD CONSTRAINT "job_types_job_category_id_fkey" FOREIGN KEY ("job_category_id") REFERENCES "job_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_job_type_configs" ADD CONSTRAINT "grade_job_type_configs_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_job_type_configs" ADD CONSTRAINT "grade_job_type_configs_job_type_id_fkey" FOREIGN KEY ("job_type_id") REFERENCES "job_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_roles" ADD CONSTRAINT "grade_roles_grade_job_type_config_id_fkey" FOREIGN KEY ("grade_job_type_config_id") REFERENCES "grade_job_type_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_tables" ADD CONSTRAINT "salary_tables_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_table_entries" ADD CONSTRAINT "salary_table_entries_salary_table_id_fkey" FOREIGN KEY ("salary_table_id") REFERENCES "salary_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_table_entries" ADD CONSTRAINT "salary_table_entries_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_type_id_fkey" FOREIGN KEY ("job_type_id") REFERENCES "job_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_grade_history" ADD CONSTRAINT "employee_grade_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_grade_history" ADD CONSTRAINT "employee_grade_history_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_records" ADD CONSTRAINT "interview_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_salary_table_entry_id_fkey" FOREIGN KEY ("salary_table_entry_id") REFERENCES "salary_table_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_periods" ADD CONSTRAINT "evaluation_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_evaluations" ADD CONSTRAINT "individual_evaluations_evaluation_period_id_fkey" FOREIGN KEY ("evaluation_period_id") REFERENCES "evaluation_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_evaluations" ADD CONSTRAINT "individual_evaluations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_evaluations" ADD CONSTRAINT "individual_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_items" ADD CONSTRAINT "evaluation_items_grade_job_type_config_id_fkey" FOREIGN KEY ("grade_job_type_config_id") REFERENCES "grade_job_type_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_individual_evaluation_id_fkey" FOREIGN KEY ("individual_evaluation_id") REFERENCES "individual_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_evaluation_item_id_fkey" FOREIGN KEY ("evaluation_item_id") REFERENCES "evaluation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360s" ADD CONSTRAINT "evaluation_360s_evaluation_period_id_fkey" FOREIGN KEY ("evaluation_period_id") REFERENCES "evaluation_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360s" ADD CONSTRAINT "evaluation_360s_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignments" ADD CONSTRAINT "evaluator_assignments_evaluation_360_id_fkey" FOREIGN KEY ("evaluation_360_id") REFERENCES "evaluation_360s"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignments" ADD CONSTRAINT "evaluator_assignments_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360_scores" ADD CONSTRAINT "evaluation_360_scores_evaluation_360_id_fkey" FOREIGN KEY ("evaluation_360_id") REFERENCES "evaluation_360s"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360_scores" ADD CONSTRAINT "evaluation_360_scores_evaluator_assignment_id_fkey" FOREIGN KEY ("evaluator_assignment_id") REFERENCES "evaluator_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360_scores" ADD CONSTRAINT "evaluation_360_scores_evaluation_item_id_fkey" FOREIGN KEY ("evaluation_item_id") REFERENCES "evaluation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_criteria" ADD CONSTRAINT "evaluation_criteria_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_adjustment_rules" ADD CONSTRAINT "grade_adjustment_rules_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
