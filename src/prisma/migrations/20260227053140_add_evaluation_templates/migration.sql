-- CreateTable
CREATE TABLE "evaluation_templates" (
    "id" TEXT NOT NULL,
    "grade_job_type_config_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_template_items" (
    "id" TEXT NOT NULL,
    "evaluation_template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "max_score" INTEGER NOT NULL DEFAULT 5,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_evaluations" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "evaluation_template_id" TEXT NOT NULL,
    "evaluation_period_id" TEXT,
    "evaluation_type" TEXT NOT NULL DEFAULT 'individual',
    "status" "EvaluationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "total_score" DOUBLE PRECISION,
    "final_rating" "EvaluationRating",
    "evaluator_comment" TEXT,
    "self_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_evaluation_items" (
    "id" TEXT NOT NULL,
    "employee_evaluation_id" TEXT NOT NULL,
    "evaluation_template_item_id" TEXT NOT NULL,
    "self_score" INTEGER,
    "evaluator_score" INTEGER,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_evaluation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_templates_grade_job_type_config_id_idx" ON "evaluation_templates"("grade_job_type_config_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_templates_grade_job_type_config_id_key" ON "evaluation_templates"("grade_job_type_config_id");

-- CreateIndex
CREATE INDEX "evaluation_template_items_evaluation_template_id_idx" ON "evaluation_template_items"("evaluation_template_id");

-- CreateIndex
CREATE INDEX "employee_evaluations_employee_id_idx" ON "employee_evaluations"("employee_id");

-- CreateIndex
CREATE INDEX "employee_evaluations_evaluation_template_id_idx" ON "employee_evaluations"("evaluation_template_id");

-- CreateIndex
CREATE INDEX "employee_evaluations_evaluation_period_id_idx" ON "employee_evaluations"("evaluation_period_id");

-- CreateIndex
CREATE INDEX "employee_evaluation_items_employee_evaluation_id_idx" ON "employee_evaluation_items"("employee_evaluation_id");

-- CreateIndex
CREATE INDEX "employee_evaluation_items_evaluation_template_item_id_idx" ON "employee_evaluation_items"("evaluation_template_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_evaluation_items_employee_evaluation_id_evaluation_key" ON "employee_evaluation_items"("employee_evaluation_id", "evaluation_template_item_id");

-- AddForeignKey
ALTER TABLE "evaluation_templates" ADD CONSTRAINT "evaluation_templates_grade_job_type_config_id_fkey" FOREIGN KEY ("grade_job_type_config_id") REFERENCES "grade_job_type_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_template_items" ADD CONSTRAINT "evaluation_template_items_evaluation_template_id_fkey" FOREIGN KEY ("evaluation_template_id") REFERENCES "evaluation_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluations" ADD CONSTRAINT "employee_evaluations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluations" ADD CONSTRAINT "employee_evaluations_evaluation_template_id_fkey" FOREIGN KEY ("evaluation_template_id") REFERENCES "evaluation_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluation_items" ADD CONSTRAINT "employee_evaluation_items_employee_evaluation_id_fkey" FOREIGN KEY ("employee_evaluation_id") REFERENCES "employee_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluation_items" ADD CONSTRAINT "employee_evaluation_items_evaluation_template_item_id_fkey" FOREIGN KEY ("evaluation_template_item_id") REFERENCES "evaluation_template_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
