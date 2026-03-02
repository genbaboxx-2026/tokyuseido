-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'LEAVE', 'RETIRED');

-- AlterEnum
ALTER TYPE "EmploymentType" ADD VALUE 'OUTSOURCE';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "salary_raise_month" INTEGER,
ADD COLUMN     "salary_reflection_date" INTEGER;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "profile_image" TEXT,
ADD COLUMN     "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "bonus_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assessment_start_date" TIMESTAMP(3) NOT NULL,
    "assessment_end_date" TIMESTAMP(3) NOT NULL,
    "evaluation_start_date" TIMESTAMP(3) NOT NULL,
    "evaluation_end_date" TIMESTAMP(3) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bonus_settings_company_id_idx" ON "bonus_settings"("company_id");

-- AddForeignKey
ALTER TABLE "bonus_settings" ADD CONSTRAINT "bonus_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
