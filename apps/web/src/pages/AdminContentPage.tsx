import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import { invalidateResources } from '../lib/query-invalidation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { MediaImage } from '../components/ui/MediaImage';
import { StatusBadge } from '../components/ui/status-badge';
import { SearchableFilterSelect } from '../components/admin/SearchableFilterSelect';
import { ConfirmReasonDialog } from '../components/admin/ConfirmReasonDialog';
import { apiFetch } from '../lib/api-client';
import {
  featuredConfigSchema,
  featuredSelectionSchema,
  featuredItemSchema,
  previewKey,
  type FeaturedItem,
} from '../services/featuredService';
type Selection = z.infer<typeof featuredSelectionSchema>;
const same = (a: Selection, b: Selection) =>
  JSON.stringify(a) === JSON.stringify(b);
export function AdminContentPage() {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const config = useQuery({
    queryKey: queryKeys.featured.config(userId),
    queryFn: async ({ signal }) =>
      featuredConfigSchema.parse(await apiFetch('/admin/noi-dung', { signal })),
  });
  const [draft, setDraft] = useState<Selection | null>(null);
  const [base, setBase] = useState<Selection | null>(null);
  const [known, setKnown] = useState<Record<string, FeaturedItem>>({});
  const [reset, setReset] = useState(false);
  const current: Selection = draft ?? {
    studioIds: config.data?.studioIds ?? [],
    workshopIds: config.data?.workshopIds ?? [],
  };
  const saved = base ?? {
    studioIds: config.data?.studioIds ?? [],
    workshopIds: config.data?.workshopIds ?? [],
  };
  const dirty = !same(current, saved);
  const mutation = useMutation({
    mutationFn: async () =>
      featuredConfigSchema.parse(
        await apiFetch('/admin/noi-dung', {
          method: 'PUT',
          body: JSON.stringify({ ...current, expected: saved }),
        }),
      ),
    onSuccess: async (data) => {
      client.setQueryData(queryKeys.featured.config(userId), data);
      setDraft(null);
      setBase(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.public.home }),
        invalidateResources(client, userId, ['featured']),
      ]);
      toast.success('Đã lưu nội dung nổi bật trên trang chủ.');
    },
    onError: (error) => toast.error(error.message),
  });
  function change(next: Selection) {
    if (!base)
      setBase({
        studioIds: [...saved.studioIds],
        workshopIds: [...saved.workshopIds],
      });
    setDraft(next);
  }
  async function load(
    type: 'studio' | 'workshop',
    q: string,
    signal: AbortSignal,
  ) {
    const result = z
      .object({ items: z.array(featuredItemSchema) })
      .parse(
        await apiFetch(
          `/admin/noi-dung/search?${new URLSearchParams({ type, q })}`,
          { signal },
        ),
      );
    setKnown((old) => ({
      ...old,
      ...Object.fromEntries(
        result.items.map((i) => [`${i.type}:${i.targetId}`, i]),
      ),
    }));
    return result.items.map((i) => ({
      value: i.targetId,
      label: [i.title, i.subtitle].filter(Boolean).join(' · '),
    }));
  }
  function preview() {
    try {
      const id = crypto.randomUUID();
      localStorage.setItem(
        previewKey(id),
        JSON.stringify({ ...current, expiresAt: Date.now() + 15 * 60 * 1000 }),
      );
      window.open(`/?featuredPreview=${id}`, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(
        'Chưa mở được bản xem trước. Kiểm tra quyền lưu trữ của trình duyệt.',
      );
    }
  }
  const ready = !!config.data && !config.error;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <h1 className="font-heading text-2xl font-semibold">
          Nội dung trang chủ
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!ready || mutation.isPending}
            onClick={preview}
          >
            <ExternalLink size={15} />
            Xem trước trang chủ
          </Button>
          <Button
            disabled={!ready || !dirty || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </div>
      </header>
      {config.isPending ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20 w-full" />
          ))}
        </div>
      ) : config.error ? (
        <div role="alert" className="space-y-3 text-sm text-brick">
          <p>Chưa tải được nội dung trang chủ.</p>
          <Button variant="outline" onClick={() => void config.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted">
            Chọn và kéo thả để sắp xếp. Mục không còn công khai sẽ được bỏ qua
            khi hiển thị; chỗ thiếu tự bù bằng nội dung mới nhất.
          </p>
          <Tabs defaultValue="studio">
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="studio">
                Studio nổi bật · {current.studioIds.length}/6
              </TabsTrigger>
              <TabsTrigger value="workshop">
                Workshop nổi bật · {current.workshopIds.length}/8
              </TabsTrigger>
            </TabsList>
            {(['studio', 'workshop'] as const).map((type) => {
              const ids =
                type === 'studio' ? current.studioIds : current.workshopIds;
              const limit = type === 'studio' ? 6 : 8;
              const items = ids.map(
                (id) =>
                  config.data?.items.find(
                    (i) => i.type === type && i.targetId === id,
                  ) ??
                  known[`${type}:${id}`] ?? {
                    type,
                    targetId: id,
                    title: 'Nội dung không còn tồn tại',
                    subtitle: null,
                    imageUrl: null,
                    eligible: false,
                  },
              );
              const update = (next: string[]) =>
                change({
                  ...current,
                  [type === 'studio' ? 'studioIds' : 'workshopIds']: next,
                });
              return (
                <TabsContent key={type} value={type} className="space-y-4">
                  <SearchableFilterSelect
                    label={
                      type === 'studio' ? 'Studio nổi bật' : 'Workshop nổi bật'
                    }
                    emptyLabel={
                      type === 'studio' ? 'Thêm studio…' : 'Thêm workshop…'
                    }
                    allowClear={false}
                    searchPlaceholder={
                      type === 'studio'
                        ? 'Tìm tên studio…'
                        : 'Tìm workshop hoặc studio…'
                    }
                    disabled={ids.length >= limit || mutation.isPending}
                    value=""
                    excludedValues={ids}
                    loadOptions={(q, signal) => load(type, q, signal)}
                    onChange={(id) => {
                      if (id && !ids.includes(id) && ids.length < limit)
                        update([...ids, id]);
                    }}
                  />
                  <FeaturedList
                    items={items}
                    busy={mutation.isPending}
                    onChange={update}
                  />
                  {!ids.length && (
                    <p className="rounded-sm border border-dashed border-line p-6 text-sm text-muted">
                      Chưa chọn {type === 'studio' ? 'studio' : 'workshop'}.
                      Trang chủ sẽ tự lấy các mục mới nhất đủ điều kiện.
                    </p>
                  )}
                  {ids.length >= limit && (
                    <p className="text-xs text-muted">
                      Đã chọn tối đa {limit} mục. Gỡ một mục để chọn mục khác.
                    </p>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-muted" aria-live="polite">
              {dirty ? 'Có thay đổi chưa lưu.' : 'Nội dung đã được lưu.'}
            </p>
            <Button
              variant="outline"
              disabled={!dirty || mutation.isPending}
              onClick={() => setReset(true)}
            >
              Bỏ thay đổi và tải lại
            </Button>
          </div>
        </>
      )}
      <ConfirmReasonDialog
        open={reset}
        onOpenChange={setReset}
        title="Bỏ thay đổi chưa lưu?"
        description="Tải lại danh sách hiện đang được lưu trên server."
        requireReason={false}
        confirmLabel="Tải lại"
        onConfirm={async () => {
          const result = await config.refetch();
          if (result.error) throw result.error;
          setDraft(null);
          setBase(null);
          setKnown({});
        }}
      />
    </div>
  );
}
function FeaturedList({
  items,
  busy,
  onChange,
}: {
  items: FeaturedItem[];
  busy: boolean;
  onChange: (ids: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function drop(event: DragEndEvent) {
    if (busy || !event.over || event.active.id === event.over.id) return;
    const ids = items.map((i) => i.targetId);
    onChange(
      arrayMove(
        ids,
        ids.indexOf(String(event.active.id)),
        ids.indexOf(String(event.over.id)),
      ),
    );
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={drop}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Nhấn Space để chọn, dùng mũi tên lên xuống để đổi vị trí, Space để thả, Escape để hủy.',
        },
      }}
    >
      <SortableContext
        items={items.map((i) => i.targetId)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="divide-y divide-line">
          {items.map((item, index) => (
            <FeaturedRow
              key={item.targetId}
              item={item}
              index={index}
              busy={busy}
              onRemove={() =>
                onChange(
                  items
                    .filter((i) => i.targetId !== item.targetId)
                    .map((i) => i.targetId),
                )
              }
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
function FeaturedRow({
  item,
  index,
  busy,
  onRemove,
}: {
  item: FeaturedItem;
  index: number;
  busy: boolean;
  onRemove: () => void;
}) {
  const sortable = useSortable({ id: item.targetId, disabled: busy });
  return (
    <li
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        zIndex: sortable.isDragging ? 10 : undefined,
        position: 'relative',
      }}
      className={`flex items-center gap-3 py-3 ${sortable.isDragging ? 'bg-surface shadow-sm' : ''}`}
    >
      <Button
        ref={sortable.setActivatorNodeRef}
        variant="ghost"
        disabled={busy}
        className="size-11 touch-none p-0"
        aria-label={`Đổi thứ tự ${item.title}`}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical size={17} />
      </Button>
      <span className="w-4 text-xs tabular-nums text-muted">{index + 1}</span>
      <MediaImage
        src={item.imageUrl ?? undefined}
        alt=""
        placeholder={item.title}
        showPlaceholderText={false}
        className="size-14 shrink-0 rounded-sm"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="mt-1 truncate text-xs text-muted">{item.subtitle}</p>
        {!item.eligible && (
          <StatusBadge
            status="hidden"
            label="Không còn công khai"
            className="mt-2"
          />
        )}
      </div>
      <Button
        variant="ghost"
        disabled={busy}
        aria-label={`Gỡ ${item.title}`}
        onClick={onRemove}
      >
        <X size={15} />
        <span className="hidden sm:inline">Gỡ</span>
      </Button>
    </li>
  );
}
