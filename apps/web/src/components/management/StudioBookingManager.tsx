import { useMemo, useState } from 'react';
import { StudioAttendancePanel } from './StudioAttendancePanel';
import { StudioRefundPanel } from './StudioRefundPanel';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../../lib/api-client';
import { useAuth } from '../../hooks/useAuth';
import { queryKeys } from '../../lib/query-keys';
import {
  ClipboardList,
} from 'lucide-react';
import {
  StudioButton,
  StudioCard,
  StudioEmptyState,
  StudioSkeleton,
} from './StudioPrimitives';

import { BookingStatsCards } from './bookings/BookingStatsCards';
import { BookingFilterBar, type FilterTab } from './bookings/BookingFilterBar';
import { BookingCardItem, type BookingItemData } from './bookings/BookingCardItem';
import { BookingTableView } from './bookings/BookingTableView';
import { BookingCollectionModal } from './bookings/BookingCollectionModal';

const responseSchema = z.object({
  bookings: z.array(
    z.object({
      id: z.uuid(),
      orderCode: z.string(),
      quantity: z.number(),
      contactName: z.string(),
      contactPhone: z.string().nullable(),
      totalAmount: z.number(),
      paidAmount: z.number(),
      depositAmount: z.number(),
      paymentMode: z.string(),
      refundStatus: z.string().optional(),
      refundDueAmount: z.number().optional(),
      refundedAmount: z.number().optional(),
      reschedulePending: z.boolean().optional(),
      seatRevision: z.number().int().optional(),
      balanceAmount: z.number(),
      reservationStatus: z.string(),
      paymentStatus: z.string(),
      startsAt: z.string(),
      endsAt: z.string().optional(),
      attendanceStatus: z.string().optional(),
      workshopTitle: z.string(),
    }),
  ),
});
export type Booking = z.infer<typeof responseSchema>['bookings'][number];

export const prefetchData = (
  client: QueryClient,
  userId: string,
  studioId: string,
) =>
  client.prefetchQuery({
    queryKey: queryKeys.bookings.forStudio(userId, studioId),
    queryFn: async ({ signal }) =>
      responseSchema.parse(
        await apiFetch(`/studios/${studioId}/bookings`, { signal }),
      ).bookings,
    staleTime: 30_000,
  });

