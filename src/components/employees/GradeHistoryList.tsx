import { Badge } from "@/components/ui/badge";
import type { EmployeeGradeHistoryWithGrade } from "@/types/employee";

interface GradeHistoryListProps {
  history: EmployeeGradeHistoryWithGrade[];
}

export function GradeHistoryList({ history }: GradeHistoryListProps) {
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        等級変遷履歴はありません
      </div>
    );
  }

  return (
    <div className="relative">
      {/* タイムライン */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <ul className="space-y-6">
        {history.map((item, index) => (
          <li key={item.id} className="relative pl-10">
            {/* タイムラインドット */}
            <div
              className={`absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-background ${
                index === 0 ? "bg-primary" : "bg-muted"
              }`}
            />

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant={index === 0 ? "default" : "secondary"}>
                  {item.gradeName}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  レベル {item.gradeLevel}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(item.effectiveDate)}
              </p>
              {item.reason && (
                <p className="text-sm">{item.reason}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
