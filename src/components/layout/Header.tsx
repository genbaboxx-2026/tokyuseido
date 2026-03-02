"use client";

import { Button } from "@/components/ui/button";

// UIテキスト定数
const UI_TEXT = {
  APP_NAME: "NiNKU BOXX",
  LOGOUT: "ログアウト",
};

interface HeaderProps {
  userName?: string;
}

export function Header({ userName }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-primary">
            {UI_TEXT.APP_NAME}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-4">
          {userName && (
            <span className="text-sm text-muted-foreground">{userName}</span>
          )}
          <Button variant="outline" size="sm">
            {UI_TEXT.LOGOUT}
          </Button>
        </div>
      </div>
    </header>
  );
}
