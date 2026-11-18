import { z } from 'zod';
export const messageTemplateKeySchema = z.enum([
  'studio_approved',
  'studio_needs_changes',
  'studio_rejected',
  'studio_suspended',
  'booking_success',
  'booking_cancelled',
]);
export type MessageTemplateKey = z.infer<typeof messageTemplateKeySchema>;
const bookingSample = {
  customerName: 'Nguyễn Mai',
  studioName: 'Studio Gốm An',
  workshopName: 'Làm cốc gốm thủ công',
  bookingCode: 'OS20261115001',
  slotTime: '15/11/2026 09:00',
  quantity: '2',
  bookingStatus: 'Đã xác nhận',
  paymentStatus: 'Đã thanh toán',
};
const studioSample = {
  studioName: 'Studio Gốm An',
  reason: 'Vui lòng bổ sung ảnh mặt tiền rõ biển hiệu studio.',
};
export const messageTemplateSpecs: Record<
  MessageTemplateKey,
  {
    label: string;
    variables: readonly string[];
    sample: Record<string, string>;
  }
> = {
  studio_approved: {
    label: 'Studio được duyệt',
    variables: ['studioName'],
    sample: studioSample,
  },
  studio_needs_changes: {
    label: 'Studio cần bổ sung',
    variables: ['studioName', 'reason'],
    sample: studioSample,
  },
  studio_rejected: {
    label: 'Studio bị từ chối',
    variables: ['studioName', 'reason'],
    sample: {
      ...studioSample,
      reason: 'Thông tin địa điểm chưa đủ để xác nhận studio.',
    },
  },
  studio_suspended: {
    label: 'Studio bị tạm ngưng',
    variables: ['studioName', 'reason'],
    sample: {
      ...studioSample,
      reason: 'Studio cần xác minh lại thông tin hoạt động.',
    },
  },
  booking_success: {
    label: 'Đặt chỗ thành công',
    variables: [
      'customerName',
      'studioName',
      'workshopName',
      'bookingCode',
      'slotTime',
      'quantity',
      'bookingStatus',
      'paymentStatus',
    ],
    sample: bookingSample,
  },
  booking_cancelled: {
    label: 'Đặt chỗ bị hủy',
    variables: [
      'customerName',
      'studioName',
      'workshopName',
      'bookingCode',
      'slotTime',
      'quantity',
      'bookingStatus',
      'paymentStatus',
      'reason',
    ],
    sample: {
      ...bookingSample,
      bookingStatus: 'Đã hủy',
      paymentStatus: 'Cần hoàn tiền',
      reason: 'Buổi workshop đã bị hủy theo yêu cầu của studio.',
    },
  },
};
export const messageTemplateEditSchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
  })
  .strict();
// Replace only original tokens, never tokens contained in user-provided values.
export function renderMessageTemplate(
  key: MessageTemplateKey,
  template: { subject: string; body: string },
  data: Record<string, unknown>,
) {
  const allowed = new Set(messageTemplateSpecs[key].variables);
  const render = (text: string) =>
    text.replace(/\{\{([^}]*)\}\}/g, (_token, name: string) => {
      const variable = name.trim();
      return allowed.has(variable) &&
        Object.prototype.hasOwnProperty.call(data, variable)
        ? String(data[variable] ?? '')
        : '';
    });
  return {
    subject: render(template.subject)
      .replace(/[\r\n]+/g, ' ')
      .trim(),
    body: render(template.body),
  };
}
