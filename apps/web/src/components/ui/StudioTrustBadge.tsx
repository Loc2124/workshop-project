import type { StudioTrustLevel } from '@workshop/shared';

export function StudioTrustBadge({
  level,
  explain = false,
}: {
  level?: StudioTrustLevel;
  explain?: boolean;
}) {
  if (!level || level === 'unapproved') return null;
  const verified = level === 'verified';
  const label = verified ? 'Đã xác minh' : 'Đã duyệt hồ sơ';
  const description = verified
    ? 'Admin đã đối chiếu danh tính người đại diện và địa chỉ studio, hoặc giấy đăng ký kinh doanh. Đây không phải cam kết về chất lượng mọi trải nghiệm.'
    : 'Hồ sơ studio đã được admin duyệt. Studio chưa được cấp xác minh danh tính.';
  if (explain)
    return (
      <details className="mt-3 max-w-xl text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">
          {label}
        </summary>
        <p className="pb-3 leading-6 text-muted">{description}</p>
      </details>
    );
  return (
    <span
      title={description}
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${verified ? 'bg-[#DCEFC8] text-[#2A4710]' : 'bg-[#E8E4D8] text-[#4A453C]'}`}
    >
      {label}
    </span>
  );
}
