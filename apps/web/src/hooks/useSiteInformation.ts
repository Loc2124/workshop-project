import { defaultSiteSettings } from '@workshop/shared';
import { footerInformation } from '../data/siteInformation';
import { useSiteSettings } from './useSiteSettings';
export function useSiteInformation() {
  const settings = useSiteSettings().data ?? defaultSiteSettings;
  const siteContact = settings.support;
  const information = footerInformation.map((item) =>
    item.id === 'ho-tro'
      ? {
          ...item,
          text: `Cần hỗ trợ tìm workshop hoặc kiểm tra đặt chỗ? Liên hệ hotline ${siteContact.hotline} trong khung giờ ${siteContact.workingHours}, hoặc email ${siteContact.email}.`,
        }
      : item.id === 'chinh-sach-dat-lich'
        ? {
            ...item,
            text: `Khách được hủy trước giờ học ít nhất ${settings.booking.cancellationHours} giờ. Mỗi tài khoản được đặt tối đa ${settings.booking.maxActiveSlots} buổi sắp tới đang giữ chỗ hoặc đã xác nhận. Kiểm tra lịch, giá và điều kiện workshop trước khi đặt.`,
          }
        : item,
  );
  return { siteContact, information, settings };
}
