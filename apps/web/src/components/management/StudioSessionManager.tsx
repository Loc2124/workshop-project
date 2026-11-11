import { useState, useMemo, type FormEvent } from 'react';
import { formatPrice, formatSessionDate } from '../../lib/format';
import {
  fromVietnamDateTimeLocal,
  toVietnamDateTimeLocal,
} from '../../lib/session-form-time';
import {
  useCancelStudioSession,
  useSaveStudioSession,
} from '../../hooks/useManagement';
import type {
  MemberStudio,
  StudioSession,
  StudioWorkshop,
} from '../../types/management';
import {
  studioSessionInputSchema,
  studioSessionUpdateInputSchema,
} from '../../types/management';
import { workshopSelectionSchema } from '../../lib/form-validation';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Clock3,
  Pencil,
  Plus,
  UsersRound,
  Search,
  LayoutGrid,
  List,
  Calendar,
  X,
  ArrowUpDown,
  CheckCircle2,
} from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';
import { SingleDatePicker } from '../ui/single-date-picker';
import {
  StudioBadge,
  StudioButton,
  StudioCard,
  StudioEmptyState,
  StudioField,
  StudioFormSection,
  StudioSkeleton,
} from './StudioPrimitives';

type Props = {
  studio: MemberStudio;
  workshops: StudioWorkshop[] | undefined;
  sessions: StudioSession[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
};

type SessionValues = {
  workshopId: string;
  startsAt: string;
  endsAt: string;
  price: string;
  capacity: string;
  registrationDeadline: string;
};

function toValues(session?: StudioSession): SessionValues {
  return {
    workshopId: session?.workshopId ?? '',
    startsAt: session ? toVietnamDateTimeLocal(session.startsAt) : '',
    endsAt: session ? toVietnamDateTimeLocal(session.endsAt) : '',
    price: session ? String(session.price) : '',
    capacity: String(session?.capacity ?? 8),
    registrationDeadline: session?.registrationDeadline
      ? toVietnamDateTimeLocal(session.registrationDeadline)
      : '',
  };
}

function SessionEditor({
  studio,
  workshops,
  session,
  onCancel,
}: {
  studio: MemberStudio;
  workshops: StudioWorkshop[];
  session?: StudioSession;
  onCancel: () => void;
}) {
  const saveSession = useSaveStudioSession();
  const [values, setValues] = useState(() => toValues(session));
  const [validationError, setValidationError] = useState('');
  const owner = studio.role === 'owner';

  function update<K extends keyof SessionValues>(
    key: K,
    value: SessionValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateDate(key: 'startsAt' | 'endsAt', date: string) {
    const [, time = ''] = values[key].split('T');
    update(key, `${date}T${time}`);
  }

  function updateTime(key: 'startsAt' | 'endsAt', time: string) {
    const [date = ''] = values[key].split('T');
    update(key, `${date}T${time}`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError('');
    const selectedWorkshop = session
      ? undefined
      : workshopSelectionSchema
          .refine(
            (id) => workshops.some((workshop) => workshop.id === id),
            'Chọn workshop hợp lệ.',
          )
          .safeParse(values.workshopId);
    if (selectedWorkshop && !selectedWorkshop.success) {
      setValidationError('Chọn workshop hợp lệ.');
      return;
    }
    const input = {
      startsAt: fromVietnamDateTimeLocal(values.startsAt),
      endsAt: fromVietnamDateTimeLocal(values.endsAt),
      capacity: Number(values.capacity),
      registrationDeadline: values.registrationDeadline
        ? fromVietnamDateTimeLocal(values.registrationDeadline)
        : null,
      ...(owner && values.price !== '' ? { price: Number(values.price) } : {}),
    };
    const parsed = session
      ? studioSessionUpdateInputSchema.safeParse(input)
      : studioSessionInputSchema.safeParse(input);
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.code === 'custom'
          ? 'Thời gian kết thúc phải sau thời gian bắt đầu.'
          : 'Kiểm tra lại thời gian, sức chứa và giá buổi.',
      );
      return;
    }
    if (
      session &&
      (Date.parse(input.startsAt) !== Date.parse(session.startsAt) ||
        Date.parse(input.endsAt) !== Date.parse(session.endsAt)) &&
      Date.parse(input.startsAt) <= Date.now() + 12 * 3600000
    ) {
      setValidationError(
        'Chỉ có thể đổi sang giờ học còn trên 12 giờ. Nếu không thể giữ giờ cũ, hãy hủy buổi học để hoàn tiền cho khách.',
      );
      return;
    }

    try {
      await saveSession.mutateAsync({
        studioId: studio.id,
        workshopId: selectedWorkshop?.success ? selectedWorkshop.data : null,
        sessionId: session?.id ?? null,
        input: parsed.data,
      });
      onCancel();
    } catch {
      // The mutation reports server errors through the global toast.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-studio-border px-5 py-5 pr-16 sm:px-7 sm:py-6">
        <p className="text-sm font-medium text-studio-muted">Lịch workshop</p>
        <SheetTitle className="mt-1 font-heading text-2xl font-semibold text-studio-ink">
          {session ? 'Sửa lịch buổi' : 'Tạo buổi workshop'}
        </SheetTitle>
        <SheetDescription className="mt-2 text-sm leading-6 text-studio-muted">
          Thời gian nhập theo giờ Việt Nam (UTC+7), sử dụng định dạng 24 giờ.
        </SheetDescription>
      </header>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={submit}
      >
        <div className="min-h-0 flex-1 space-y-studio-section overflow-y-auto px-5 py-2 sm:px-7">
          {!session && (
            <StudioFormSection title="Workshop">
              <label
                htmlFor="studio-session-workshop"
                className="block text-sm font-semibold text-studio-ink"
              >
                Workshop
              </label>
              <select
                id="studio-session-workshop"
                className="min-h-studio-control w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
                onChange={(event) => update('workshopId', event.target.value)}
                required
                value={values.workshopId}
              >
                <option value="">Chọn workshop</option>
                {workshops.map((workshop) => (
                  <option key={workshop.id} value={workshop.id}>
                    {workshop.title}
                  </option>
                ))}
              </select>
            </StudioFormSection>
          )}
          <StudioFormSection
            title="Ngày và giờ"
            description={
              session
                ? 'Chỉ đổi sang giờ học còn trên 12 giờ. Khách đã xác nhận sẽ chọn giữ chỗ hoặc hủy; chỗ đang chờ cọc sẽ được hủy để khách đặt lại. Hạn phản hồi là mốc sớm hơn giữa 48 giờ sau thông báo và 12 giờ trước giờ học mới.'
                : 'Chọn ngày trên lịch và nhập giờ theo định dạng 24h. Giờ Việt Nam (UTC+7).'
            }
          >
            <div className="grid gap-studio-group sm:grid-cols-2">
              <div className="space-y-studio-field">
                <span className="block text-sm font-semibold text-studio-ink">
                  Ngày bắt đầu
                </span>
                <SingleDatePicker
                  ariaLabel="Ngày bắt đầu"
                  value={values.startsAt.split('T')[0] ?? ''}
                  onChange={(date) => updateDate('startsAt', date)}
                />
              </div>
              <StudioField
                label="Giờ bắt đầu"
                lang="vi-VN"
                onChange={(event) => updateTime('startsAt', event.target.value)}
                required
                step={60}
                type="time"
                value={values.startsAt.split('T')[1] ?? ''}
              />
              <div className="space-y-studio-field">
                <span className="block text-sm font-semibold text-studio-ink">
                  Ngày kết thúc
                </span>
                <SingleDatePicker
                  ariaLabel="Ngày kết thúc"
                  value={values.endsAt.split('T')[0] ?? ''}
                  onChange={(date) => updateDate('endsAt', date)}
                />
              </div>
              <StudioField
                label="Giờ kết thúc"
                lang="vi-VN"
                onChange={(event) => updateTime('endsAt', event.target.value)}
                required
                step={60}
                type="time"
                value={values.endsAt.split('T')[1] ?? ''}
              />
            </div>
          </StudioFormSection>
          <StudioFormSection
            title="Hạn đăng ký"
            description="Để trống để đóng đăng ký đúng giờ bắt đầu buổi học."
          >
            <StudioField
              label="Đóng đăng ký lúc"
              type="datetime-local"
              lang="vi-VN"
              value={values.registrationDeadline}
              onChange={(event) =>
                update('registrationDeadline', event.target.value)
              }
            />
          </StudioFormSection>
          <StudioFormSection
            title="Sức chứa và giá"
            description="Thiết lập số lượng chỗ và mức giá áp dụng cho buổi này."
          >
            <div className="grid gap-studio-group sm:grid-cols-2">
              <StudioField
                label="Sức chứa"
                min={1}
                onChange={(event) => update('capacity', event.target.value)}
                required
                step={1}
                type="number"
                value={values.capacity}
              />
              {owner && (
                <StudioField
                  label="Giá buổi (VND)"
                  min={0}
                  onChange={(event) => update('price', event.target.value)}
                  step={1}
                  type="number"
                  value={values.price}
                  hint={
                    !session
                      ? 'Để trống để dùng giá cơ sở của workshop.'
                      : undefined
                  }
                />
              )}
            </div>
          </StudioFormSection>
          {validationError && (
            <p className="text-sm text-studio-danger" role="alert">
              {validationError}
            </p>
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-3 border-t border-studio-border bg-studio-surface px-5 py-4 sm:px-7">
          <StudioButton
            disabled={saveSession.isPending}
            onClick={onCancel}
            type="button"
            variant="secondary"
          >
            Hủy
          </StudioButton>
          <StudioButton
            disabled={saveSession.isPending}
            loading={saveSession.isPending}
            type="submit"
          >
            {saveSession.isPending ? 'Đang lưu…' : 'Lưu buổi'}
          </StudioButton>
        </footer>
      </form>
    </div>
  );
}

function getRelativeDateTag(
  startsAtStr: string,
  endsAtStr: string,
  status: string,
) {
  if (status === 'cancelled') return null;
  const now = new Date();
  const ends = new Date(endsAtStr);
  if (ends.getTime() < now.getTime()) {
    return { label: 'Đã qua', tone: 'neutral' as const };
  }
  const vnNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
  );
  const vnStarts = new Date(
    new Date(startsAtStr).toLocaleString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }),
  );
  const isSameDay =
    vnNow.getFullYear() === vnStarts.getFullYear() &&
    vnNow.getMonth() === vnStarts.getMonth() &&
    vnNow.getDate() === vnStarts.getDate();
  if (isSameDay) {
    return { label: 'Hôm nay', tone: 'success' as const };
  }
  const tomorrow = new Date(vnNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    tomorrow.getFullYear() === vnStarts.getFullYear() &&
    tomorrow.getMonth() === vnStarts.getMonth() &&
    tomorrow.getDate() === vnStarts.getDate();
  if (isTomorrow) {
    return { label: 'Ngày mai', tone: 'warning' as const };
  }
  return null;
}

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
  const [statusTab, setStatusTab] = useState<
    'upcoming' | 'past' | 'cancelled' | 'all'
  >('upcoming');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<
    'nearest' | 'newest' | 'price_desc' | 'fill_rate'
  >('nearest');

  const cancelSession = useCancelStudioSession();
  const availableWorkshops = workshops ?? [];
  const editorOpen = creating || Boolean(editing);

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
        // Nếu ở tab Đã qua hoặc Đã hủy: buổi vừa qua gần nhất ở trên cùng
        if (statusTab === 'past' || statusTab === 'cancelled') {
          return bStarts - aStarts;
        }
        // Nếu ở tab Sắp diễn ra: buổi sắp tới gần nhất (hôm nay/ngày mai) ở trên cùng
        if (statusTab === 'upcoming') {
          return aStarts - bStarts;
        }
        // Ở tab Tất cả: buổi chưa hủy lên trước, buổi sắp tới gần nhất lên đầu, tiếp đến các buổi vừa qua
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
            <div className="flex items-center justify-between text-studio-muted">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Sắp diễn ra
              </span>
              <Calendar className="size-4 text-studio-primary" />
            </div>
            <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
              {stats.upcoming}
            </p>
            <p className="mt-1 text-xs text-studio-muted">buổi đang mở</p>
          </div>

          <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
            <div className="flex items-center justify-between text-studio-muted">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Chỗ còn trống
              </span>
              <UsersRound className="size-4 text-studio-accent" />
            </div>
            <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
              {stats.availableSeats}
            </p>
            <p className="mt-1 text-xs text-studio-muted">
              ghế sẵn sàng đón khách
            </p>
          </div>

          <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
            <div className="flex items-center justify-between text-studio-muted">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Đã kín chỗ
              </span>
              <CheckCircle2 className="size-4 text-studio-success" />
            </div>
            <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-success">
              {stats.fullSessions}
            </p>
            <p className="mt-1 text-xs text-studio-muted">
              buổi đạt 100% sức chứa
            </p>
          </div>

          <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
            <div className="flex items-center justify-between text-studio-muted">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Tổng số buổi
              </span>
              <CalendarDays className="size-4 text-studio-muted" />
            </div>
            <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
              {stats.total}
            </p>
            <p className="mt-1 text-xs text-studio-muted">
              {stats.past} đã xong · {stats.cancelled} đã hủy
            </p>
          </div>
        </div>
      )}

      {/* Thanh bộ lọc, tìm kiếm và nút Tạo buổi */}
      {!isLoading && !error && Boolean(sessions?.length) && (
        <div className="space-y-3">
          {/* Tabs trạng thái + Công cụ chế độ xem & Tạo buổi */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-studio-border pb-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setStatusTab('upcoming')}
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
                onClick={() => setStatusTab('past')}
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
                onClick={() => setStatusTab('cancelled')}
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
                onClick={() => setStatusTab('all')}
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
                  onClick={() => setViewMode('grid')}
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
                  onClick={() => setViewMode('table')}
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
                  onClick={() => setCreating(true)}
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
            {/* Ô tìm kiếm */}
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-studio-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên workshop hoặc ngày..."
                className="min-h-10 w-full rounded-studio-control border border-studio-border bg-studio-surface pl-9 pr-8 text-sm text-studio-ink placeholder:text-studio-muted focus:border-studio-primary focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-studio-muted hover:text-studio-ink"
                  title="Xóa tìm kiếm"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Lọc theo workshop */}
            {availableWorkshops.length > 1 && (
              <select
                aria-label="Lọc theo workshop"
                value={workshopFilter}
                onChange={(e) => setWorkshopFilter(e.target.value)}
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

            {/* Sắp xếp */}
            <div className="flex items-center gap-1.5 text-xs text-studio-muted">
              <ArrowUpDown className="size-3.5" />
              <select
                aria-label="Sắp xếp"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
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
          {filteredSessions.map((session) => {
            const starts = formatSessionDate(session.startsAt, { parts: true });
            const ends = formatSessionDate(session.endsAt, { parts: true });
            const booked = session.seatsHeld + session.seatsSold;
            const remaining = Math.max(0, session.capacity - booked);
            const progress =
              session.capacity > 0
                ? Math.min(100, (booked / session.capacity) * 100)
                : 0;
            const isCancelled = session.status === 'cancelled';
            const isPast = Date.parse(session.endsAt) < Date.now();
            const isFull = !isCancelled && remaining === 0;

            const relativeTag = getRelativeDateTag(
              session.startsAt,
              session.endsAt,
              session.status,
            );

            const statusTone = isCancelled
              ? 'danger'
              : isPast
                ? 'neutral'
                : isFull
                  ? 'warning'
                  : 'success';

            const statusLabel = isCancelled
              ? 'Đã hủy'
              : isPast
                ? 'Đã diễn ra'
                : isFull
                  ? 'Đã kín chỗ'
                  : 'Đã lên lịch';

            return (
              <li key={session.id} className="min-w-0">
                <StudioCard
                  className={`flex h-full flex-col justify-between p-4 transition duration-200 hover:shadow-studio-card-hover sm:p-5 ${
                    isCancelled ? 'opacity-60 bg-studio-subtle/50' : ''
                  }`}
                >
                  <div className="flex gap-4 sm:gap-5">
                    {/* Ô ngày tháng nổi bật */}
                    <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center self-start rounded-studio-control bg-studio-selected px-2 py-3 text-center text-studio-primary">
                      <span className="font-heading text-2xl font-bold leading-none">
                        {starts.day}
                      </span>
                      <span className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide">
                        Tháng {starts.month}
                      </span>
                    </div>

                    {/* Nội dung buổi học */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StudioBadge tone={statusTone}>
                          {statusLabel}
                        </StudioBadge>
                        {relativeTag && (
                          <StudioBadge tone={relativeTag.tone}>
                            {relativeTag.label}
                          </StudioBadge>
                        )}
                      </div>

                      <h3 className="mt-2 font-heading text-lg font-semibold leading-snug text-studio-ink">
                        {session.workshopTitle}
                      </h3>

                      <p className="mt-1.5 inline-flex items-center gap-2 text-sm text-studio-muted">
                        <Clock3
                          aria-hidden="true"
                          className="size-4 shrink-0"
                        />
                        <span>
                          {starts.time} – {ends.time}
                          {starts.date !== ends.date ? ` · ${ends.date}` : ''}
                        </span>
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <span className="font-semibold text-studio-ink">
                          {formatPrice(session.price)}đ
                        </span>
                        {!isCancelled && (
                          <span className="inline-flex items-center gap-1.5 text-studio-muted font-medium">
                            <UsersRound aria-hidden="true" className="size-4" />
                            Còn {remaining}/{session.capacity} chỗ
                          </span>
                        )}
                      </div>

                      {/* Thanh tỷ lệ lấp đầy */}
                      {!isCancelled && (
                        <div className="mt-3">
                          <div
                            aria-label={`Đã đặt ${booked} trên ${session.capacity} chỗ`}
                            aria-valuemax={session.capacity}
                            aria-valuemin={0}
                            aria-valuenow={Math.min(booked, session.capacity)}
                            className="h-2 overflow-hidden rounded-full bg-studio-subtle"
                            role="progressbar"
                          >
                            <div
                              className={`h-full rounded-full transition-[width] duration-studio motion-reduce:transition-none ${
                                isFull ? 'bg-amber-500' : 'bg-studio-primary'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thao tác Sửa / Hủy */}
                  {session.status === 'scheduled' && !isPast && (
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-studio-border pt-3">
                      <StudioButton
                        disabled={Boolean(canceling)}
                        onClick={() => setEditing(session)}
                        type="button"
                        variant="secondary"
                        className="text-xs min-h-9"
                      >
                        <Pencil aria-hidden="true" className="size-3.5 mr-1" />
                        Sửa lịch
                      </StudioButton>
                      <StudioButton
                        disabled={Boolean(canceling)}
                        onClick={() => setCanceling(session)}
                        type="button"
                        variant="ghost"
                        className="text-xs min-h-9 text-studio-danger hover:bg-studio-danger/10"
                      >
                        Hủy buổi
                      </StudioButton>
                    </div>
                  )}
                </StudioCard>
              </li>
            );
          })}
        </ul>
      ) : (
        /* DẠNG BẢNG GỌN (TABLE VIEW) - RẤT DỄ THEO DÕI KHI CÓ NHIỀU BUỔI */
        <div className="overflow-hidden rounded-studio-card border border-studio-border bg-studio-surface shadow-studio-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[28%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="bg-studio-subtle text-xs font-semibold uppercase tracking-wide text-studio-muted">
                <tr>
                  <th className="px-4 py-3.5">Thời gian buổi học</th>
                  <th className="px-3 py-3.5">Workshop</th>
                  <th className="px-3 py-3.5">Giá vé</th>
                  <th className="px-3 py-3.5">Tình trạng chỗ</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-studio-border text-sm">
                {filteredSessions.map((session) => {
                  const starts = formatSessionDate(session.startsAt, {
                    parts: true,
                  });
                  const ends = formatSessionDate(session.endsAt, {
                    parts: true,
                  });
                  const booked = session.seatsHeld + session.seatsSold;
                  const remaining = Math.max(0, session.capacity - booked);
                  const progress =
                    session.capacity > 0
                      ? Math.min(100, (booked / session.capacity) * 100)
                      : 0;
                  const isCancelled = session.status === 'cancelled';
                  const isPast = Date.parse(session.endsAt) < Date.now();
                  const isFull = !isCancelled && remaining === 0;

                  const relativeTag = getRelativeDateTag(
                    session.startsAt,
                    session.endsAt,
                    session.status,
                  );

                  return (
                    <tr
                      key={session.id}
                      className={`hover:bg-studio-selected/50 transition-colors ${
                        isCancelled ? 'opacity-60 bg-studio-subtle/30' : ''
                      }`}
                    >
                      {/* Cột thời gian */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-studio-ink">
                            {starts.date}
                          </span>
                          {relativeTag && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                                relativeTag.tone === 'success'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {relativeTag.label}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-studio-muted flex items-center gap-1">
                          <Clock3 className="size-3.5" />
                          {starts.time} – {ends.time}
                        </p>
                      </td>

                      {/* Cột Workshop */}
                      <td className="px-3 py-4">
                        <p
                          className="font-semibold text-studio-ink truncate"
                          title={session.workshopTitle}
                        >
                          {session.workshopTitle}
                        </p>
                        <div className="mt-1">
                          {isCancelled ? (
                            <StudioBadge tone="danger">Đã hủy</StudioBadge>
                          ) : isPast ? (
                            <StudioBadge tone="neutral">Đã diễn ra</StudioBadge>
                          ) : isFull ? (
                            <StudioBadge tone="warning">Kín chỗ</StudioBadge>
                          ) : (
                            <StudioBadge tone="success">Đang mở</StudioBadge>
                          )}
                        </div>
                      </td>

                      {/* Cột Giá */}
                      <td className="px-3 py-4">
                        <span className="font-medium tabular-nums text-studio-ink">
                          {formatPrice(session.price)}đ
                        </span>
                      </td>

                      {/* Cột Sức chứa */}
                      <td className="px-3 py-4">
                        {!isCancelled ? (
                          <div className="space-y-1">
                            <span className="text-xs text-studio-ink font-medium">
                              Còn {remaining}/{session.capacity} chỗ
                            </span>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-studio-subtle">
                              <div
                                className={`h-full rounded-full ${isFull ? 'bg-amber-500' : 'bg-studio-primary'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-studio-muted">—</span>
                        )}
                      </td>

                      {/* Cột Thao tác */}
                      <td className="px-4 py-4 text-right">
                        {session.status === 'scheduled' && !isPast ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(session)}
                              className="rounded px-2.5 py-1 text-xs font-semibold text-studio-primary hover:bg-studio-selected transition-colors"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => setCanceling(session)}
                              className="rounded px-2.5 py-1 text-xs font-semibold text-studio-danger hover:bg-studio-danger/10 transition-colors"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-studio-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sheet sửa/tạo buổi */}
      <Sheet open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <SheetContent
          side="right"
          closeLabel="Đóng biểu mẫu"
          className="max-w-2xl gap-0 overflow-hidden border-studio-border bg-studio-canvas p-0 text-studio-ink"
        >
          {editorOpen && (
            <SessionEditor
              key={editing?.id ?? 'new-session'}
              onCancel={closeEditor}
              session={editing}
              studio={studio}
              workshops={availableWorkshops}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Hộp thoại hủy buổi */}
      <Dialog
        open={Boolean(canceling)}
        onOpenChange={(open) =>
          !open && !cancelSession.isPending && setCanceling(undefined)
        }
      >
        <DialogContent className="border-studio-border bg-studio-surface p-6 text-studio-ink">
          <DialogTitle className="pr-10 font-heading text-xl font-semibold">
            Hủy buổi workshop?
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm leading-6 text-studio-muted">
            {canceling && (
              <>
                Buổi{' '}
                <span className="font-semibold text-studio-ink">
                  {canceling.workshopTitle}
                </span>{' '}
                bắt đầu lúc {formatSessionDate(canceling.startsAt)} sẽ được đánh
                dấu đã hủy. Toàn bộ tiền cọc và tiền đã thanh toán của khách sẽ
                được hoàn trả đầy đủ.
              </>
            )}
          </DialogDescription>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <StudioButton
              disabled={cancelSession.isPending}
              onClick={() => setCanceling(undefined)}
              type="button"
              variant="secondary"
            >
              Giữ buổi
            </StudioButton>
            <StudioButton
              disabled={cancelSession.isPending || !canceling}
              loading={cancelSession.isPending}
              onClick={() => canceling && void confirmCancel(canceling)}
              type="button"
              className="bg-studio-danger text-white hover:bg-studio-danger/90"
            >
              {cancelSession.isPending ? 'Đang hủy…' : 'Xác nhận hủy'}
            </StudioButton>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
