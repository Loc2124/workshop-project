import { Search, X, ArrowUpDown, LayoutGrid, List, Plus } from 'lucide-react';
import { StudioButton } from '../StudioPrimitives';
import type { StudioWorkshop } from '../../../types/management';
import type { SessionStats } from './SessionStatsCards';

export type StatusTab = 'upcoming' | 'past' | 'cancelled' | 'all';
export type ViewMode = 'grid' | 'table';
export type SortOption = 'nearest' | 'newest' | 'price_desc' | 'fill_rate';

export interface SessionFilterBarProps {
  stats: SessionStats;
  statusTab: StatusTab;
  onStatusTabChange: (tab: StatusTab) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  workshopFilter: string;
  onWorkshopFilterChange: (id: string) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
  availableWorkshops: StudioWorkshop[];
  onCreateSession: () => void;
}

export function SessionFilterBar({
  stats,
  statusTab,
  onStatusTabChange,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchQueryChange,
  workshopFilter,
  onWorkshopFilterChange,
  sortBy,
  onSortByChange,
  availableWorkshops,
  onCreateSession,
}: SessionFilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Tabs trạng thái + Công cụ chế độ xem & Tạo buổi */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-studio-border pb-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onStatusTabChange('upcoming')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              statusTab === 'upcoming'
                ? 'bg-studio-primary text-white shadow-xs'
                : 'text-studio-muted hover:text-studio-ink hover:bg-studio-subtle'
            }`}
          >
            <span>Sắp diễn ra</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-xs font-bold tabular-nums ${
                statusTab === 'upcoming'
                  ? 'bg-white/20 text-white'
                  : 'bg-studio-subtle text-studio-muted'
              }`}
            >
              {stats.upcoming}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onStatusTabChange('past')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              statusTab === 'past'
                ? 'bg-studio-primary text-white shadow-xs'
                : 'text-studio-muted hover:text-studio-ink hover:bg-studio-subtle'
            }`}
          >
            <span>Đã qua</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-xs font-bold tabular-nums ${
                statusTab === 'past'
                  ? 'bg-white/20 text-white'
                  : 'bg-studio-subtle text-studio-muted'
              }`}
            >
              {stats.past}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onStatusTabChange('cancelled')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              statusTab === 'cancelled'
                ? 'bg-studio-primary text-white shadow-xs'
                : 'text-studio-muted hover:text-studio-ink hover:bg-studio-subtle'
            }`}
          >
            <span>Đã hủy</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-xs font-bold tabular-nums ${
                statusTab === 'cancelled'
                  ? 'bg-white/20 text-white'
                  : 'bg-studio-subtle text-studio-muted'
              }`}
            >
              {stats.cancelled}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onStatusTabChange('all')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              statusTab === 'all'
                ? 'bg-studio-primary text-white shadow-xs'
                : 'text-studio-muted hover:text-studio-ink hover:bg-studio-subtle'
            }`}
          >
            <span>Tất cả</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-xs font-bold tabular-nums ${
                statusTab === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-studio-subtle text-studio-muted'
              }`}
            >
              {stats.total}
            </span>
          </button>
        </div>

        {/* Chuyển chế độ xem Thẻ / Bảng & Nút Tạo buổi */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-lg border border-studio-border bg-studio-surface p-1">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-studio-primary text-white shadow-xs'
                  : 'text-studio-muted hover:text-studio-ink'
              }`}
              title="Xem dạng thẻ"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Dạng thẻ</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-studio-primary text-white shadow-xs'
                  : 'text-studio-muted hover:text-studio-ink'
              }`}
              title="Xem dạng bảng"
            >
              <List className="size-3.5" />
              <span className="hidden sm:inline">Dạng bảng</span>
            </button>
          </div>

          {availableWorkshops.length > 0 && (
            <StudioButton
              onClick={onCreateSession}
              type="button"
              size="sm"
              className="shrink-0"
            >
              <Plus aria-hidden="true" className="size-4 mr-1" /> Tạo buổi
            </StudioButton>
          )}
        </div>
      </div>

      {/* Hàng tìm kiếm & lọc chi tiết */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-studio-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Tìm theo tên workshop hoặc ngày..."
            className="min-h-10 w-full rounded-studio-control border border-studio-border bg-studio-surface pl-9 pr-8 text-sm text-studio-ink placeholder:text-studio-muted focus:border-studio-primary focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-studio-muted hover:text-studio-ink"
              title="Xóa tìm kiếm"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {availableWorkshops.length > 1 && (
          <select
            aria-label="Lọc theo workshop"
            value={workshopFilter}
            onChange={(e) => onWorkshopFilterChange(e.target.value)}
            className="min-h-10 rounded-studio-control border border-studio-border bg-studio-surface px-3 text-sm text-studio-ink focus:border-studio-primary focus:outline-none"
          >
            <option value="">Tất cả workshop</option>
            {availableWorkshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1.5 text-xs text-studio-muted">
          <ArrowUpDown className="size-3.5" />
          <select
            aria-label="Sắp xếp"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortOption)}
            className="min-h-10 rounded-studio-control border border-studio-border bg-studio-surface px-2.5 text-sm text-studio-ink focus:border-studio-primary focus:outline-none"
          >
            <option value="nearest">Gần nhất trước (Mặc định)</option>
            <option value="newest">Mới tạo gần đây</option>
            <option value="fill_rate">Tỷ lệ kín chỗ cao nhất</option>
            <option value="price_desc">Giá từ cao đến thấp</option>
          </select>
        </div>
      </div>
    </div>
  );
}
