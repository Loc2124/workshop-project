import { ArrowUpRight, Clock3 } from 'lucide-react';
import type { Studio } from '../../types/studio';
import { MediaImage } from '../ui/MediaImage';

export function studioAddress(address: string, province: string) {
  const clean = address
    .replace(/^Địa chỉ mô phỏng:\s*/i, '')
    .trim()
    .replace(/[,\s]+$/, '');
  return clean
    .toLocaleLowerCase('vi')
    .includes(province.trim().toLocaleLowerCase('vi'))
    ? clean
    : [clean, province.trim()].filter(Boolean).join(', ');
}

export function StudioSidebar({
  studio,
}: {
  studio: Pick<
    Studio,
    'name' | 'address' | 'province' | 'mapImageUrl' | 'openingHours'
  >;
}) {
  const rawAddress = studio.address
    .replace(/^Địa chỉ mô phỏng:\s*/i, '')
    .trim();
  const hasAddress = Boolean(
    rawAddress &&
    rawAddress.toLocaleLowerCase('vi') !==
      studio.province.trim().toLocaleLowerCase('vi'),
  );
  const address = studioAddress(studio.address, studio.province);
  return (
    <div className="rounded-2xl bg-soft p-5">
      <h3 className="font-heading text-xl font-semibold">Hẹn gặp ở xưởng</h3>
      {address && (
        <p
          title={address}
          className="mt-3 text-sm leading-relaxed text-stone-700"
        >
          {address}
        </p>
      )}
      {studio.mapImageUrl ? (
        <MediaImage
          src={studio.mapImageUrl}
          alt={`Bản đồ đến ${studio.name}`}
          placeholder="Bản đồ vị trí xưởng"
          width={480}
          height={280}
          className="mt-4 aspect-12/7 rounded-lg"
        />
      ) : null}
      {studio.openingHours?.trim() && (
        <div className="mt-4 flex items-start gap-2 text-[13px] text-stone-700">
          <Clock3 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Giờ mở cửa</p>
            <p className="mt-1 whitespace-pre-line">
              {studio.openingHours.trim()}
            </p>
          </div>
        </div>
      )}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([hasAddress ? studio.name : undefined, address].filter(Boolean).join(', '))}`}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        {hasAddress ? 'Xem đường đi' : 'Xem khu vực trên bản đồ'}
        <ArrowUpRight size={17} aria-hidden="true" />
      </a>
    </div>
  );
}
