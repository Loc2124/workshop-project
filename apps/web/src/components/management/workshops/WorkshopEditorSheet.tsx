import { useState, type FormEvent } from 'react';
import { proposedCategoryNameSchema } from '@workshop/shared';
import {
  categories as localCategories,
  DEFAULT_CATEGORY,
} from '../../../constants/categories';
import { useCategories } from '../../../hooks/useCategories';
import { useSaveStudioWorkshop } from '../../../hooks/useManagement';
import { requiredPriceFormSchema } from '../../../lib/form-validation';
import type { StudioWorkshop } from '../../../types/management';
import {
  studioWorkshopInputSchema,
  studioWorkshopUpdateInputSchema,
} from '../../../types/management';
import { SheetDescription, SheetTitle } from '../../ui/sheet';
import {
  StudioButton,
  StudioField,
  StudioFormSection,
} from '../StudioPrimitives';

export type WorkshopValues = {
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
  depositModeOverride: 'inherit' | 'none' | 'optional' | 'required';
  included: string;
  requirements: string;
  cancellationPolicy: string;
  paymentPolicy: string;
  publicationStatus: 'draft' | 'published';
  isDiscontinued: boolean;
};

export function toValues(workshop?: StudioWorkshop): WorkshopValues {
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
    depositPercent: workshop?.depositPercent?.toString() ?? '',
    depositModeOverride: workshop?.depositModeOverride ?? 'inherit',
    included: workshop?.included?.join('\n') ?? '',
    requirements: workshop?.requirements ?? '',
    cancellationPolicy: workshop?.cancellationPolicy ?? '',
    paymentPolicy: workshop?.paymentPolicy ?? '',
    publicationStatus:
      workshop?.publicationStatus === 'draft' ? 'draft' : 'published',
    isDiscontinued: workshop?.isDiscontinued ?? false,
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
  depositPercent: 'mức cọc (1–50%)',
};

export interface WorkshopEditorSheetProps {
  studioId: string;
  workshop?: StudioWorkshop;
  isOwner: boolean;
  canCollectDeposit: boolean;
  onCancel: () => void;
}

export function WorkshopEditorSheet({
  studioId,
  workshop,
  isOwner,
  canCollectDeposit,
  onCancel,
}: WorkshopEditorSheetProps) {
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
      included: values.included
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      isDiscontinued: values.isDiscontinued,
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
            depositModeOverride:
              canCollectDeposit && values.depositModeOverride !== 'inherit'
                ? values.depositModeOverride
                : null,
            depositPercent:
              canCollectDeposit &&
              ['optional', 'required'].includes(values.depositModeOverride) &&
              values.depositPercent !== ''
                ? Number(values.depositPercent)
                : null,
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
                <div className="space-y-3">
                  <label className="block text-sm font-semibold">
                    Cách thanh toán riêng cho workshop
                    <select
                      disabled={!canCollectDeposit}
                      value={values.depositModeOverride}
                      onChange={(event) =>
                        update(
                          'depositModeOverride',
                          event.target
                            .value as WorkshopValues['depositModeOverride'],
                        )
                      }
                      className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
                    >
                      <option value="inherit">Dùng cấu hình studio</option>
                      <option value="none">Không cọc</option>
                      <option value="optional">Cọc tùy chọn</option>
                      <option value="required">Cọc bắt buộc</option>
                    </select>
                  </label>
                  {canCollectDeposit &&
                    ['optional', 'required'].includes(
                      values.depositModeOverride,
                    ) && (
                      <StudioField
                        label="Mức cọc (%)"
                        type="number"
                        min={1}
                        max={50}
                        step={1}
                        required
                        value={values.depositPercent}
                        onChange={(event) =>
                          update('depositPercent', event.target.value)
                        }
                      />
                    )}
                  {!canCollectDeposit && (
                    <p className="text-sm text-studio-muted">
                      Xác minh studio để bật đặt cọc.
                    </p>
                  )}
                  {Number(values.depositPercent) > 50 && (
                    <p role="alert" className="text-sm text-studio-danger">
                      Mức cọc tối đa là 50%
                    </p>
                  )}
                </div>
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
              {workshop && (
                <label className="flex items-center gap-3 text-sm font-semibold text-studio-ink sm:col-span-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={values.isDiscontinued}
                    onChange={(event) =>
                      update('isDiscontinued', event.target.checked)
                    }
                  />
                  Đã ngừng tổ chức workshop này
                </label>
              )}
            </div>
          </StudioFormSection>

          <StudioFormSection
            title="Bao gồm"
            description="Mỗi dòng là một mục, ví dụ nguyên liệu, nung sản phẩm hoặc đóng gói mang về."
          >
            <label className="block text-sm font-semibold">
              Những gì buổi học bao gồm
              <textarea
                value={values.included}
                onChange={(event) => update('included', event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-lg border border-stone-300 p-3"
              />
            </label>
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
