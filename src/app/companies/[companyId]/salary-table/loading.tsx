import { Skeleton } from "@/components/ui/skeleton";

export default function SalaryTableLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  );
}
