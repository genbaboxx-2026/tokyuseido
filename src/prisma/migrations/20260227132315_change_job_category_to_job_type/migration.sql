/*
  Warnings:

  - You are about to drop the `evaluation_360_template_job_categories` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "evaluation_360_template_job_categories" DROP CONSTRAINT "evaluation_360_template_job_categories_job_category_id_fkey";

-- DropForeignKey
ALTER TABLE "evaluation_360_template_job_categories" DROP CONSTRAINT "evaluation_360_template_job_categories_template_id_fkey";

-- DropTable
DROP TABLE "evaluation_360_template_job_categories";

-- CreateTable
CREATE TABLE "evaluation_360_template_job_types" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "job_type_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_360_template_job_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_360_template_job_types_template_id_idx" ON "evaluation_360_template_job_types"("template_id");

-- CreateIndex
CREATE INDEX "evaluation_360_template_job_types_job_type_id_idx" ON "evaluation_360_template_job_types"("job_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_360_template_job_types_template_id_job_type_id_key" ON "evaluation_360_template_job_types"("template_id", "job_type_id");

-- AddForeignKey
ALTER TABLE "evaluation_360_template_job_types" ADD CONSTRAINT "evaluation_360_template_job_types_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "evaluation_360_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_360_template_job_types" ADD CONSTRAINT "evaluation_360_template_job_types_job_type_id_fkey" FOREIGN KEY ("job_type_id") REFERENCES "job_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
