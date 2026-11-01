import { useEffect, useRef, useState } from 'react';

export function useBookingTicketActions(code: string) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    if (!printing) return;
    const close = () => setPrinting(false);
    window.addEventListener('afterprint', close);
    const frame = requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        setFeedback('Không mở được hộp thoại in. Bạn có thể lưu vé thành ảnh.');
        setPrinting(false);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', close);
    };
  }, [printing]);

  async function saveImage() {
    if (!ticketRef.current) return;
    setSaving(true);
    setFeedback('');
    try {
      await document.fonts.ready;
      const { toPng } = await import('html-to-image');
      const image = await toPng(ticketRef.current, {
        pixelRatio: 2,
        preferredFontFormat: 'woff2',
      });
      const link = document.createElement('a');
      link.download = `Open-Slot-${code.replace(/[^a-zA-Z0-9_-]/g, '-')}.png`;
      link.href = image;
      link.click();
      setFeedback('Đã lưu vé thành ảnh PNG.');
    } catch {
      setFeedback('Chưa lưu được ảnh. Vui lòng thử lại hoặc chọn In vé.');
    } finally {
      setSaving(false);
    }
  }
  return {
    ticketRef,
    saving,
    printing,
    feedback,
    saveImage,
    startPrinting: () => setPrinting(true),
  };
}
