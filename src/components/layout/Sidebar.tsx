"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2,
  Users,
  Award,
  Table,
  ClipboardList,
  Settings,
  Home,
  ArrowLeft,
  FileDown,
  Play,
} from "lucide-react";

const UI_TEXT = {
  MENU: {
    DASHBOARD: "クライアント企業一覧",
    BACK_TO_LIST: "企業一覧に戻る",
    OVERVIEW: "概要",
    COMPANY_SETTINGS: "会社設定",
    EMPLOYEES: "従業員管理",
    GRADES: "等級制度設定",
    SALARY_TABLE: "号俸テーブル",
    EVALUATIONS: "評価制度設定",
    REPORTS: "レポート出力",
    OPERATIONS: "評価実行",
  },
  SECTIONS: {
    MASTER: "情報・マスタ",
    OPERATIONS: "運用",
  },
};

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="px-3 py-2 mt-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

const DASHBOARD_NAV_ITEMS = [
  {
    href: "/dashboard",
    label: UI_TEXT.MENU.DASHBOARD,
    icon: Building2,
  },
];

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const getCompanyNavConfig = (companyId: string) => ({
  master: [
    {
      href: `/companies/${companyId}/settings`,
      label: UI_TEXT.MENU.COMPANY_SETTINGS,
      icon: Settings,
    },
    {
      href: `/companies/${companyId}/employees`,
      label: UI_TEXT.MENU.EMPLOYEES,
      icon: Users,
    },
    {
      href: `/companies/${companyId}/grades`,
      label: UI_TEXT.MENU.GRADES,
      icon: Award,
    },
    {
      href: `/companies/${companyId}/salary-table`,
      label: UI_TEXT.MENU.SALARY_TABLE,
      icon: Table,
      exact: true,
    },
    {
      href: `/companies/${companyId}/evaluations`,
      label: UI_TEXT.MENU.EVALUATIONS,
      icon: ClipboardList,
    },
  ] as NavItem[],
  operations: [
    {
      href: `/companies/${companyId}`,
      label: UI_TEXT.MENU.OVERVIEW,
      icon: Home,
      exact: true,
    },
    {
      href: `/companies/${companyId}/operations`,
      label: UI_TEXT.MENU.OPERATIONS,
      icon: Play,
    },
    {
      href: `/companies/${companyId}/reports`,
      label: UI_TEXT.MENU.REPORTS,
      icon: FileDown,
    },
  ] as NavItem[],
});

function extractCompanyId(pathname: string): string | null {
  const match = pathname.match(/^\/companies\/([^/]+)/);
  return match ? match[1] : null;
}

function isInCompanyContext(pathname: string): boolean {
  if (pathname === "/companies/new") return false;
  return /^\/companies\/[^/]+/.test(pathname);
}

interface SidebarProps {
  companyName?: string;
}

function NavItemLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative",
        isActive
          ? "bg-primary text-primary-foreground shadow-md before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-1 before:bg-white before:rounded-r-full"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4", isActive && "ml-1")} />
      {item.label}
    </Link>
  );
}

export function Sidebar({ companyName }: SidebarProps) {
  const pathname = usePathname();
  const inCompanyContext = isInCompanyContext(pathname);
  const companyId = extractCompanyId(pathname);

  return (
    <aside className="fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 border-r bg-sidebar">
      <nav className="flex flex-col gap-1 p-4">
        {inCompanyContext && companyId ? (
          <>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {UI_TEXT.MENU.BACK_TO_LIST}
            </Link>

            {companyName && (
              <div className="px-3 py-2 mb-2 border-b">
                <p className="text-xs text-muted-foreground">選択中の企業</p>
                <p className="font-semibold truncate">{companyName}</p>
              </div>
            )}

            <SectionDivider label={UI_TEXT.SECTIONS.MASTER} />
            {getCompanyNavConfig(companyId).master.map((item) => (
              <NavItemLink key={item.href} item={item} pathname={pathname} />
            ))}

            <SectionDivider label={UI_TEXT.SECTIONS.OPERATIONS} />
            {getCompanyNavConfig(companyId).operations.map((item) => (
              <NavItemLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        ) : (
          DASHBOARD_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-1 before:bg-white before:rounded-r-full"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "ml-1")} />
                {item.label}
              </Link>
            );
          })
        )}
      </nav>
    </aside>
  );
}
