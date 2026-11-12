import type { QueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { queryKeys } from '../../lib/query-keys';
import {
  invalidatePublicCatalog,
  invalidateResources,
} from '../../lib/query-invalidation';
import { useState, type FormEvent } from 'react';
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
import { GripVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/status-badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { apiFetch } from '../../lib/api-client';
const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  isVisible: z.boolean(),
  sortOrder: z.number(),
  reviewStatus: z.string(),
  workshopCount: z.number(),
});
const responseSchema = z.object({ categories: z.array(categorySchema) });
type Category = z.infer<typeof categorySchema>;
function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
async function loadAllCategories(signal: AbortSignal) {
  const items: Category[] = [];
  let page = 1,
    total = Infinity;
  while (items.length < total) {
    const data = z
      .object({ items: z.array(categorySchema), total: z.number() })
      .parse(
        await apiFetch(
          `/admin/danh-muc?page=${page}&pageSize=100&sort=sortOrder:asc`,
          { signal },
        ),
      );
    items.push(...data.items);
    total = data.total;
    if (!data.items.length) break;
    page++;
  }
  return items;
}
export function AdminCategoriesPage() {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.categories.config(userId),
    queryFn: async ({ signal }) => loadAllCategories(signal),
  });
  const [editor, setEditor] = useState<Category | 'new' | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const save = useMutation({
    mutationFn: async (input: {
      path: string;
      method: string;
      body: unknown;
    }) =>
      responseSchema.parse(
        await apiFetch(input.path, {
          method: input.method,
          body: JSON.stringify(input.body),
        }),
      ).categories,
    onSuccess: async (categories) => {
      client.setQueryData(queryKeys.categories.config(userId), categories);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['categories'] }),
        invalidatePublicCatalog(client),
        invalidateResources(client, userId, ['categories']),
      ]);
      toast.success('Đã cập nhật danh mục workshop.');
    },
    onError: (error) => toast.error(error.message),
  });
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const rows = order
    ? order
        .map((id) => query.data?.find((c) => c.id === id))
        .filter((c): c is Category => !!c)
    : (query.data ?? []);
  function open(category: Category | 'new') {
    setEditor(category);
    setName(category === 'new' ? '' : category.name);
    setSlug(category === 'new' ? '' : category.slug);
    setSlugEdited(category !== 'new');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    if (!editor) return;
    try {
      await save.mutateAsync({
        path:
          editor === 'new'
            ? '/admin/danh-muc'
            : `/admin/danh-muc/${encodeURIComponent(editor.id)}`,
        method: editor === 'new' ? 'POST' : 'PATCH',
        body: { name: name.trim(), slug: slug.trim() },
      });
      setEditor(null);
    } catch {
      // The mutation reports server errors through the global toast.
    }
  }
  async function dragEnd(event: DragEndEvent) {
    if (
      save.isPending ||
      !event.over ||
      event.active.id === event.over.id ||
      event.active.id === 'other' ||
      event.over.id === 'other'
    )
      return;
    const ids = rows.map((c) => c.id);
    const next = arrayMove(
      ids,
      ids.indexOf(String(event.active.id)),
      ids.indexOf(String(event.over.id)),
    );
    setOrder(next);
    try {
      await save.mutateAsync({
        path: '/admin/danh-muc/order',
        method: 'PATCH',
        body: { ids: next, expectedIds: ids },
      });
    } catch {
      void query.refetch();
    } finally {
      setOrder(null);
    }
  }
  if (query.isPending)
    return <LoadingState label="Đang tải danh mục…" variant="page" />;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Danh mục Workshop
          </h1>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            Kéo thả để sắp xếp thứ tự hiển thị ngoài trang khám phá. Loại "Khác"
            luôn nằm cuối.
          </p>
        </div>
        <Button
          disabled={save.isPending || query.isPending || !!query.error}
          onClick={() => open('new')}
        >
          <Plus size={16} />
          Thêm loại workshop
        </Button>
      </header>
      {query.error ? (
        <div role="alert" className="space-y-3 text-sm text-brick">
          <p>Chưa tải được danh mục workshop.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void dragEnd(event)}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                'Nhấn Space để chọn dòng, dùng phím mũi tên lên xuống để đổi vị trí, Space để lưu hoặc Escape để hủy.',
            },
          }}
        >
          <SortableContext
            items={rows.filter((c) => c.id !== 'other').map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <span className="sr-only">Sắp xếp</span>
                  </TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Số workshop</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thứ tự</TableHead>
                  <TableHead>
                    <span className="sr-only">Thao tác</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c, i) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    rank={i + 1}
                    busy={save.isPending}
                    onEdit={() => open(c)}
                    onToggle={() =>
                      void save
                        .mutateAsync({
                          path: `/admin/danh-muc/${encodeURIComponent(c.id)}/visibility`,
                          method: 'PATCH',
                          body: { visible: !c.isVisible },
                        })
                        .catch(() => undefined)
                    }
                  />
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted"
                    >
                      Chưa có loại workshop.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SortableContext>
        </DndContext>
      )}
      <p className="text-xs text-muted">
        Ẩn loại để ngừng cho lựa chọn mới; workshop và studio đã gắn loại vẫn
        được giữ nguyên.
      </p>
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setEditor(null);
        }}
      >
        <DialogContent closeDisabled={save.isPending} className="rounded-md">
          <DialogTitle>
            {editor === 'new' ? 'Thêm loại workshop' : 'Sửa loại workshop'}
          </DialogTitle>
          <DialogDescription className="mt-2">
            Slug được tạo từ tên khi thêm mới; bạn có thể chỉnh lại.
          </DialogDescription>
          <form
            onSubmit={(event) => void submit(event)}
            className="mt-5 space-y-4"
          >
            <label className="block space-y-2 text-sm">
              <span>Tên loại workshop</span>
              <input
                autoFocus
                required
                minLength={2}
                maxLength={80}
                value={name}
                readOnly={
                  editor !== null && editor !== 'new' && editor.id === 'other'
                }
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slugEdited) setSlug(slugify(event.target.value));
                }}
                className="min-h-11 w-full rounded-sm border border-line px-3"
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span>Slug</span>
              <input
                required
                maxLength={100}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="Chữ thường không dấu, số và dấu gạch ngang."
                value={slug}
                readOnly={
                  editor !== null && editor !== 'new' && editor.id === 'other'
                }
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value);
                }}
                className="min-h-11 w-full rounded-sm border border-line px-3"
              />
            </label>
            <footer className="flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={save.isPending}
                onClick={() => setEditor(null)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Đang lưu…' : 'Lưu danh mục'}
              </Button>
            </footer>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function CategoryRow({
  category: c,
  rank,
  busy,
  onEdit,
  onToggle,
}: {
  category: Category;
  rank: number;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const fixed = c.id === 'other';
  const sortable = useSortable({ id: c.id, disabled: fixed || busy });
  return (
    <TableRow
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        position: 'relative',
        zIndex: sortable.isDragging ? 10 : undefined,
      }}
      className={sortable.isDragging ? 'bg-surface shadow-sm' : ''}
    >
      <TableCell>
        <Button
          ref={sortable.setActivatorNodeRef}
          variant="ghost"
          className="size-11 touch-none p-0"
          disabled={fixed || busy}
          aria-label={`Đổi thứ tự ${c.name}`}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical size={17} />
        </Button>
      </TableCell>
      <TableCell className="min-w-36 font-medium">{c.name}</TableCell>
      <TableCell className="whitespace-nowrap text-muted">{c.slug}</TableCell>
      <TableCell className="text-right tabular-nums">
        {c.workshopCount}
      </TableCell>
      <TableCell>
        <StatusBadge
          status={c.isVisible ? 'active' : 'hidden'}
          label={c.isVisible ? 'Hiện' : 'Ẩn'}
        />
      </TableCell>
      <TableCell className="text-right tabular-nums">{rank}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy || fixed} onClick={onEdit}>
            Sửa
          </Button>
          <Button variant="outline" disabled={busy || fixed} onClick={onToggle}>
            {c.isVisible ? 'Ẩn' : 'Hiện'}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export const prefetchData = (client: QueryClient, userId: string) =>
  client.prefetchQuery({
    queryKey: queryKeys.categories.config(userId),
    queryFn: ({ signal }) => loadAllCategories(signal),
    staleTime: 30_000,
  });
