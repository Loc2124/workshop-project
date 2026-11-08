import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calculateDeposit, depositSettingsSchema } from '@workshop/shared';
import type { z } from 'zod';
import { apiFetch } from '../../lib/api-client';
import { formatPrice } from '../../lib/format';
import { StudioButton, StudioCard, StudioField } from './StudioPrimitives';
import { bookingScheduleLabel } from '../../lib/booking-detail';

type Settings = z.infer<typeof depositSettingsSchema>;
type Response = {
  settings: Settings & { eligible: boolean };
  minimumPaymentAmount: number | null;
  history: {
    id: string;
    actorName: string;
    before: Settings;
    after: Settings;
    createdAt: string;
  }[];
};
const modes = {
  none: 'Không cọc',
  optional: 'Cọc tùy chọn',
  required: 'Cọc bắt buộc',
};
export function StudioPaymentSettings({ studioId }: { studioId: string }) {
  const client = useQueryClient();
  const [messages, setMessages] = useState<string[]>([]);
  const key = ['studio-payment-settings', studioId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<Response>(`/studios/${studioId}/payment-settings`),
  });
  if (query.isPending)
    return <StudioCard>Đang tải cách thanh toán…</StudioCard>;
  if (!query.data)
    return (
      <StudioCard>
        <p role="alert">Chưa tải được cấu hình thanh toán.</p>
        <StudioButton onClick={() => void query.refetch()}>
          Thử lại
        </StudioButton>
      </StudioCard>
    );
  return (
    <StudioCard className="space-y-5">
      <h2 className="font-heading text-xl font-semibold">
        Thanh toán &amp; đặt cọc
      </h2>
      {messages.map((message) => (
        <p key={message} role="status" className="text-sm text-primary">
          {message}
        </p>
      ))}
      <PaymentForm
        key={query.dataUpdatedAt}
        data={query.data}
        studioId={studioId}
        saved={async (warnings) => {
          setMessages(['Đã lưu cách thanh toán.', ...warnings]);
          await Promise.all([
            client.invalidateQueries({ queryKey: key }),
            client.invalidateQueries({ queryKey: ['catalog'] }),
          ]);
        }}
      />
      <details>
        <summary className="min-h-11 cursor-pointer font-semibold">
          Lịch sử thay đổi
        </summary>
        <ul className="mt-3 space-y-3 text-sm">
          {query.data.history.map((item) => (
            <li key={item.id} className="rounded-lg bg-soft p-3">
              <strong>{item.actorName ?? 'Hệ thống'}</strong> ·{' '}
              {bookingScheduleLabel(item.createdAt, item.createdAt)}
              <p>
                {modes[item.before.depositMode]}{' '}
                {item.before.depositPercent
                  ? `(${item.before.depositPercent}%)`
                  : ''}{' '}
                → {modes[item.after.depositMode]}{' '}
                {item.after.depositPercent
                  ? `(${item.after.depositPercent}%)`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
        {!query.data.history.length && (
          <p className="text-sm">Chưa có thay đổi.</p>
        )}
      </details>
    </StudioCard>
  );
}
function PaymentForm({
  data,
  studioId,
  saved,
}: {
  data: Response;
  studioId: string;
  saved: (warnings: string[]) => Promise<unknown>;
}) {
  const [mode, setMode] = useState(
    data.settings.eligible ? data.settings.depositMode : 'none',
  );
  const [percent, setPercent] = useState(
    data.settings.depositPercent?.toString() ?? '',
  );
  const [release, setRelease] = useState(data.settings.releaseIfUnconfirmed);
  const [minutes, setMinutes] = useState(
    data.settings.releaseBeforeMinutes.toString(),
  );
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: (input: Settings) =>
      apiFetch<{ ok: boolean; warnings: string[] }>(
        `/studios/${studioId}/payment-settings`,
        { method: 'PUT', body: JSON.stringify(input) },
      ),
    onSuccess: (result) => saved(result.warnings),
  });
  const parsedPercent = Number(percent);
  const example =
    parsedPercent >= 1 && parsedPercent <= 50 && Number.isInteger(parsedPercent)
      ? calculateDeposit(200000, parsedPercent)
      : null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const parsed = depositSettingsSchema.safeParse({
      depositMode: mode,
      depositPercent:
        mode === 'none' ? null : percent === '' ? null : Number(percent),
      releaseIfUnconfirmed: release,
      releaseBeforeMinutes: Number(minutes),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Kiểm tra lại cấu hình.');
      return;
    }
    await save.mutateAsync(parsed.data).catch(() => {});
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {!data.settings.eligible && (
        <p className="rounded-lg bg-soft p-4 font-semibold">
          Xác minh studio để bật đặt cọc
        </p>
      )}
      {data.settings.eligible && (
        <fieldset className="space-y-2" disabled={save.isPending}>
          <legend className="mb-2 text-sm font-semibold">
            Cách thanh toán của studio
          </legend>
          {(Object.keys(modes) as (keyof typeof modes)[]).map((value) => (
            <label
              key={value}
              className="flex min-h-14 cursor-pointer gap-3 rounded-lg border border-stone-200 p-3"
            >
              <input
                type="radio"
                name="studio-deposit-mode"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="mt-1 accent-primary"
              />
              <span>
                <strong>{modes[value]}</strong>
                <span className="mt-1 block text-sm text-stone-600">
                  {value === 'none'
                    ? 'Khách trả toàn bộ tại studio.'
                    : value === 'optional'
                      ? 'Khách chọn cọc trước hoặc trả tại studio.'
                      : 'Khách cần đặt cọc để xác nhận chỗ.'}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {data.settings.eligible && mode !== 'none' && (
        <>
          <StudioField
            label="Mức cọc (%)"
            type="number"
            min={1}
            max={50}
            step={1}
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            required
          />
          {parsedPercent > 50 && (
            <p role="alert" className="text-sm text-brick">
              Mức cọc tối đa là 50%
            </p>
          )}
          {example !== null && (
            <p className="text-sm">
              Buổi 200.000 đ → khách cọc {formatPrice(example)} đ
            </p>
          )}
          <p className="text-sm text-stone-600">
            Mức cọc nhỏ giúp giữ chỗ tượng trưng; mức cao giúp giảm vắng mặt.
          </p>
          {mode === 'required' && (
            <p className="rounded-lg bg-soft p-3 text-sm">
              Phù hợp buổi giá cao, ít chỗ hoặc tốn nguyên liệu chuẩn bị riêng.
              Cọc bắt buộc có thể làm giảm số lượt đặt.
            </p>
          )}
          {data.minimumPaymentAmount &&
            example !== null &&
            example < data.minimumPaymentAmount && (
              <p role="alert" className="text-sm text-brick">
                Tiền cọc trong ví dụ thấp hơn mức thanh toán tối thiểu{' '}
                {formatPrice(data.minimumPaymentAmount)} đ.
              </p>
            )}
        </>
      )}
      <fieldset className="space-y-3 border-t border-stone-200 pt-4">
        <legend className="font-semibold">Nhắc khách đến học</legend>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={release}
            onChange={(event) => setRelease(event.target.checked)}
            className="mt-1 accent-primary"
          />
          Nhả chỗ nếu khách chưa xác nhận sẽ đến (chỉ áp dụng khi không cọc)
        </label>
        {release && (
          <StudioField
            label="Nhả chỗ trước giờ học (phút)"
            type="number"
            min={15}
            max={1440}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        )}
        <p className="text-sm text-stone-600">
          Khách được nhắc trước 24 giờ và 2 giờ. Thay đổi chỉ áp dụng cho đặt
          chỗ mới.
        </p>
      </fieldset>
      {(error || save.isError) && (
        <p role="alert" className="text-sm text-brick">
          {error || save.error?.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="text-sm text-primary">
          Đã lưu cách thanh toán.
        </p>
      )}
      {save.data?.warnings.map((warning) => (
        <p key={warning} role="status" className="text-sm text-brick">
          {warning}
        </p>
      ))}
      <StudioButton type="submit" disabled={save.isPending}>
        {save.isPending ? 'Đang lưu…' : 'Lưu cấu hình'}
      </StudioButton>
    </form>
  );
}
