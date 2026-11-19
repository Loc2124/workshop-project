import { useState } from 'react';
import { money, type VietqrPreview } from './financialTypes';

export interface VietqrTransferModalProps {
  modal: VietqrPreview | null;
  onClose: () => void;
  reference: string;
  onReferenceChange: (val: string) => void;
  fee: string;
  onFeeChange: (val: string) => void;
  onConfirm: () => void;
  isConfirming: boolean;
}

export function VietqrTransferModal({
  modal,
  onClose,
  reference,
  onReferenceChange,
  fee,
  onFeeChange,
  onConfirm,
  isConfirming,
}: VietqrTransferModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!modal) return null;

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(
      () => setCopiedField((curr) => (curr === field ? null : curr)),
      1500,
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vietqr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="vietqr-modal-title"
              className="font-heading text-lg font-bold text-ink"
            >
              Chuyển khoản VietQR 247
            </h3>
            <p className="text-xs text-muted">
              Quét mã bằng app ngân hàng để điền sẵn người nhận, số tiền và nội
              dung đối soát.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {modal.vietqrUrl ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-stone-50 p-4">
            <img
              src={modal.vietqrUrl}
              alt="Mã VietQR thanh toán 247"
              className="h-64 w-64 object-contain rounded-lg border border-stone-200 bg-white p-2 shadow-sm"
            />
            <p className="mt-2 text-xs text-stone-500">
              Hỗ trợ hầu hết app ngân hàng qua Napas 247
            </p>
          </div>
        ) : (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Chưa tạo được ảnh mã QR tự động. Vui lòng chuyển khoản thủ công theo
            thông tin bên dưới.
          </p>
        )}

        <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-stone-600">Ngân hàng:</span>
            <strong className="text-right">
              {modal.bankDisplay || modal.bankName}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-stone-600">Chủ tài khoản:</span>
            <strong>{modal.accountHolder}</strong>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-stone-600">Số tài khoản:</span>
            <div className="flex items-center gap-2">
              <strong className="tabular-nums">{modal.accountNumber}</strong>
              <button
                type="button"
                onClick={() => handleCopy('account', modal.accountNumber)}
                className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-stone-100 min-h-[28px]"
              >
                {copiedField === 'account' ? 'Đã chép' : 'Sao chép'}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-stone-600">Số tiền:</span>
            <strong className="text-sm font-bold text-primary">
              {money(modal.amount)}
            </strong>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-stone-600">Nội dung:</span>
            <div className="flex items-center gap-2">
              <strong className="tabular-nums">{modal.transferContent}</strong>
              <button
                type="button"
                onClick={() => handleCopy('content', modal.transferContent)}
                className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-stone-100 min-h-[28px]"
              >
                {copiedField === 'content' ? 'Đã chép' : 'Sao chép'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-stone-200 pt-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
            <label className="block text-xs font-medium">
              Mã giao dịch / Mã đối chiếu ngân hàng
              <input
                value={reference}
                onChange={(e) => onReferenceChange(e.target.value)}
                placeholder="Ví dụ: FT26315..."
                className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="block text-xs font-medium">
              Phí chuyển (đ)
              <input
                type="number"
                min="0"
                value={fee}
                onChange={(e) => onFeeChange(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isConfirming}
              className="min-h-11 rounded-lg border border-stone-300 px-4 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isConfirming || !reference.trim()}
              className="min-h-11 rounded-lg bg-primary px-4 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {isConfirming ? 'Đang ghi nhận…' : 'Đã chuyển thành công'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
