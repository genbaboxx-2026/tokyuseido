-- CreateTable
CREATE TABLE "salary_adjustment_rules" (
    "id" TEXT NOT NULL,
    "salary_table_id" TEXT NOT NULL,
    "current_band" INTEGER NOT NULL,
    "is_transition" BOOLEAN NOT NULL,
    "target_band" INTEGER NOT NULL,
    "adjustment_value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_adjustment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_adjustment_rules_salary_table_id_idx" ON "salary_adjustment_rules"("salary_table_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_adjustment_rules_salary_table_id_current_band_is_tra_key" ON "salary_adjustment_rules"("salary_table_id", "current_band", "is_transition", "target_band");

-- AddForeignKey
ALTER TABLE "salary_adjustment_rules" ADD CONSTRAINT "salary_adjustment_rules_salary_table_id_fkey" FOREIGN KEY ("salary_table_id") REFERENCES "salary_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
