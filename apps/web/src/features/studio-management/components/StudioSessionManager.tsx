import { useState, useMemo } from 'react';
import { formatSessionDate } from '@/lib/format';
import { useCancelStudioSession } from '@/hooks/useManagement';
import type {
  MemberStudio,
  StudioSession,
  StudioWorkshop,
} from '@/types/management';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus, Search } from 'lucide-react';
import {
  StudioButton,
  StudioCard,
  StudioEmptyState,
  StudioSkeleton,
} from './StudioPrimitives';

import { SessionStatsCards } from './sessions/SessionStatsCards';
import {
  SessionFilterBar,
  type SortOption,
  type StatusTab,
  type ViewMode,
} from './sessions/SessionFilterBar';
import { SessionCardItem } from './sessions/SessionCardItem';
import { SessionTableView } from './sessions/SessionTableView';
import { SessionEditorSheet } from './sessions/SessionEditorSheet';
import { SessionCancelDialog } from './sessions/SessionCancelDialog';

type Props = {
  studio: MemberStudio;
  workshops: StudioWorkshop[] | undefined;
  sessions: StudioSession[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
};

export function StudioSessionManager({
  studio,
  workshops,
  sessions,
  isLoading,
  error,
  onRetry,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StudioSession>();
  const [canceling, setCanceling] = useState<StudioSession>();

  // Bộ lọc & tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');
  const [workshopFilter, setWorkshopFilter] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('upcoming');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('nearest');

  const cancelSession = useCancelStudioSession();
  const availableWorkshops = workshops ?? [];

  const closeEditor = () => {
    setCreating(false);
    setEditing(undefined);
  };

  async function confirmCancel(session: StudioSession) {
    try {
      await cancelSession.mutateAsync({
        studioId: studio.id,
        sessionId: session.id,
      });
      setCanceling(undefined);
    } catch {
      // The mutation reports server errors through the global toast.
    }
  }

  // Thống kê nhanh
  const stats = useMemo(() => {
    const all = sessions ?? [];
    const now = Date.now();
    let upcoming = 0;
    let availableSeats = 0;
    let fullSessions = 0;
    let past = 0;
    let cancelled = 0;

    for (const s of all) {
      const isCancelled = s.status === 'cancelled';
      const isPast = Date.parse(s.endsAt) < now;
      if (isCancelled) {
        cancelled++;
      } else if (isPast) {
        past++;
      } else {
        upcoming++;
        const booked = s.seatsHeld + s.seatsSold;
        availableSeats += Math.max(0, s.capacity - booked);
        if (s.capacity > 0 && booked >= s.capacity) {
          fullSessions++;
        }
      }
    }

    return {
      upcoming,
      availableSeats,
      fullSessions,
      past,
      cancelled,
      total: all.length,
    };
  }, [sessions]);

  // Lọc và Sắp xếp: Buổi gần nhất ở trên cùng
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    const now = Date.now();

    const list = sessions.filter((s) => {
      const isCancelled = s.status === 'cancelled';
      const isPast = Date.parse(s.endsAt) < now;

      // Lọc theo tab trạng thái
      if (statusTab === 'upcoming' && (isCancelled || isPast)) return false;
      if (statusTab === 'past' && (isCancelled || !isPast)) return false;
      if (statusTab === 'cancelled' && !isCancelled) return false;

      // Lọc theo workshop
      if (workshopFilter && s.workshopId !== workshopFilter) return false;

      // Tìm kiếm theo tên workshop hoặc ngày
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = s.workshopTitle.toLowerCase().includes(q);
        const dateMatch = formatSessionDate(s.startsAt)
          .toLowerCase()
          .includes(q);
        if (!titleMatch && !dateMatch) return false;
      }

      return true;
    });

    // Sắp xếp: "buổi gần nhất ở trên cùng"
    return list.sort((a, b) => {
      const aStarts = Date.parse(a.startsAt);
      const bStarts = Date.parse(b.startsAt);
      const aEnds = Date.parse(a.endsAt);
      const bEnds = Date.parse(b.endsAt);
      const aIsCancelled = a.status === 'cancelled';
      const bIsCancelled = b.status === 'cancelled';

      if (sortBy === 'nearest') {
        if (statusTab === 'past' || statusTab === 'cancelled') {
          return bStarts - aStarts;
        }
        if (statusTab === 'upcoming') {
          return aStarts - bStarts;
        }
        if (aIsCancelled !== bIsCancelled) return aIsCancelled ? 1 : -1;
        const aIsFuture = aEnds >= now;
        const bIsFuture = bEnds >= now;
        if (aIsFuture && !bIsFuture) return -1;
        if (!aIsFuture && bIsFuture) return 1;
        if (aIsFuture && bIsFuture) return aStarts - bStarts;
        return bStarts - aStarts;
      }

      if (sortBy === 'newest') {
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      }

      if (sortBy === 'price_desc') {
        return b.price - a.price;
      }

      if (sortBy === 'fill_rate') {
        const aRate =
          a.capacity > 0 ? (a.seatsHeld + a.seatsSold) / a.capacity : 0;
        const bRate =
          b.capacity > 0 ? (b.seatsHeld + b.seatsSold) / b.capacity : 0;
        return bRate - aRate;
      }

      return aStarts - bStarts;
    });
  }, [sessions, statusTab, workshopFilter, searchQuery, sortBy]);

  return (
    <section aria-label="Lịch buổi học" className="space-y-5">
      {/* 4 Thẻ chỉ số tổng quan nhanh */}
      {!isLoading && !error && Boolean(sessions?.length) && (
        <SessionStatsCards stats={stats} />
      )}

      {/* Thanh bộ lọc, tìm kiếm và nút Tạo buổi */}
      {!isLoading && !error && Boolean(sessions?.length) && (
        <SessionFilterBar
          stats={stats}
          statusTab={statusTab}
          onStatusTabChange={setStatusTab}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          workshopFilter={workshopFilter}
          onWorkshopFilterChange={setWorkshopFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          availableWorkshops={availableWorkshops}
          onCreateSession={() => setCreating(true)}
        />
      )}

      {/* Hiển thị nội dung chính */}
      {isLoading ? (
        <div className="grid gap-studio-card xl:grid-cols-2">
          {[0, 1, 2].map((item) => (
            <StudioSkeleton
              key={item}
              label="Đang tải lịch workshop…"
              className="h-52 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <StudioCard className="space-y-4" role="alert">
          <p className="text-studio-danger">
            Không thể tải lịch: {error.message}
          </p>
          <StudioButton onClick={onRetry} variant="secondary">
            Tải lại lịch
          </StudioButton>
        </StudioCard>
      ) : !sessions?.length ? (
        availableWorkshops.length ? (
          <StudioEmptyState
            icon={CalendarDays}
            title="Lịch workshop chưa có buổi nào"
            description="Tạo một buổi mới để khách có thể chọn ngày và đặt chỗ."
            action={
              <StudioButton onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" className="size-4 mr-1.5" /> Tạo buổi
                đầu tiên
              </StudioButton>
            }
          />
        ) : (
          <StudioEmptyState
            icon={CalendarDays}
            title="Tạo workshop trước nhé"
            description="Sau khi có workshop, bạn có thể thêm ngày giờ và số chỗ cho từng buổi."
            action={
              <StudioButton asChild variant="secondary">
                <Link to={`/studio/${studio.id}/workshops`}>Đến Workshop</Link>
              </StudioButton>
            }
          />
        )
      ) : !filteredSessions.length ? (
        <StudioEmptyState
          icon={Search}
          title="Không tìm thấy buổi phù hợp"
          description="Thử đổi từ khóa tìm kiếm hoặc chuyển sang tab trạng thái khác."
          action={
            <StudioButton
              variant="secondary"
              onClick={() => {
                setSearchQuery('');
                setWorkshopFilter('');
                setStatusTab('all');
              }}
            >
              Xem tất cả buổi
            </StudioButton>
          }
        />
      ) : viewMode === 'grid' ? (
        /* DẠNG THẺ (GRID VIEW) */
        <ul className="grid gap-studio-card xl:grid-cols-2">
          {filteredSessions.map((session) => (
            <SessionCardItem
              key={session.id}
              session={session}
              isCanceling={Boolean(canceling)}
              onEdit={setEditing}
              onRequestCancel={setCanceling}
            />
          ))}
        </ul>
      ) : (
        /* DẠNG BẢNG (TABLE VIEW) */
        <SessionTableView
          sessions={filteredSessions}
          onEdit={setEditing}
          onRequestCancel={setCanceling}
        />
      )}

      {/* Sheet tạo/sửa buổi học */}
      <SessionEditorSheet
        open={creating || Boolean(editing)}
        studio={studio}
        workshops={availableWorkshops}
        session={editing}
        onCancel={closeEditor}
      />

      {/* Dialog xác nhận hủy buổi học */}
      <SessionCancelDialog
        session={canceling}
        onClose={() => setCanceling(undefined)}
        onConfirm={confirmCancel}
        isPending={cancelSession.isPending}
      />
    </section>
  );
}
