import { useEffect, useRef } from 'react';
import type { IScannerControls } from '@zxing/browser';

interface QrScannerProps {
  onScan: (code: string) => void;
  onError: (errorMessage: string) => void;
  onClose: () => void;
}

export function QrScanner({ onScan, onError, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    let controls: IScannerControls | undefined;
    scannedRef.current = false;

    const start = async () => {
      const video = videoRef.current;
      if (!video || !navigator.mediaDevices?.getUserMedia) {
        onError(
          'Không truy cập được camera. Hãy mở trang bằng HTTPS, cấp quyền camera hoặc nhập mã vé.',
        );
        onClose();
        return;
      }
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result) => {
            const value = result?.getText();
            if (!value || scannedRef.current || stopped) return;
            scannedRef.current = true;
            controls?.stop();
            onScan(value);
          },
        );
        if (stopped) controls.stop();
      } catch (error) {
        if (stopped) return;
        onError(
          error instanceof Error && error.name === 'NotAllowedError'
            ? 'Bạn chưa cấp quyền camera cho trang này. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại.'
            : 'Không mở được camera. Hãy dùng trang HTTPS, kiểm tra quyền camera hoặc nhập mã vé.',
        );
        onClose();
      }
    };

    void start();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [onError, onClose, onScan]);

  return (
    <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 size-full object-cover"
        aria-label="Camera quét mã QR"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[12%] z-10"
      >
        <span className="absolute left-0 top-0 size-8 rounded-tl-lg border-l-[3px] border-t-[3px] border-white" />
        <span className="absolute right-0 top-0 size-8 rounded-tr-lg border-r-[3px] border-t-[3px] border-white" />
        <span className="absolute bottom-0 left-0 size-8 rounded-bl-lg border-b-[3px] border-l-[3px] border-white" />
        <span className="absolute bottom-0 right-0 size-8 rounded-br-lg border-b-[3px] border-r-[3px] border-white" />
      </div>
    </div>
  );
}
