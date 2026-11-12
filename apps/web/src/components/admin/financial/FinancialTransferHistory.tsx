import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api-client';
import {
  dateTime,
  money,
  statusName,
  type TransferEvent,
} from './financialTypes';

export function FinancialTransferHistory({
  id,
  userId,
}: {
  id: string;
  userId?: string;
}) {
  const [open, setOpen] = useState(false);
  const history = useQuery({
    queryKey: ['private', userId, 'financial-transfer-history', id],
    queryFn: () =>
      apiFetch<{ items: TransferEvent[] }>(
        `/admin/tai-chinh/chuyen-tien/${id}/lich-su`,
      ).then((r) => r.items),
    enabled: open,
  });

  return (
    <details
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="border-t border-line pt-3 text-sm"
    >
      <summary className="min-h-9 cursor-pointer font-semibold text-primary">
        Lịch sử xử lý và mã đối chiếu
      </summary>
      {open &&
        (history.isPending ? (
          <p className="mt-2 text-stone-600">Đang tải lịch sử…</p>
        ) : history.isError ? (
          <p role="alert" className="mt-2 text-rose-800">
            Chưa tải được lịch sử. Vui lòng thử lại.
          </p>
        ) : (
          <ol className="mt-3 space-y-3 border-l-2 border-stone-200 pl-4">
            {history.data.map((item) => (
              <li key={item.id} className="space-y-1">
                <p className="font-semibold text-ink">
                  {statusName(item.event)} · {dateTime(item.createdAt)}
                </p>
                <p className="text-stone-700">
                  {item.actorName ?? 'Hệ thống'}
                  {typeof item.details.reason === 'string'
                    ? ` · ${item.details.reason}`
                    : ''}
                </p>
                {typeof item.details.reference === 'string' &&
                  item.details.reference && (
                    <p className="text-stone-700">
                      Mã đối chiếu: {item.details.reference}
                      {typeof item.details.provider === 'string'
                        ? ` · ${item.details.provider}`
                        : ''}
                    </p>
                  )}
                {typeof item.details.providerFee === 'number' && (
                  <p className="text-stone-700">
                    Phí thực tế: {money(item.details.providerFee)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        ))}
    </details>
  );
}
