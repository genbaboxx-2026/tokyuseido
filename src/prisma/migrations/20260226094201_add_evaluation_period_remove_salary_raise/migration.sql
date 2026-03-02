/*
  Warnings:

  - You are about to drop the column `salary_raise_month` on the `companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companies" DROP COLUMN "salary_raise_month",
ADD COLUMN     "evaluation_period_end" TIMESTAMP(3),
ADD COLUMN     "evaluation_period_start" TIMESTAMP(3);
