import { Skeleton } from "@/components/ui/skeleton";

export default function GradesLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  );
}
