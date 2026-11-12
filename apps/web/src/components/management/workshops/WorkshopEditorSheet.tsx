import { useState, type FormEvent } from 'react';
import { proposedCategoryNameSchema } from '@workshop/shared';
import {
  categories as localCategories,
  DEFAULT_CATEGORY,
} from '@/constants/categories';
import { useCategories } from '@/hooks/useCategories';
import { useSaveStudioWorkshop } from '@/hooks/useManagement';
import { requiredPriceFormSchema } from '@/lib/core/form-validation';
import type { StudioWorkshop } from '@/types';
import {
  studioWorkshopInputSchema,
  studioWorkshopUpdateInputSchema,
} from '@/types';
import { SheetDescription, SheetTitle } from '../../ui/sheet';
import { StudioButton, StudioFormSection } from '../StudioPrimitives';
import { WorkshopBasicFields } from './WorkshopBasicFields';
import { WorkshopPricingFields } from './WorkshopPricingFields';
import { WorkshopDetailFields } from './WorkshopDetailFields';
import { WorkshopPolicyFields } from './WorkshopPolicyFields';

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
            <WorkshopBasicFields
              values={values}
              categories={categories}
              proposingCategory={proposingCategory}
              proposalError={proposalError}
              onUpdate={update}
              onToggleProposingCategory={setProposingCategory}
            />
          </StudioFormSection>

          <StudioFormSection
            title="Thời lượng và giá"
            description="Thiết lập thời gian trải nghiệm và cách thanh toán."
          >
            <WorkshopPricingFields
              values={values}
              isOwner={isOwner}
              canCollectDeposit={canCollectDeposit}
              onUpdate={update}
            />
          </StudioFormSection>

          <StudioFormSection
            title="Nội dung chi tiết"
            description="Cho khách biết họ sẽ trải nghiệm và mang về điều gì."
          >
            <WorkshopDetailFields values={values} onUpdate={update} />
          </StudioFormSection>

          <StudioFormSection
            title="Chính sách"
            description="Thông tin thanh toán và hủy để khách chủ động trước khi đặt chỗ."
          >
            <WorkshopPolicyFields
              values={values}
              hasExistingWorkshop={Boolean(workshop)}
              onUpdate={update}
            />
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
