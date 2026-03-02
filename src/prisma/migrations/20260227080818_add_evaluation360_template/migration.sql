-- CreateTable
CREATE TABLE "evaluation_360_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_360_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_360_template_grades" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "grade_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_360_template_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_360_template_job_categories" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "job_category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_360_template_job_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_360_template_categories" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_360_template_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_360_template_items" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_360_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_360_templates_company_id_idx" ON "evaluation_360_templates"("company_id");

-- CreateIndex
CREATE INDEX "evaluation_360_template_grades_template_id_idx" ON "evaluation_360_template_grades"("template_id");

-- CreateIndex
CREATE INDEX "evaluation_360_template_grades_grade_id_idx" ON "evaluation_360_template_grades"("grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_360_template_grades_template_id_grade_id_key" ON "evaluation_360_template_grades"("template_id", "grade_id");

-- CreateIndex
CREATE INDEX "evaluation_360_template_job_categories_template_id_idx" ON "evaluation_360_template_job_categories"("template_id");

-- CreateIndex
CREATE INDEX "evaluation_360_template_job_categories_job_category_id_idx" ON "evaluation_360_template_job_categories"("job_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_360_template_job_categories_template_id_job_cate_key" ON "evaluation_360_template_job_categories"("template_id", "job_category_id");

-- CreateIndex
CREATE INDEX "evaluation_360_template_categories_template_id_idx" ON "evaluation_360_template_categories"("template_id");

-- CreateIndex
CREATE INDEX "evaluation_360_template_items_category_id_idx" ON "evaluation_360_template_items"("category_id");

-- AddForeignKey
ALTER TABLE "evaluation_360_templates" ADD CONSTRAINT "evaluation_360_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360_template_grades" ADD CONSTRAINT "evaluation_360_template_grades_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "evaluation_360_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360_template_grades" ADD CONSTRAINT "evaluation_360_template_grades_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360_template_job_categories" ADD CONSTRAINT "evaluation_360_template_job_categories_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "evaluation_360_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360_template_job_categories" ADD CONSTRAINT "evaluation_360_template_job_categories_job_category_id_fkey" FOREIGN KEY ("job_category_id") REFERENCES "job_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360_template_categories" ADD CONSTRAINT "evaluation_360_template_categories_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "evaluation_360_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360_template_items" ADD CONSTRAINT "evaluation_360_template_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "evaluation_360_template_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
