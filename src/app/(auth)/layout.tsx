import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "ログイン | NiNKU BOXX",
  description: "NiNKU BOXX 人事制度管理システム",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">NiNKU BOXX</h1>
          <p className="text-muted-foreground">人事制度管理システム</p>
        </div>
        {children}
      </div>
    </div>
  )
}
