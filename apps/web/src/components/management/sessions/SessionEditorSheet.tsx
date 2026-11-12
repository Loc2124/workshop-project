import { useState, type FormEvent } from 'react';
import {
  fromVietnamDateTimeLocal,
  toVietnamDateTimeLocal,
} from '@/lib/session-form-time';
import { useSaveStudioSession } from '@/hooks/useManagement';
import type {
  MemberStudio,
  StudioSession,
  StudioWorkshop,
} from '@/types/management';
import {
  studioSessionInputSchema,
  studioSessionUpdateInputSchema,
} from '@/types/management';
import { workshopSelectionSchema } from '@/lib/form-validation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../ui/sheet';
import { SingleDatePicker } from '../../ui/single-date-picker';
import {
  StudioButton,
  StudioField,
  StudioFormSection,
} from '../StudioPrimitives';

export type SessionValues = {
  workshopId: string;
  startsAt: string;
  endsAt: string;
  price: string;
  capacity: string;
  registrationDeadline: string;
};

export function toValues(session?: StudioSession): SessionValues {
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

export interface SessionEditorSheetProps {
  open: boolean;
  studio: MemberStudio;
  workshops: StudioWorkshop[];
  session?: StudioSession;
  onCancel: () => void;
}

export function SessionEditorSheet({
  open,
  studio,
  workshops,
  session,
  onCancel,
}: SessionEditorSheetProps) {
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
      // Server error reported through toast
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <SheetContent
        className="w-full sm:max-w-xl flex flex-col p-0 bg-studio-surface"
        side="right"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="border-b border-studio-border px-5 py-5 pr-16 sm:px-7 sm:py-6">
            <p className="text-sm font-medium text-studio-muted">
              Lịch workshop
            </p>
            <SheetTitle className="mt-1 font-heading text-2xl font-semibold text-studio-ink">
              {session ? 'Sửa lịch buổi' : 'Tạo buổi workshop'}
            </SheetTitle>
            <SheetDescription className="mt-2 text-sm leading-6 text-studio-muted">
              Thời gian nhập theo giờ Việt Nam (UTC+7), sử dụng định dạng 24
              giờ.
            </SheetDescription>
          </header>
          <form
            noValidate
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={submit}
          >
            <div className="min-h-0 flex-1 space-y-studio-section overflow-y-auto px-5 py-4 sm:px-7">
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
                    onChange={(event) =>
                      update('workshopId', event.target.value)
                    }
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
                    onChange={(event) =>
                      updateTime('startsAt', event.target.value)
                    }
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
                    onChange={(event) =>
                      updateTime('endsAt', event.target.value)
                    }
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
      </SheetContent>
    </Sheet>
  );
}
