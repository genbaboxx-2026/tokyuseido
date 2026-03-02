"use client";

import { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface MainLayoutProps {
  children: ReactNode;
  userName?: string;
  companyName?: string;
}

export function MainLayout({ children, userName, companyName }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header userName={userName} />
      <Sidebar companyName={companyName} />
      <main className="ml-64 min-h-[calc(100vh-3.5rem)] p-6">{children}</main>
    </div>
  );
}
