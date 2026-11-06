import { useState, type FormEvent } from 'react';
import {
  categories as localCategories,
  DEFAULT_CATEGORY,
  getCategoryMeta,
} from '../../constants/categories';
import { formatPrice } from '../../lib/format';
import { useSaveStudioWorkshop } from '../../hooks/useManagement';
import type { MemberStudio, StudioWorkshop } from '../../types/management';
import {
  studioWorkshopInputSchema,
  studioWorkshopUpdateInputSchema,
} from '../../types/management';
import { requiredPriceFormSchema } from '../../lib/form-validation';
import { useCategories } from '../../hooks/useCategories';
import { proposedCategoryNameSchema } from '@workshop/shared';
import { Clock3, Images, Pencil, Plus, UsersRound } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import {
  StudioBadge,
  StudioButton,
  StudioCard,
  StudioEmptyState,
  StudioField,
  StudioFormSection,
  StudioSkeleton,
} from './StudioPrimitives';

type Props = {
  studio: MemberStudio;
  workshops: StudioWorkshop[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
};

type WorkshopValues = {
  title: string;
  description: string;
  categoryId: string;
  proposedCategoryName: string;
  level: 'beginner' | 'intermediate' | 'all';
  audience: string;
  takeaway: string;
  durationMinutes: string;
  basePrice: string;
  depositPercent: string;
  requirements: string;
  cancellationPolicy: string;
  paymentPolicy: string;
  publicationStatus: 'draft' | 'published';
};

function toValues(workshop?: StudioWorkshop): WorkshopValues {
  return {
    title: workshop?.title ?? '',
    description: workshop?.description ?? '',
    categoryId: workshop?.categoryId ?? '',
    proposedCategoryName: workshop?.proposedCategoryName ?? '',
    level: workshop?.level ?? 'beginner',
    audience: workshop?.audience.join(', ') ?? '',
    takeaway: workshop?.takeaway ?? '',
    durationMinutes: String(workshop?.durationMinutes ?? 90),
    basePrice: String(workshop?.basePrice ?? ''),
    depositPercent: String(workshop?.depositPercent ?? 20),
    requirements: workshop?.requirements ?? '',
    cancellationPolicy: workshop?.cancellationPolicy ?? '',
    paymentPolicy: workshop?.paymentPolicy ?? '',
    publicationStatus:
      workshop?.publicationStatus === 'draft' ? 'draft' : 'published',
  };
}

const fieldLabels: Record<string, string> = {
  title: 'tiêu đề workshop',
  description: 'mô tả workshop',
  categoryId: 'danh mục',
  proposedCategoryName: 'tên danh mục đề xuất (2–80 ký tự)',
  audience: 'đối tượng tham gia',
  durationMinutes: 'thời lượng',
  basePrice: 'giá cơ sở',
  depositPercent: 'mức cọc (0–30%)',
};

function StudioWorkshopEditor({
  studioId,
  workshop,
  isOwner,
  canCollectDeposit,
  onCancel,
}: {
  studioId: string;
  workshop?: StudioWorkshop;
  isOwner: boolean;
  canCollectDeposit: boolean;
  onCancel: () => void;
}) {
  const saveWorkshop = useSaveStudioWorkshop();
  const remoteCategories = useCategories();
  const categories = (remoteCategories ?? localCategories).filter(
    (category) =>
      (category.status === 'active' && category.isVisible !== false) ||
      category.id === 'other' ||
      category.id === workshop?.categoryId,
  );
  if (!categories.some((category) => category.id === 'other')) {
    categories.push(DEFAULT_CATEGORY);
  }
  const [values, setValues] = useState(() => toValues(workshop));
  const [proposingCategory, setProposingCategory] = useState(
    Boolean(workshop?.proposedCategoryName),
  );
  const [validationError, setValidationError] = useState('');
  const [proposalError, setProposalError] = useState('');

  function update<K extends keyof WorkshopValues>(
    key: K,
    value: WorkshopValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === 'proposedCategoryName') setProposalError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveWorkshop.isPending) return;
    setValidationError('');
    setProposalError('');
    if (values.categoryId === 'other' && proposingCategory) {
      const proposal = proposedCategoryNameSchema.safeParse(
        values.proposedCategoryName,
      );
      if (!proposal.success) {
        setProposalError(
          proposal.error.issues[0]?.message ?? 'Kiểm tra tên danh mục.',
        );
        return;
      }
    }
    const price = isOwner
      ? requiredPriceFormSchema.safeParse(values.basePrice)
      : undefined;
    if (price && !price.success) {
      setValidationError(
        price.error.issues[0]?.message ?? 'Giá cơ sở chưa hợp lệ.',
      );
      return;
    }
    const common = {
      title: values.title,
      publicationStatus: values.publicationStatus,
      description: values.description,
      categoryId: values.categoryId,
      proposedCategoryName:
        values.categoryId === 'other' && proposingCategory
          ? values.proposedCategoryName
          : null,
      level: values.level,
      audience: values.audience
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      takeaway: values.takeaway.trim() || null,
      durationMinutes: Number(values.durationMinutes),
      requirements: values.requirements.trim() || null,
      cancellationPolicy: values.cancellationPolicy.trim() || null,
      paymentPolicy: values.paymentPolicy.trim() || null,
    };
    const input = {
      ...common,
      ...(isOwner
        ? {
            depositPercent: canCollectDeposit
              ? Number(values.depositPercent)
              : 0,
          }
        : {}),
      ...(price?.success ? { basePrice: price.data } : {}),
    };
    const parsed = workshop
      ? studioWorkshopUpdateInputSchema.safeParse(input)
      : studioWorkshopInputSchema.safeParse(input);

    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      setValidationError(
        field === 'audience' &&
          values.audience.split(',').filter(Boolean).length > 20
          ? 'Workshop có thể có tối đa 20 nhóm đối tượng.'
          : `Kiểm tra lại ${fieldLabels[String(field)] ?? 'thông tin workshop'}.`,
      );
      return;
    }

    try {
      await saveWorkshop.mutateAsync({
        studioId,
        workshopId: workshop?.id ?? null,
        input: parsed.data,
      });
      onCancel();
    } catch {
      // The mutation reports server errors through the global toast.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-studio-border px-5 py-5 pr-16 sm:px-7 sm:py-6">
        <p className="text-sm font-medium text-studio-muted">
          Workshop của studio
        </p>
        <SheetTitle className="mt-1 font-heading text-2xl font-semibold text-studio-ink">
          {workshop ? 'Sửa workshop' : 'Tạo workshop'}
        </SheetTitle>
        <SheetDescription className="mt-2 max-w-xl text-sm leading-6 text-studio-muted">
          Studio đã duyệt được đăng workshop ngay, không cần admin duyệt từng
          bài. Chọn bản nháp nếu chưa muốn công khai.
        </SheetDescription>
      </header>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={submit}
      >
        <div className="min-h-0 flex-1 space-y-studio-section overflow-y-auto px-5 py-2 sm:px-7">
          <StudioFormSection
            title="Thông tin cơ bản"
            description="Thông tin hiển thị giúp khách hiểu workshop của bạn."
          >
            <div className="grid gap-studio-group sm:grid-cols-2">
              <StudioField
                className="sm:col-span-2"
                label="Tên workshop"
                maxLength={200}
                onChange={(event) => update('title', event.target.value)}
                required
                value={values.title}
              />
              <div className="space-y-studio-field sm:col-span-2">
                <label
                  htmlFor="studio-workshop-description"
                  className="block text-sm font-semibold text-studio-ink"
                >
                  Mô tả
                </label>
                <textarea
                  id="studio-workshop-description"
                  className="min-h-28 w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 py-2 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
                  maxLength={10_000}
                  onChange={(event) =>
                    update('description', event.target.value)
                  }
                  required
                  value={values.description}
                />
              </div>
              <div className="space-y-studio-field">
                <label
                  htmlFor="studio-workshop-category"
                  className="block text-sm font-semibold text-studio-ink"
                >
                  Danh mục workshop
                </label>
                <select
                  id="studio-workshop-category"
                  className="min-h-studio-control w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
                  onChange={(event) => {
                    update('categoryId', event.target.value);
                    if (event.target.value !== 'other')
                      setProposingCategory(false);
                  }}
                  required
                  value={values.categoryId}
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm leading-5 text-studio-muted">
                  Mỗi workshop có thể thuộc một danh mục khác nhau. Nếu chưa có
                  danh mục phù hợp, chọn “Khác” và ghi rõ tên, nội dung workshop
                  ở trên.
                </p>
              </div>
              <div className="space-y-studio-field">
                <label
                  htmlFor="studio-workshop-level"
                  className="block text-sm font-semibold text-studio-ink"
                >
                  Cấp độ
                </label>
                <select
                  id="studio-workshop-level"
                  className="min-h-studio-control w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
                  onChange={(event) =>
                    update(
                      'level',
                      event.target.value as WorkshopValues['level'],
                    )
                  }
                  value={values.level}
                >
                  <option value="beginner">Người mới</option>
                  <option value="intermediate">Đã có kinh nghiệm</option>
                  <option value="all">Mọi cấp độ</option>
                </select>
              </div>
              {values.categoryId === 'other' && (
                <div className="space-y-3 sm:col-span-2">
                  <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-studio-ink">
                    <input
                      type="checkbox"
                      className="size-4 accent-studio-primary"
                      checked={proposingCategory}
                      onChange={(event) =>
                        setProposingCategory(event.target.checked)
                      }
                    />
                    <span>Đề xuất danh mục mới cho workshop này</span>
                  </label>
                  {proposingCategory && (
                    <StudioField
                      label="Tên danh mục đề xuất"
                      value={values.proposedCategoryName}
                      maxLength={80}
                      onChange={(event) =>
                        update('proposedCategoryName', event.target.value)
                      }
                      placeholder="Ví dụ: Thêu tay"
                      required
                      error={proposalError || undefined}
                      hint="Workshop được đăng ngay trong nhóm Khác. Admin xét riêng đề xuất danh mục mới."
                    />
                  )}
                </div>
              )}
              <StudioField
                className="sm:col-span-2"
                label="Phù hợp với (phân tách bằng dấu phẩy)"
                maxLength={2000}
                onChange={(event) => update('audience', event.target.value)}
                placeholder="Người mới, nhóm bạn"
                value={values.audience}
              />
            </div>
          </StudioFormSection>

          <StudioFormSection
            title="Thời lượng và giá"
            description="Thiết lập thời gian trải nghiệm và cách thanh toán."
          >
            <div className="grid gap-studio-group sm:grid-cols-2">
              <StudioField
                label="Thời lượng (phút)"
                min={1}
                onChange={(event) =>
                  update('durationMinutes', event.target.value)
                }
                required
                step={1}
                type="number"
                value={values.durationMinutes}
              />
              {isOwner && (
                <StudioField
                  label="Giá cơ sở (VND)"
                  min={0}
                  onChange={(event) => update('basePrice', event.target.value)}
                  required
                  step={1}
                  type="number"
                  value={values.basePrice}
                />
              )}
              {isOwner && (
                <StudioField
                  className="sm:col-span-2"
                  label="Tiền cọc khách trả trước qua PayOS (%)"
                  type="number"
                  min={0}
                  max={30}
                  step={1}
                  required
                  disabled={!canCollectDeposit}
                  value={canCollectDeposit ? values.depositPercent : '0'}
                  onChange={(event) =>
                    update('depositPercent', event.target.value)
                  }
                  hint={
                    canCollectDeposit
                      ? 'Chọn từ 0–30%, mặc định 20%. Khách quét mã PayOS theo đơn để trả cọc; chọn 0% để thanh toán toàn bộ tại studio.'
                      : 'Để bật cọc, studio cần được admin duyệt, xác minh và hoàn thiện hồ sơ liên hệ cùng ảnh. Hiện khách thanh toán toàn bộ tại studio.'
                  }
                />
              )}
            </div>
          </StudioFormSection>

          <StudioFormSection
            title="Nội dung chi tiết"
            description="Cho khách biết họ sẽ trải nghiệm và mang về điều gì."
          >
            <div className="grid gap-studio-group sm:grid-cols-2">
              <div className="space-y-studio-field sm:col-span-2">
                <label
                  htmlFor="studio-workshop-takeaway"
                  className="block text-sm font-semibold text-studio-ink"
                >
                  Sản phẩm mang về
                </label>
                <textarea
                  id="studio-workshop-takeaway"
                  className="min-h-24 w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 py-2 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
                  maxLength={5000}
                  onChange={(event) => update('takeaway', event.target.value)}
                  value={values.takeaway}
                />
              </div>
              <div className="space-y-studio-field sm:col-span-2">
                <label
                  htmlFor="studio-workshop-requirements"
                  className="block text-sm font-semibold text-studio-ink"
                >
                  Cần chuẩn bị
                </label>
                <textarea
                  id="studio-workshop-requirements"
                  className="min-h-24 w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 py-2 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
                  maxLength={5000}
                  onChange={(event) =>
                    update('requirements', event.target.value)
                  }
                  value={values.requirements}
                />
              </div>
            </div>
          </StudioFormSection>

          <StudioFormSection
            title="Chính sách"
            description="Thông tin thanh toán và hủy để khách chủ động trước khi đặt chỗ."
          >
            <div className="grid gap-studio-group sm:grid-cols-2">
              <div className="space-y-studio-field">
                <label
                  htmlFor="studio-workshop-cancellation-policy"
                  className="block text-sm font-semibold text-studio-ink"
                >
                  Chính sách hủy
                </label>
                <textarea
                  id="studio-workshop-cancellation-policy"
                  className="min-h-24 w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 py-2 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
                  maxLength={5000}
                  onChange={(event) =>
                    update('cancellationPolicy', event.target.value)
                  }
                  value={values.cancellationPolicy}
                />
              </div>
              <div className="space-y-studio-field">
                <label
                  htmlFor="studio-workshop-payment-policy"
                  className="block text-sm font-semibold text-studio-ink"
                >
                  Chính sách thanh toán
                </label>
                <textarea
                  id="studio-workshop-payment-policy"
                  className="min-h-24 w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 py-2 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2"
                  maxLength={5000}
                  onChange={(event) =>
                    update('paymentPolicy', event.target.value)
                  }
                  value={values.paymentPolicy}
                />
              </div>
              <div className="space-y-studio-field sm:col-span-2">
                <label
                  htmlFor="studio-workshop-publication-status"
                  className="block text-sm font-semibold text-studio-ink"
                >
                  Hiển thị workshop
                </label>
                <select
                  id="studio-workshop-publication-status"
                  className="min-h-studio-control w-full rounded-studio-control border border-studio-input-border bg-studio-surface px-3 text-base text-studio-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary focus-visible:ring-offset-2 sm:max-w-xs"
                  value={values.publicationStatus}
                  onChange={(event) =>
                    update(
                      'publicationStatus',
                      event.target.value as 'draft' | 'published',
                    )
                  }
                >
                  <option value="draft">Bản nháp</option>
                  <option value="published">Công khai</option>
                </select>
              </div>
            </div>
          </StudioFormSection>

          {validationError && (
            <p className="text-sm text-studio-danger" role="alert">
              {validationError}
            </p>
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-3 border-t border-studio-border bg-studio-surface px-5 py-4 sm:px-7">
          <StudioButton
            disabled={saveWorkshop.isPending}
            onClick={onCancel}
            type="button"
            variant="secondary"
          >
            Hủy
          </StudioButton>
          <StudioButton
            disabled={saveWorkshop.isPending}
            loading={saveWorkshop.isPending}
            type="submit"
          >
            {saveWorkshop.isPending ? 'Đang lưu…' : 'Lưu workshop'}
          </StudioButton>
        </footer>
      </form>
    </div>
  );
}

const statusLabels = {
  pending: 'Cần lưu lại workshop',
  approved: 'Công khai',
  rejected: 'Cần cập nhật',
} as const;

function workshopStatus(workshop: StudioWorkshop) {
  if (workshop.publicationStatus === 'hidden') return 'Đã bị admin ẩn';
  if (workshop.publicationStatus === 'draft') return 'Bản nháp';
  return statusLabels[workshop.status];
}

export function StudioWorkshopManager({
  studio,
  workshops,
  isLoading,
  error,
  onRetry,
}: Props) {
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
          <StudioButton onClick={() => setCreating(true)} className="shrink-0">
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
          <StudioButton onClick={onRetry} variant="secondary">
            Tải lại workshop
          </StudioButton>
        </StudioCard>
      ) : workshops?.length ? (
        <ul className="grid gap-studio-card sm:grid-cols-2 xl:grid-cols-3">
          {workshops.map((workshop) => {
            const category = getCategoryMeta(workshop.categoryId);
            const depositPercent =
              workshop.effectiveDepositPercent ?? workshop.depositPercent ?? 0;
            const depositPerPerson =
              depositPercent > 0
                ? Math.ceil((workshop.basePrice * depositPercent) / 100)
                : 0;
            const tone =
              workshop.publicationStatus === 'hidden' ||
              workshop.status === 'rejected'
                ? 'danger'
                : workshop.publicationStatus === 'draft' ||
                    workshop.status === 'pending'
                  ? 'warning'
                  : 'success';
            return (
              <li key={workshop.id} className="min-w-0">
                <StudioCard className="group overflow-hidden p-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-studio-card-hover">
                  <div className="relative aspect-16/9 overflow-hidden bg-studio-neutral-soft">
                    <img
                      alt=""
                      className="size-full object-cover transition duration-200 group-hover:scale-[1.02]"
                      decoding="async"
                      height={540}
                      loading="lazy"
                      src={
                        category.placeholderImage ??
                        DEFAULT_CATEGORY.placeholderImage ??
                        undefined
                      }
                      style={{
                        objectPosition: category.imagePosition ?? 'center',
                      }}
                      width={960}
                    />
                    <StudioBadge
                      tone={tone}
                      className="absolute left-3 top-3 shadow-sm"
                    >
                      {workshopStatus(workshop)}
                    </StudioBadge>
                  </div>
                  <div className="flex flex-col gap-4 p-studio-card">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-studio-muted">
                        {category.name}
                      </p>
                      <h3 className="mt-1 line-clamp-2 font-heading text-xl font-semibold leading-snug text-studio-ink">
                        {workshop.title}
                      </h3>
                      {workshop.proposedCategoryName && (
                        <p className="mt-2 text-sm text-studio-muted">
                          Danh mục đề xuất: {workshop.proposedCategoryName} ·
                          Chưa được duyệt
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-studio-muted">
                      <span className="font-semibold text-studio-ink">
                        {formatPrice(workshop.basePrice)}đ
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 aria-hidden="true" className="size-4" />
                        {workshop.durationMinutes} phút
                      </span>
                      {workshop.audience.length > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <UsersRound aria-hidden="true" className="size-4" />
                          {workshop.audience.length} nhóm
                        </span>
                      )}
                    </div>
                    <div className="rounded-xl bg-studio-selected p-3 text-sm">
                      {depositPercent > 0 ? (
                        <>
                          <p className="font-semibold text-studio-primary">
                            Khách cọc {depositPercent}% qua PayOS
                          </p>
                          <p className="mt-1 text-studio-muted">
                            Theo giá cơ sở, mỗi khách cọc{' '}
                            {formatPrice(depositPerPerson)} đ, còn lại{' '}
                            {formatPrice(workshop.basePrice - depositPerPerson)}{' '}
                            đ trả tại studio.
                          </p>
                          <p className="mt-1 text-xs text-studio-muted">
                            Số chính xác tính theo giá buổi và số người trong
                            booking.
                          </p>
                        </>
                      ) : (
                        <p className="font-medium text-studio-muted">
                          Khách thanh toán toàn bộ tại studio.
                        </p>
                      )}
                    </div>
                    <div className="border-t border-studio-border pt-3">
                      <StudioButton
                        className="w-full"
                        disabled={studio.status !== 'approved'}
                        onClick={() => setEditing(workshop)}
                        type="button"
                        variant="secondary"
                      >
                        <Pencil aria-hidden="true" className="size-4" /> Sửa
                        workshop
                      </StudioButton>
                    </div>
                  </div>
                </StudioCard>
              </li>
            );
          })}
        </ul>
      ) : (
        <StudioEmptyState
          icon={Images}
          title="Chưa có workshop nào"
          description="Workshop đã tạo sẽ xuất hiện tại đây để bạn quản lý và cập nhật nội dung."
          action={
            canManage ? (
              <StudioButton onClick={() => setCreating(true)}>
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
            <StudioWorkshopEditor
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
