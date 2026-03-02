import { Skeleton } from "@/components/ui/skeleton";

export default function OperationsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-[300px] rounded-lg" />
    </div>
  );
}
