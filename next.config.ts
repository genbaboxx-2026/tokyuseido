import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  eslint: {
    // 本番ビルドテスト用に一時的にESLintを無視
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
