import { Skeleton } from '../ui/skeleton';
export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải trang"
      className="w-full space-y-5 p-5"
    >
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
