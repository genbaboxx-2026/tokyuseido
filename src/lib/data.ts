import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * React.cache() によりリクエスト単位でクエリ結果をメモ化。
 * layout.tsx, generateMetadata, page.tsx で同一IDのクエリが複数回走るのを防ぐ。
 */
export const getCompanyById = cache(async (companyId: string) => {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
});
