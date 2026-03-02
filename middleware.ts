import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// 保護されたルートのパターン
const protectedRoutes = [
  "/dashboard",
  "/companies",
]

// 認証不要のルート
const publicRoutes = ["/login", "/api/auth"]

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  // 認証不要のルートはスキップ
  const isPublicRoute = publicRoutes.some(
    (route) =>
      nextUrl.pathname === route || nextUrl.pathname.startsWith(route + "/")
  )

  if (isPublicRoute) {
    // ログイン済みユーザーが/loginにアクセスした場合、ダッシュボードにリダイレクト
    if (isLoggedIn && nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
    return NextResponse.next()
  }

  // 保護されたルートのチェック
  const isProtectedRoute = protectedRoutes.some(
    (route) =>
      nextUrl.pathname === route || nextUrl.pathname.startsWith(route + "/")
  )

  // ルートパス（/）へのアクセス
  if (nextUrl.pathname === "/") {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // 保護されたルートに未認証でアクセスした場合
  if (isProtectedRoute && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search)
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl)
    )
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // 静的ファイルと_nextを除外
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
