import type { FormEvent } from 'react';
import { Camera, CameraOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QrScanner } from './QrScanner';
import type { CheckInBusyState } from '../types';

interface CheckInLookupFormProps {
  code: string;
  onCodeChange: (value: string) => void;
  onSubmit: (code: string) => void;
  scanning: boolean;
  onToggleScanning: () => void;
  onScanSuccess: (code: string) => void;
  onScanError: (errorMessage: string) => void;
  busy: CheckInBusyState;
}

export function CheckInLookupForm({
  code,
  onCodeChange,
  onSubmit,
  scanning,
  onToggleScanning,
  onScanSuccess,
  onScanError,
  busy,
}: CheckInLookupFormProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim()) {
      onSubmit(code.trim());
    }
  };

  return (
    <section
      className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
      aria-label="Tra cứu vé"
    >
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={handleSubmit}
      >
        <label className="min-w-0 flex-1 text-sm font-medium">
          Mã vé tham gia
          <input
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Nhập mã 8 ký tự trên vé"
            className="mt-2 min-h-11 w-full rounded-lg border border-line bg-paper px-3 font-mono text-sm"
          />
        </label>
        <Button type="submit" disabled={!code.trim() || busy !== null}>
          <Search className="size-4" aria-hidden="true" /> Tra cứu
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onToggleScanning}
        >
          {scanning ? (
            <CameraOff className="size-4" aria-hidden="true" />
          ) : (
            <Camera className="size-4" aria-hidden="true" />
          )}
          {scanning ? 'Dừng camera' : 'Quét QR'}
        </Button>
      </form>

      {scanning && (
        <QrScanner
          onScan={onScanSuccess}
          onError={onScanError}
          onClose={onToggleScanning}
        />
      )}
    </section>
  );
}
