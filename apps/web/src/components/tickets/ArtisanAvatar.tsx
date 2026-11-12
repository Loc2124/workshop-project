import { Img } from '../ui/Img';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const colors = [
  'bg-avatar-moss',
  'bg-avatar-clay',
  'bg-avatar-indigo',
  'bg-avatar-plum',
  'bg-avatar-teal',
];

export function ArtisanAvatar({
  name,
  src,
}: {
  name: string;
  src?: string | null;
}) {
  const [failed, setFailed] = useState<string>();
  const normalized = name
    .replace(/^Nghệ nhân\s+/i, '')
    .trim()
    .normalize('NFC');
  const characters = Array.from(normalized);
  const hash = characters.reduce(
    (value, character) => (value * 31 + character.codePointAt(0)!) >>> 0,
    0,
  );
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold text-white',
        colors[hash % colors.length],
      )}
    >
      {characters[0]?.toLocaleUpperCase('vi') ?? '?'}
      {src && failed !== src && (
        <Img
          variant="thumbnail"
          src={src}
          alt=""
          width={28}
          height={28}
          loading="lazy"
          onError={() => setFailed(src)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
