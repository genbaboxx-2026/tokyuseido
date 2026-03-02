/**
 * PDFダウンロードボタンコンポーネント
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

// UIテキスト定数
const UI_TEXT = {
  DOWNLOAD: "ダウンロード",
  GENERATING: "PDF生成中...",
  ERROR: "エラーが発生しました",
};

interface DownloadButtonProps {
  url: string;
  filename?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
}

export function DownloadButton({
  url,
  filename,
  disabled = false,
  variant = "default",
  size = "default",
  className,
  children,
}: DownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || UI_TEXT.ERROR);
      }

      // Blobとしてダウンロード
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // ダウンロードリンクを作成
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename || getFilenameFromUrl(url);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // クリーンアップ
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : UI_TEXT.ERROR);
      console.error("Download error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={handleDownload}
        disabled={disabled || isLoading}
        className={className}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {UI_TEXT.GENERATING}
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            {children || UI_TEXT.DOWNLOAD}
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// URLからファイル名を抽出
function getFilenameFromUrl(url: string): string {
  const parts = url.split("/");
  return parts[parts.length - 1] + ".pdf";
}
