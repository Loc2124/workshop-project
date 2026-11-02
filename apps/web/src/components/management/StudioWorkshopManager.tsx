import { useState, type FormEvent } from 'react';
import {
  categories as localCategories,
  DEFAULT_CATEGORY,
} from '../../constants/categories';
import { formatPrice } from '../../lib/format';
import { useSaveStudioWorkshop } from '../../hooks/useManagement';
import type { MemberStudio, StudioWorkshop } from '../../types/management';
import {
  studioWorkshopInputSchema,
  studioWorkshopUpdateInputSchema,
} from '../../types/management';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { requiredPriceFormSchema } from '../../lib/form-validation';
import { useCategories } from '../../hooks/useCategories';
import { proposedCategoryNameSchema } from '@workshop/shared';

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
  const remoteCategories = useCategories(true);
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
      // Mutation error is rendered below with the server message.
    }
  }

  return (
    <form
      noValidate
      className="space-y-5 border-y border-line bg-surface py-6"
      onSubmit={submit}
    >
      <div>
        <h3 className="font-heading text-xl font-semibold">
          {workshop ? 'Sửa workshop' : 'Tạo workshop'}
        </h3>
        <p className="mt-1 text-sm text-muted">
          Workshop mới và các thay đổi sau khi duyệt sẽ được gửi chờ xét duyệt.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold md:col-span-2">
          <span>Tên workshop</span>
          <Input
            maxLength={200}
            onChange={(event) => update('title', event.target.value)}
            required
            value={values.title}
          />
        </label>
        <label className="space-y-2 text-sm font-semibold md:col-span-2">
          <span>Mô tả</span>
          <textarea
            className="min-h-32 w-full rounded-lg border border-line bg-paper px-3 py-2 text-base font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            maxLength={10_000}
            onChange={(event) => update('description', event.target.value)}
            required
            value={values.description}
          />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Danh mục workshop</span>
          <select
            className="min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-base font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onChange={(event) => {
              update('categoryId', event.target.value);
              if (event.target.value !== 'other') setProposingCategory(false);
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
          <span className="block text-sm font-normal text-muted">
            Mỗi workshop có thể thuộc một danh mục khác nhau. Nếu chưa có danh
            mục phù hợp, chọn “Khác” và ghi rõ tên, nội dung workshop ở trên.
          </span>
        </label>
        {values.categoryId === 'other' && (
          <div className="space-y-3 text-sm md:col-span-2">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={proposingCategory}
                onChange={(event) => setProposingCategory(event.target.checked)}
              />
              <span>Đề xuất danh mục mới cho workshop này</span>
            </label>
            {proposingCategory && (
              <label className="block space-y-2 font-semibold">
                <span>Tên danh mục đề xuất</span>
                <Input
                  aria-invalid={Boolean(proposalError) || undefined}
                  aria-describedby={
                    proposalError ? 'category-proposal-error' : undefined
                  }
                  className={proposalError ? 'border-brick' : undefined}
                  value={values.proposedCategoryName}
                  maxLength={80}
                  onChange={(event) =>
                    update('proposedCategoryName', event.target.value)
                  }
                  placeholder="Ví dụ: Thêu tay"
                  required
                />
                {proposalError && (
                  <span
                    id="category-proposal-error"
                    role="alert"
                    className="block text-xs font-normal text-brick"
                  >
                    {proposalError}
                  </span>
                )}
                <span className="block font-normal text-muted">
                  Admin sẽ xét danh mục cùng workshop. Danh mục chỉ xuất hiện
                  công khai sau khi được duyệt.
                </span>
              </label>
            )}
          </div>
        )}
        <label className="space-y-2 text-sm font-semibold">
          <span>Cấp độ</span>
          <select
            className="min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-base font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onChange={(event) =>
              update('level', event.target.value as WorkshopValues['level'])
            }
            value={values.level}
          >
            <option value="beginner">Người mới</option>
            <option value="intermediate">Đã có kinh nghiệm</option>
            <option value="all">Mọi cấp độ</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Thời lượng (phút)</span>
          <Input
            min={1}
            onChange={(event) => update('durationMinutes', event.target.value)}
            required
            step={1}
            type="number"
            value={values.durationMinutes}
          />
        </label>
        {isOwner && (
          <label className="space-y-2 text-sm font-semibold">
            <span>Giá cơ sở (VND)</span>
            <Input
              min={0}
              onChange={(event) => update('basePrice', event.target.value)}
              required
              step={1}
              type="number"
              value={values.basePrice}
            />
          </label>
        )}
        {isOwner && (
          <label className="space-y-2 text-sm font-semibold md:col-span-2">
            <span>Mức cọc (%)</span>
            <Input
              type="number"
              min={0}
              max={30}
              step={1}
              required
              disabled={!canCollectDeposit}
              value={canCollectDeposit ? values.depositPercent : '0'}
              onChange={(event) => update('depositPercent', event.target.value)}
            />
            <p className="font-normal text-muted">
              {canCollectDeposit
                ? 'Chọn từ 0–30%, mặc định 20%. Chọn 0% để thanh toán toàn bộ tại studio.'
                : 'Chỉ studio bậc 2 với hồ sơ đầy đủ được nhận cọc. Hiện thanh toán toàn bộ tại studio.'}
            </p>
          </label>
        )}
        <label className="space-y-2 text-sm font-semibold md:col-span-2">
          <span>Phù hợp với (phân tách bằng dấu phẩy)</span>
          <Input
            maxLength={2000}
            onChange={(event) => update('audience', event.target.value)}
            placeholder="Người mới, nhóm bạn"
            value={values.audience}
          />
        </label>
        <label className="space-y-2 text-sm font-semibold md:col-span-2">
          <span>Sản phẩm mang về</span>
          <textarea
            className="min-h-20 w-full rounded-lg border border-line bg-paper px-3 py-2 text-base font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            maxLength={5000}
            onChange={(event) => update('takeaway', event.target.value)}
            value={values.takeaway}
          />
        </label>
        {[
          ['requirements', 'Cần chuẩn bị'],
          ['cancellationPolicy', 'Chính sách hủy'],
          ['paymentPolicy', 'Chính sách thanh toán'],
        ].map(([key, label]) => (
          <label
            className="space-y-2 text-sm font-semibold md:col-span-2"
            key={key}
          >
            <span>{label}</span>
            <textarea
              className="min-h-20 w-full rounded-lg border border-line bg-paper px-3 py-2 text-base font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              maxLength={5000}
              onChange={(event) =>
                update(key as keyof WorkshopValues, event.target.value)
              }
              value={values[key as keyof WorkshopValues]}
            />
          </label>
        ))}
      </div>
      {(validationError || saveWorkshop.error) && (
        <p className="text-sm text-brick" role="alert">
          {validationError ||
            saveWorkshop.error?.message ||
            'Không thể lưu workshop.'}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={saveWorkshop.isPending} type="submit">
          {saveWorkshop.isPending ? 'Đang lưu…' : 'Lưu workshop'}
        </Button>
        <Button
          disabled={saveWorkshop.isPending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}

const statusLabels = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Cần cập nhật',
} as const;

export function StudioWorkshopManager({
  studio,
  workshops,
  isLoading,
  error,
  onRetry,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StudioWorkshop>();

  return (
    <section aria-labelledby="studio-workshops-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className="font-heading text-2xl font-semibold md:text-3xl"
            id="studio-workshops-title"
          >
            Workshop
          </h2>
          <p className="mt-1 text-muted">
            Nội dung workshop và trạng thái xét duyệt.
          </p>
        </div>
        {studio.role === 'owner' && !creating && !editing && (
          <Button
            onClick={() => setCreating(true)}
            type="button"
            variant="outline"
          >
            Tạo workshop
          </Button>
        )}
        {!isLoading && !error && (
          <span className="text-sm text-muted">
            {workshops?.length ?? 0} workshop
          </span>
        )}
      </div>

      {creating && (
        <div className="mt-5">
          <StudioWorkshopEditor
            isOwner={studio.role === 'owner'}
            canCollectDeposit={studio.canCollectDeposit === true}
            key="new-workshop"
            onCancel={() => setCreating(false)}
            studioId={studio.id}
          />
        </div>
      )}
      {isLoading ? (
        <p aria-busy="true" className="py-8 text-muted" role="status">
          Đang tải workshop…
        </p>
      ) : error ? (
        <div className="mt-5 space-y-3">
          <p className="text-brick" role="alert">
            Không thể tải workshop: {error.message}
          </p>
          <Button onClick={onRetry} type="button" variant="outline">
            Tải lại workshop
          </Button>
        </div>
      ) : workshops?.length ? (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {workshops.map((workshop) => (
            <li className="py-5" key={workshop.id}>
              {editing?.id === workshop.id ? (
                <StudioWorkshopEditor
                  isOwner={studio.role === 'owner'}
                  canCollectDeposit={studio.canCollectDeposit === true}
                  key={workshop.id}
                  onCancel={() => setEditing(undefined)}
                  studioId={studio.id}
                  workshop={workshop}
                />
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-heading text-xl font-semibold">
                      {workshop.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {formatPrice(workshop.basePrice)}đ ·{' '}
                      {workshop.durationMinutes} phút
                    </p>
                    {workshop.proposedCategoryName && (
                      <p className="mt-1 text-sm text-muted">
                        Danh mục đề xuất: {workshop.proposedCategoryName} · Chưa
                        được duyệt
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="w-fit rounded-full bg-soft px-3 py-1 text-sm font-semibold"
                      aria-label={`Trạng thái workshop: ${statusLabels[workshop.status]}`}
                    >
                      {statusLabels[workshop.status]}
                    </span>
                    <Button
                      onClick={() => {
                        setCreating(false);
                        setEditing(workshop);
                      }}
                      type="button"
                      variant="outline"
                    >
                      Sửa
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 border-y border-line py-8 text-muted">
          Studio chưa có workshop. Workshop đã tạo sẽ xuất hiện tại đây.
        </p>
      )}
    </section>
  );
}
