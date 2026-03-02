/*
  Warnings:

  - You are about to drop the column `salary_reflection_date` on the `companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companies" DROP COLUMN "salary_reflection_date",
ADD COLUMN     "salary_reflection_day" INTEGER,
ADD COLUMN     "salary_reflection_month" INTEGER;
