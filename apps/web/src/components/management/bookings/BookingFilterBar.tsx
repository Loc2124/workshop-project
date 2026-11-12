import { Search, X, RefreshCw } from 'lucide-react';
import { StudioButton } from '../StudioPrimitives';
import type { BookingStats } from './BookingStatsCards';

export type FilterTab =
  | 'all'
  | 'needs_collection'
  | 'paid'
  | 'reschedule'
  | 'cancelled';

export interface BookingFilterBarProps {
  stats: BookingStats;
  totalBookingsCount: number;
  activeTab: FilterTab;
  onActiveTabChange: (tab: FilterTab) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  selectedWorkshop: string;
  onSelectedWorkshopChange: (workshop: string) => void;
  isFetching: boolean;
  onRefresh: () => void;
  onResetFilters: () => void;
}

export function BookingFilterBar({
  stats,
  totalBookingsCount,
  activeTab,
  onActiveTabChange,
  searchTerm,
  onSearchTermChange,
  selectedWorkshop,
  onSelectedWorkshopChange,
  isFetching,
  onRefresh,
  onResetFilters,
}: BookingFilterBarProps) {
  const hasActiveFilters =
    Boolean(searchTerm) || activeTab !== 'all' || selectedWorkshop !== 'all';

  return (
    <div className="space-y-3 rounded-studio-card border border-studio-border bg-studio-surface p-4 shadow-studio-card">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-studio-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Tìm theo mã đơn (#BK...), tên khách, SĐT, workshop..."
            className="w-full rounded-md border border-studio-border bg-studio-subtle/50 py-2 pl-9 pr-9 text-sm text-studio-ink placeholder:text-studio-muted focus:border-studio-primary focus:bg-studio-surface focus:outline-none focus:ring-1 focus:ring-studio-primary"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchTermChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-studio-muted hover:text-studio-ink"
              title="Xóa tìm kiếm"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stats.workshops.length > 1 && (
            <select
              aria-label="Lọc theo workshop"
              value={selectedWorkshop}
              onChange={(e) => onSelectedWorkshopChange(e.target.value)}
              className="h-9 rounded-md border border-studio-border bg-studio-surface px-3 text-sm text-studio-ink focus:border-studio-primary focus:outline-none focus:ring-1 focus:ring-studio-primary"
            >
              <option value="all">
                Tất cả workshop ({stats.workshops.length})
              </option>
              {stats.workshops.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          )}

          <StudioButton
            onClick={onRefresh}
            type="button"
            variant="secondary"
            className="h-9 shrink-0"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${isFetching ? 'animate-spin' : ''}`}
            />
            Cập nhật
          </StudioButton>
        </div>
      </div>

      {/* Tab Pills */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-studio-border/60 pt-3">
        <button
          type="button"
          onClick={() => onActiveTabChange('all')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'all'
              ? 'bg-studio-primary text-white shadow-xs'
              : 'bg-studio-subtle text-studio-muted hover:bg-studio-border/60 hover:text-studio-ink'
          }`}
        >
          Tất cả
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              activeTab === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-studio-border text-studio-ink'
            }`}
          >
            {totalBookingsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onActiveTabChange('needs_collection')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'needs_collection'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
        >
          Cần thu tiền tại xưởng
          {stats.needsCollectionCount > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeTab === 'needs_collection'
                  ? 'bg-white text-amber-800'
                  : 'bg-amber-200 text-amber-900'
              }`}
            >
              {stats.needsCollectionCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onActiveTabChange('paid')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'paid'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          Đã thanh toán đủ
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              activeTab === 'paid'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-200 text-emerald-900'
            }`}
          >
            {stats.paidCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onActiveTabChange('reschedule')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'reschedule'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-studio-subtle text-studio-muted hover:bg-studio-border/60 hover:text-studio-ink'
          }`}
        >
          Chờ dời giờ
        </button>

        <button
          type="button"
          onClick={() => onActiveTabChange('cancelled')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === 'cancelled'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-studio-subtle text-studio-muted hover:bg-studio-border/60 hover:text-studio-ink'
          }`}
        >
          Đã hủy / Hoàn tiền
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="ml-auto inline-flex items-center gap-1 text-xs text-studio-muted underline hover:text-studio-ink"
          >
            <X className="size-3" />
            Đặt lại bộ lọc
          </button>
        )}
      </div>
    </div>
  );
}
