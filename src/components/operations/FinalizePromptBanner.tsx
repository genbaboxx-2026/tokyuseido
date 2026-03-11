"use client"

import { Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface FinalizePromptBannerProps {
  companyId: string
  periodId: string
}

export function FinalizePromptBanner({
  companyId,
  periodId,
}: FinalizePromptBannerProps) {
  return (
    <div className="bg-gradient-to-r from-emerald-50 to-sky-50 border border-emerald-200 rounded-lg p-6 text-center space-y-3">
      <div className="flex items-center justify-center gap-2 text-emerald-700">
        <Trophy className="h-6 w-6" />
        <h3 className="text-lg font-bold">
          すべての評価が完了しました
        </h3>
      </div>
      <p className="text-sm text-emerald-600">
        評価結果を統合し、号俸変動の最終確認に進んでください。
      </p>
      <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
        <Link href={`/companies/${companyId}/operations/${periodId}/finalize`}>
          <Trophy className="h-4 w-4 mr-2" />
          最終確認を行う
        </Link>
      </Button>
    </div>
  )
}
