import { useState, type FormEvent } from 'react';
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
import { CalendarDays, Clock3, Pencil, Plus, UsersRound } from 'lucide-react';
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
};

function toValues(session?: StudioSession): SessionValues {
  return {
    workshopId: session?.workshopId ?? '',
    startsAt: session ? toVietnamDateTimeLocal(session.startsAt) : '',
    endsAt: session ? toVietnamDateTimeLocal(session.endsAt) : '',
    price: session ? String(session.price) : '',
    capacity: String(session?.capacity ?? 8),
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
            description="Chọn ngày trên lịch và nhập giờ theo định dạng 24h. Múi giờ được áp dụng là Việt Nam (UTC+7)."
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

const sessionStatusLabels = {
  scheduled: 'Đã lên lịch',
  cancelled: 'Đã hủy',
  completed: 'Đã diễn ra',
} as const;

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

  return (
    <section aria-label="Lịch và slot" className="space-y-studio-section">
      <div className="flex flex-col gap-4 rounded-studio-card border border-studio-border bg-studio-surface p-studio-card shadow-studio-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm leading-6 text-studio-muted">
            Theo dõi lịch trải nghiệm, sức chứa và tình trạng từng buổi.
          </p>
          {!isLoading && !error && (
            <p className="mt-2 text-sm font-medium text-studio-primary">
              {sessions?.length ?? 0} buổi workshop
            </p>
          )}
        </div>
        {availableWorkshops.length > 0 && (
          <StudioButton
            className="shrink-0"
            onClick={() => setCreating(true)}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" /> Tạo buổi
          </StudioButton>
        )}
      </div>

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
      ) : sessions?.length ? (
        <ul className="grid gap-studio-card xl:grid-cols-2">
          {sessions.map((session) => {
            const starts = formatSessionDate(session.startsAt, { parts: true });
            const ends = formatSessionDate(session.endsAt, { parts: true });
            const booked = session.seatsHeld + session.seatsSold;
            const remaining = Math.max(0, session.capacity - booked);
            const progress =
              session.capacity > 0
                ? Math.min(100, (booked / session.capacity) * 100)
                : 0;
            const statusTone =
              session.status === 'scheduled'
                ? 'success'
                : session.status === 'cancelled'
                  ? 'danger'
                  : 'neutral';
            const isCancelled = session.status === 'cancelled';

            return (
              <li key={session.id} className="min-w-0">
                <StudioCard
                  className={`flex h-full gap-4 p-4 transition duration-200 hover:shadow-studio-card-hover sm:gap-5 sm:p-studio-card ${isCancelled ? 'opacity-60' : ''}`}
                >
                  <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center self-start rounded-studio-control bg-studio-selected px-2 py-3 text-center text-studio-primary">
                    <span className="font-heading text-2xl font-bold leading-none">
                      {starts.day}
                    </span>
                    <span className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide">
                      Tháng {starts.month}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <StudioBadge tone={statusTone}>
                          {sessionStatusLabels[session.status]}
                        </StudioBadge>
                        <h2 className="mt-2 font-heading text-lg font-semibold leading-snug text-studio-ink">
                          {session.workshopTitle}
                        </h2>
                      </div>
                    </div>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm text-studio-muted">
                      <Clock3 aria-hidden="true" className="size-4 shrink-0" />
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
                        <span className="inline-flex items-center gap-1.5 text-studio-muted">
                          <UsersRound aria-hidden="true" className="size-4" />
                          Còn {remaining}/{session.capacity} chỗ
                        </span>
                      )}
                    </div>
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
                            className="h-full rounded-full bg-studio-primary transition-[width] duration-studio motion-reduce:transition-none"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {session.status === 'scheduled' && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-studio-border pt-3">
                        <StudioButton
                          disabled={Boolean(canceling)}
                          onClick={() => setEditing(session)}
                          type="button"
                          variant="secondary"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          Sửa lịch
                        </StudioButton>
                        <StudioButton
                          disabled={Boolean(canceling)}
                          onClick={() => setCanceling(session)}
                          type="button"
                          variant="ghost"
                        >
                          Hủy buổi
                        </StudioButton>
                      </div>
                    )}
                  </div>
                </StudioCard>
              </li>
            );
          })}
        </ul>
      ) : availableWorkshops.length ? (
        <StudioEmptyState
          icon={CalendarDays}
          title="Lịch workshop chưa có buổi nào"
          description="Tạo một buổi mới để khách có thể chọn ngày và đặt chỗ."
          action={
            <StudioButton onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" className="size-4" /> Tạo buổi đầu tiên
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
      )}

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
                dấu đã hủy.
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
