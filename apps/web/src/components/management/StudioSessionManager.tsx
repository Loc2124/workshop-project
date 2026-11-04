import { LoadingState } from '../ui/LoadingState';
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
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { workshopSelectionSchema } from '../../lib/form-validation';

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
    <form
      noValidate
      className="space-y-5 border-y border-line bg-surface py-6"
      onSubmit={submit}
    >
      <div>
        <h3 className="font-heading text-xl font-semibold">
          {session ? 'Sửa lịch buổi' : 'Tạo buổi workshop'}
        </h3>
        <p className="mt-1 text-sm text-muted">
          Thời gian nhập theo giờ Việt Nam (UTC+7).
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {!session && (
          <label className="space-y-2 text-sm font-semibold md:col-span-2">
            <span>Workshop</span>
            <select
              className="min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-base font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          </label>
        )}
        <label className="space-y-2 text-sm font-semibold">
          <span>Bắt đầu</span>
          <Input
            onChange={(event) => update('startsAt', event.target.value)}
            required
            type="datetime-local"
            value={values.startsAt}
          />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Kết thúc</span>
          <Input
            onChange={(event) => update('endsAt', event.target.value)}
            required
            type="datetime-local"
            value={values.endsAt}
          />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Sức chứa</span>
          <Input
            min={1}
            onChange={(event) => update('capacity', event.target.value)}
            required
            step={1}
            type="number"
            value={values.capacity}
          />
        </label>
        {owner && (
          <label className="space-y-2 text-sm font-semibold">
            <span>Giá buổi (VND)</span>
            <Input
              min={0}
              onChange={(event) => update('price', event.target.value)}
              step={1}
              type="number"
              value={values.price}
            />
            {!session && (
              <span className="block font-normal text-muted">
                Để trống để dùng giá cơ sở của workshop.
              </span>
            )}
          </label>
        )}
      </div>
      {validationError && (
        <p className="text-sm text-brick" role="alert">
          {validationError}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={saveSession.isPending} type="submit">
          {saveSession.isPending ? 'Đang lưu…' : 'Lưu buổi'}
        </Button>
        <Button
          disabled={saveSession.isPending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Hủy
        </Button>
      </div>
    </form>
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
    <section aria-labelledby="studio-sessions-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className="font-heading text-2xl font-semibold md:text-3xl"
            id="studio-sessions-title"
          >
            Lịch workshop
          </h2>
          <p className="mt-1 text-muted">
            Các buổi đã lên lịch, đã diễn ra hoặc đã hủy.
          </p>
        </div>
        {!creating && !editing && availableWorkshops.length > 0 && (
          <Button
            onClick={() => setCreating(true)}
            type="button"
            variant="outline"
          >
            Tạo buổi
          </Button>
        )}
        {!isLoading && !error && (
          <span className="text-sm text-muted">
            {sessions?.length ?? 0} buổi
          </span>
        )}
      </div>

      {creating && (
        <div className="mt-5">
          <SessionEditor
            key="new-session"
            onCancel={() => setCreating(false)}
            studio={studio}
            workshops={availableWorkshops}
          />
        </div>
      )}
      {isLoading ? (
        <LoadingState label="Đang tải lịch…" className="py-8 text-muted" />
      ) : error ? (
        <div className="mt-5 space-y-3">
          <p className="text-brick" role="alert">
            Không thể tải lịch: {error.message}
          </p>
          <Button onClick={onRetry} type="button" variant="outline">
            Tải lại lịch
          </Button>
        </div>
      ) : sessions?.length ? (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {sessions.map((session) => (
            <li className="py-5" key={session.id}>
              {editing?.id === session.id ? (
                <SessionEditor
                  key={session.id}
                  onCancel={() => setEditing(undefined)}
                  session={session}
                  studio={studio}
                  workshops={availableWorkshops}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{session.workshopTitle}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {formatSessionDate(session.startsAt)} –{' '}
                        {formatSessionDate(session.endsAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-fit rounded-full bg-soft px-3 py-1 text-sm font-semibold">
                        {sessionStatusLabels[session.status]}
                      </span>
                      {session.status === 'scheduled' && (
                        <>
                          <Button
                            disabled={Boolean(canceling)}
                            onClick={() => {
                              setCreating(false);
                              setEditing(session);
                            }}
                            type="button"
                            variant="outline"
                          >
                            Sửa lịch
                          </Button>
                          {canceling?.id === session.id ? (
                            <div
                              className="flex flex-wrap items-center gap-2"
                              role="group"
                              aria-label={`Xác nhận hủy buổi ${session.workshopTitle}`}
                            >
                              <span className="text-sm text-brick">
                                Hủy buổi này?
                              </span>
                              <Button
                                disabled={cancelSession.isPending}
                                onClick={() => void confirmCancel(session)}
                                type="button"
                                variant="destructive"
                              >
                                Xác nhận hủy
                              </Button>
                              <Button
                                disabled={cancelSession.isPending}
                                onClick={() => setCanceling(undefined)}
                                type="button"
                                variant="outline"
                              >
                                Giữ buổi
                              </Button>
                            </div>
                          ) : (
                            <Button
                              disabled={Boolean(canceling)}
                              onClick={() => setCanceling(session)}
                              type="button"
                              variant="outline"
                            >
                              Hủy buổi
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    {formatPrice(session.price)}đ · Còn{' '}
                    {Math.max(
                      0,
                      session.capacity - session.seatsHeld - session.seatsSold,
                    )}{' '}
                    / {session.capacity} chỗ
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 border-y border-line py-8 text-muted">
          {availableWorkshops.length
            ? 'Studio chưa có buổi workshop nào được lên lịch.'
            : 'Tạo workshop trước khi thêm buổi vào lịch.'}
        </p>
      )}
    </section>
  );
}
