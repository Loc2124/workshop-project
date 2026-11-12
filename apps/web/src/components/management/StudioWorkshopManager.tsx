import { useState } from 'react';
import { Images, Plus } from 'lucide-react';
import type { MemberStudio, StudioWorkshop } from '../../types/management';
import { Sheet, SheetContent } from '../ui/sheet';
import {
  StudioButton,
  StudioCard,
  StudioEmptyState,
  StudioSkeleton,
} from './StudioPrimitives';
import { WorkshopCardItem } from './workshops/WorkshopCardItem';
import { WorkshopEditorSheet } from './workshops/WorkshopEditorSheet';

export interface StudioWorkshopManagerProps {
  studio: MemberStudio;
  workshops: StudioWorkshop[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function StudioWorkshopManager({
  studio,
  workshops,
  isLoading,
  error,
  onRetry,
}: StudioWorkshopManagerProps) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StudioWorkshop>();
  const canManage = studio.role === 'owner' && studio.status === 'approved';
  const editorOpen = creating || Boolean(editing);
  const closeEditor = () => {
    setCreating(false);
    setEditing(undefined);
  };

  return (
    <section aria-label="Danh sách workshop" className="space-y-studio-section">
      <div className="flex flex-col gap-4 rounded-studio-card border border-studio-border bg-studio-surface p-studio-card shadow-studio-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm leading-6 text-studio-muted">
            Quản lý bản nháp và workshop công khai. Admin hậu kiểm nội dung và
            báo cáo.
          </p>
          {!isLoading && !error && (
            <p className="mt-2 text-sm font-medium text-studio-primary">
              {workshops?.length ?? 0} workshop
            </p>
          )}
          {studio.status !== 'approved' && (
            <p className="mt-2 text-sm text-studio-muted">
              Studio cần được duyệt trước khi tạo hoặc cập nhật workshop.
            </p>
          )}
        </div>
        {canManage && (
          <StudioButton onClick={() => setCreating(true)} className="shrink-0 min-h-11">
            <Plus aria-hidden="true" className="size-4" /> Tạo workshop
          </StudioButton>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-studio-card sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <StudioSkeleton
              key={item}
              label="Đang tải workshop…"
              className="h-72 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <StudioCard className="space-y-4" role="alert">
          <p className="text-studio-danger">
            Không thể tải workshop: {error.message}
          </p>
          <StudioButton onClick={onRetry} variant="secondary" className="min-h-11">
            Tải lại workshop
          </StudioButton>
        </StudioCard>
      ) : workshops?.length ? (
        <ul className="grid gap-studio-card sm:grid-cols-2 xl:grid-cols-3">
          {workshops.map((workshop) => (
            <WorkshopCardItem
              key={workshop.id}
              workshop={workshop}
              canManage={canManage}
              studioApproved={studio.status === 'approved'}
              onEdit={setEditing}
            />
          ))}
        </ul>
      ) : (
        <StudioEmptyState
          icon={Images}
          title="Chưa có workshop nào"
          description="Workshop đã tạo sẽ xuất hiện tại đây để bạn quản lý và cập nhật nội dung."
          action={
            canManage ? (
              <StudioButton onClick={() => setCreating(true)} className="min-h-11">
                <Plus aria-hidden="true" className="size-4" /> Tạo workshop đầu
                tiên
              </StudioButton>
            ) : undefined
          }
        />
      )}

      <Sheet open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <SheetContent
          side="right"
          closeLabel="Đóng biểu mẫu"
          className="max-w-2xl gap-0 overflow-hidden border-studio-border bg-studio-canvas p-0 text-studio-ink"
        >
          {editorOpen && (
            <WorkshopEditorSheet
              isOwner={studio.role === 'owner'}
              canCollectDeposit={studio.canCollectDeposit === true}
              key={editing?.id ?? 'new-workshop'}
              onCancel={closeEditor}
              studioId={studio.id}
              workshop={editing}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
