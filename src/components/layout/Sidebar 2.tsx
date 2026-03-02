"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  ChevronDown,
  ChevronRight,
  Play,
  Layers,
} from "lucide-react";

// UIテキスト定数
const UI_TEXT = {
  MENU: {
    DASHBOARD: "クライアント企業一覧",
    ADD_NEW_COMPANY: "新しい企業を追加",
    BACK_TO_LIST: "企業一覧に戻る",
    OVERVIEW: "概要",
    COMPANY_SETTINGS: "会社設定",
    EMPLOYEES: "従業員管理",
    GRADES: "等級制度",
    SALARY_TABLE: "号俸テーブル",
    EVALUATIONS: "評価制度",
    REPORTS: "レポート出力",
    OPERATIONS: "運用",
    MASTER_SETTINGS: "マスタ設定",
    GRADE_SALARY_EVALUATION: "等級・賃金・評価",
  },
  SECTIONS: {
    OPERATIONS: "運用",
    MASTER_SETTINGS: "マスタ設定",
  },
};

// セクション区切りコンポーネント
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="px-3 py-2 mt-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

// ダッシュボード用ナビゲーション
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

interface CollapsibleNavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavItem[];
}

// 企業コンテキスト用ナビゲーション生成関数
const getCompanyNavConfig = (companyId: string) => ({
  operations: [
    {
      href: `/companies/${companyId}/operations`,
      label: UI_TEXT.MENU.OPERATIONS,
      icon: Play,
      exact: true,
    },
    {
      href: `/companies/${companyId}/employees`,
      label: UI_TEXT.MENU.EMPLOYEES,
      icon: Users,
    },
    {
      href: `/companies/${companyId}/reports`,
      label: UI_TEXT.MENU.REPORTS,
      icon: FileDown,
    },
  ] as NavItem[],
  masterSettings: {
    collapsible: {
      label: UI_TEXT.MENU.GRADE_SALARY_EVALUATION,
      icon: Layers,
      children: [
        {
          href: `/companies/${companyId}/grades`,
          label: UI_TEXT.MENU.GRADES,
          icon: Award,
        },
        {
          href: `/companies/${companyId}/salary-table`,
          label: UI_TEXT.MENU.SALARY_TABLE,
          icon: Table,
        },
        {
          href: `/companies/${companyId}/evaluations`,
          label: UI_TEXT.MENU.EVALUATIONS,
          icon: ClipboardList,
        },
      ] as NavItem[],
    } as CollapsibleNavItem,
    items: [
      {
        href: `/companies/${companyId}`,
        label: UI_TEXT.MENU.OVERVIEW,
        icon: Home,
        exact: true,
      },
      {
        href: `/companies/${companyId}/settings`,
        label: UI_TEXT.MENU.COMPANY_SETTINGS,
        icon: Settings,
      },
    ] as NavItem[],
  },
});

// companyIdをパスから抽出する関数
function extractCompanyId(pathname: string): string | null {
  const match = pathname.match(/^\/companies\/([^/]+)/);
  return match ? match[1] : null;
}

// 企業コンテキスト内かどうかを判定する関数
function isInCompanyContext(pathname: string): boolean {
  // /companies/new は企業コンテキストではない
  if (pathname === "/companies/new") return false;
  // /companies/[companyId] 以降のパスは企業コンテキスト
  return /^\/companies\/[^/]+/.test(pathname);
}

// 折りたたみメニューの子アイテムにマッチするか判定
function isChildActive(children: NavItem[], pathname: string): boolean {
  return children.some((child) =>
    child.exact ? pathname === child.href : pathname.startsWith(child.href)
  );
}

interface SidebarProps {
  companyName?: string;
}

// ナビゲーションアイテムコンポーネント
function NavItemLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

// 折りたたみメニューコンポーネント
function CollapsibleMenu({
  item,
  pathname,
  defaultOpen = false,
}: {
  item: CollapsibleNavItem;
  pathname: string;
  defaultOpen?: boolean;
}) {
  const hasActiveChild = isChildActive(item.children, pathname);
  const [isOpen, setIsOpen] = useState(defaultOpen || hasActiveChild);
  const Icon = item.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          hasActiveChild
            ? "bg-sidebar-accent/30 text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4" />
          {item.label}
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      {isOpen && (
        <div className="ml-4 mt-1 space-y-1 border-l pl-3">
          {item.children.map((child) => (
            <NavItemLink key={child.href} item={child} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
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
            {/* 企業一覧に戻るリンク */}
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {UI_TEXT.MENU.BACK_TO_LIST}
            </Link>

            {/* 企業名表示 */}
            {companyName && (
              <div className="px-3 py-2 mb-2 border-b">
                <p className="text-xs text-muted-foreground">選択中の企業</p>
                <p className="font-semibold truncate">{companyName}</p>
              </div>
            )}

            {/* 運用セクション */}
            <SectionDivider label={UI_TEXT.SECTIONS.OPERATIONS} />
            {getCompanyNavConfig(companyId).operations.map((item) => (
              <NavItemLink key={item.href} item={item} pathname={pathname} />
            ))}

            {/* マスタ設定セクション */}
            <SectionDivider label={UI_TEXT.SECTIONS.MASTER_SETTINGS} />
            {getCompanyNavConfig(companyId).masterSettings.items.map((item) => (
              <NavItemLink key={item.href} item={item} pathname={pathname} />
            ))}

            {/* 等級・賃金・評価 折りたたみメニュー */}
            <CollapsibleMenu
              item={getCompanyNavConfig(companyId).masterSettings.collapsible}
              pathname={pathname}
              defaultOpen={true}
            />
          </>
        ) : (
          /* ダッシュボード用メニュー */
          DASHBOARD_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })
        )}
      </nav>
    </aside>
  );
}
