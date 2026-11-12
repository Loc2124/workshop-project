import { Img } from '../ui/Img';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown, Plus, Store } from 'lucide-react';
import type { MemberStudio } from '@/types/management';
import {
  studioState,
  studioStates,
  switchStudioPath,
} from '@/lib/studio-dashboard';
import { useSidebar } from '../ui/sidebar';
import { StatusBadge } from '../ui/status-badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';

export function StudioStatusBadge({ studio }: { studio: MemberStudio }) {
  const state = studioStates[studioState(studio)];
  return (
    <StatusBadge
      status={studioState(studio)}
      label={state.label}
      className="px-1.5 py-0.5"
    />
  );
}
function Cover({ studio }: { studio: MemberStudio }) {
  const image =
    studio.images?.find((image) => image.id === studio.photoIds?.[0]) ??
    studio.images?.[0];
  return image ? (
    <Img
      variant="thumbnail"
      src={image.url}
      thumbnailUrl={image.thumbnailUrl}
      alt=""
      className="size-8 shrink-0 rounded-sm object-cover"
    />
  ) : (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-soft">
      <Store size={18} aria-hidden="true" />
    </div>
  );
}
export function StudioSwitcher({
  studios,
  studio,
}: {
  studios: MemberStudio[];
  studio: MemberStudio;
}) {
  const { state, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div className="studio-switcher border-b border-line p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Chọn studio: ${studio.name}`}
          className="flex min-h-12 w-full items-center gap-2 rounded-sm p-1 text-left outline-none hover:bg-soft focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Cover studio={studio} />
          {state === 'expanded' && (
            <>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block truncate text-sm font-medium">
                  {studio.isDraft ? 'Hồ sơ nháp' : studio.name}
                </span>
                <StudioStatusBadge studio={studio} />
              </span>
              <ChevronsUpDown size={14} className="shrink-0 text-muted" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="w-72">
          <DropdownMenuLabel>Studio của bạn</DropdownMenuLabel>
          <div className="max-h-80 overflow-y-auto">
            {studios.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => {
                  navigate(
                    switchStudioPath(location.pathname, item.id) +
                      location.search +
                      location.hash,
                  );
                  setOpenMobile(false);
                }}
                aria-label={`Chọn ${item.name}`}
              >
                <Cover studio={item} />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate">
                    {item.isDraft ? 'Hồ sơ nháp' : item.name}
                  </span>
                  <StudioStatusBadge studio={item} />
                </span>
                {item.id === studio.id && <Check aria-label="Đang chọn" />}
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/dang-ky-studio" onClick={() => setOpenMobile(false)}>
              <Plus />
              Đăng ký studio khác
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