export function StudioBookingManager({ studioId }: { studioId: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = queryKeys.bookings.forStudio(user?.id, studioId);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('all');

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      responseSchema.parse(
        await apiFetch<unknown>(`/studios/${studioId}/bookings`, { signal }),
      ).bookings,
    refetchInterval: 30000,
    enabled: Boolean(user),
  });

  const payment = useMutation({
    mutationFn: (booking: BookingItemData) =>
      apiFetch(`/studios/${studioId}/bookings/${booking.id}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({ expectedAmount: booking.balanceAmount }),
      }),
    onSuccess: async () => {
      setSelected(null);
      await client.invalidateQueries({ queryKey: key });
    },
  });

  const isEligibleForCollection = (b: BookingItemData) => {
    return (
      ['confirmed', 'completed'].includes(b.reservationStatus) &&
      b.paymentStatus === 'pending' &&
      !b.reschedulePending &&
      ((b.seatRevision ?? 0) > 0 ||
        !['pending', 'refunded'].includes(b.refundStatus ?? '')) &&
      b.balanceAmount > 0
    );
  };

  const copyOrderCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const allBookings = query.data ?? [];

  // Summary statistics
  const stats = useMemo(() => {
    const totalCount = allBookings.length;
    const needsCollectionList = allBookings.filter(isEligibleForCollection);
    const needsCollectionCount = needsCollectionList.length;
    const needsCollectionAmount = needsCollectionList.reduce(
      (sum, b) => sum + b.balanceAmount,
      0,
    );
    const paidCount = allBookings.filter(
      (b) => b.paymentStatus === 'paid',
    ).length;
    const totalGuests = allBookings
      .filter((b) => b.reservationStatus !== 'cancelled')
      .reduce((sum, b) => sum + b.quantity, 0);

    const workshops = Array.from(
      new Set(allBookings.map((b) => b.workshopTitle).filter(Boolean)),
    ).sort();

    return {
      totalCount,
      needsCollectionCount,
      needsCollectionAmount,
      paidCount,
      totalGuests,
      workshops,
    };
  }, [allBookings]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return allBookings.filter((booking) => {
      // Tab filter
      if (
        activeTab === 'needs_collection' &&
        !isEligibleForCollection(booking)
      ) {
        return false;
      }
      if (activeTab === 'paid' && booking.paymentStatus !== 'paid') {
        return false;
      }
      if (activeTab === 'reschedule' && !booking.reschedulePending) {
        return false;
      }
      if (
        activeTab === 'cancelled' &&
        booking.reservationStatus !== 'cancelled' &&
        booking.paymentStatus !== 'refund_needed' &&
        !['pending', 'refunded'].includes(booking.refundStatus ?? '')
      ) {
        return false;
      }

      // Workshop filter
      if (
        selectedWorkshop !== 'all' &&
        booking.workshopTitle !== selectedWorkshop
      ) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const needle = searchTerm.trim().toLowerCase();
        const matchCode = booking.orderCode.toLowerCase().includes(needle);
        const matchName = booking.contactName.toLowerCase().includes(needle);
        const matchPhone = (booking.contactPhone ?? '')
          .toLowerCase()
          .includes(needle);
        const matchTitle = booking.workshopTitle.toLowerCase().includes(needle);
        if (!matchCode && !matchName && !matchPhone && !matchTitle) {
          return false;
        }
      }

      return true;
    });
  }, [allBookings, activeTab, selectedWorkshop, searchTerm]);

  if (query.isPending) {
    return (
      <div className="space-y-studio-card" aria-label="Đang tải đặt chỗ">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <StudioSkeleton
              key={item}
              label="Đang tải số liệu…"
              className="h-24 animate-pulse rounded-studio-card"
            />
          ))}
        </div>
        {[0, 1, 2].map((item) => (
          <StudioSkeleton
            key={item}
            label="Đang tải đặt chỗ…"
            className="h-32 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <StudioCard className="space-y-4" role="alert">
        <p className="text-studio-danger">
          Không thể tải đặt chỗ: {query.error.message}
        </p>
        <StudioButton onClick={() => void query.refetch()} variant="secondary">
          Thử tải lại
        </StudioButton>
      </StudioCard>
    );
  }

  return (
    <section aria-label="Quản lý đặt chỗ" className="space-y-studio-section">
      {/* Refund and Attendance operations */}
      <StudioRefundPanel
        studioId={studioId}
        bookings={query.data}
        updated={() => client.invalidateQueries({ queryKey: key })}
      />
      <StudioAttendancePanel
        studioId={studioId}
        bookings={query.data}
        onUpdated={() => client.invalidateQueries({ queryKey: key })}
      />

      {/* KPI Stats Cards */}
      <BookingStatsCards stats={stats} />

      {/* Filter and Search Bar */}
      <BookingFilterBar
        stats={stats}
        totalBookingsCount={allBookings.length}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        selectedWorkshop={selectedWorkshop}
        onSelectedWorkshopChange={setSelectedWorkshop}
        isFetching={query.isFetching}
        onRefresh={() => void query.refetch()}
        onResetFilters={() => {
          setSearchTerm('');
          setActiveTab('all');
          setSelectedWorkshop('all');
        }}
      />

      {/* Bookings Display */}
      {!allBookings.length ? (
        <StudioEmptyState
          icon={ClipboardList}
          title="Chưa có đặt chỗ nào"
          description="Khi khách đặt workshop, thông tin đơn và trạng thái thanh toán sẽ hiển thị tại đây."
        />
      ) : !filteredBookings.length ? (
        <StudioCard className="py-12 text-center">
          <p className="text-base font-medium text-studio-ink">
            Không tìm thấy đặt chỗ phù hợp với điều kiện tìm kiếm.
          </p>
          <p className="mt-1 text-sm text-studio-muted">
            Vui lòng thử thay đổi từ khóa hoặc bộ lọc trạng thái.
          </p>
          <StudioButton
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setSearchTerm('');
              setActiveTab('all');
              setSelectedWorkshop('all');
            }}
          >
            Hiển thị tất cả đặt chỗ
          </StudioButton>
        </StudioCard>
      ) : (
        <>
          {/* Desktop Table View */}
          <BookingTableView
            bookings={filteredBookings}
            copiedId={copiedId}
            onCopyOrderCode={copyOrderCode}
            isEligibleForCollection={isEligibleForCollection}
            isPaymentPending={payment.isPending}
            onSelectForCollection={(booking) => {
              payment.reset();
              setSelected(booking as Booking);
            }}
          />

          {/* Mobile Card View */}
          <ul className="space-y-3 md:hidden">
            {filteredBookings.map((booking) => (
              <BookingCardItem
                key={booking.id}
                booking={booking}
                copiedId={copiedId}
                onCopyOrderCode={copyOrderCode}
                isEligibleForCollection={isEligibleForCollection(booking)}
                isPaymentPending={payment.isPending}
                onSelectForCollection={(b) => {
                  payment.reset();
                  setSelected(b as Booking);
                }}
              />
            ))}
          </ul>
        </>
      )}

      {/* Confirmation Modal */}
      <BookingCollectionModal
        selected={selected}
        onClose={() => setSelected(null)}
        onConfirm={(b) => payment.mutate(b as BookingItemData)}
        isPending={payment.isPending}
        errorMessage={payment.isError ? payment.error.message : undefined}
      />
    </section>
  );
}
