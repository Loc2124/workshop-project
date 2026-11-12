import { Check } from 'lucide-react';
import { studioProvinces } from '@workshop/shared';
import { getCategoryIcon } from '@/constants/categories';
import { AuthField } from '../ui/auth-field';
import { Button } from '../ui/button';
import { LoadingState } from '../ui/LoadingState';
import { StudioEvidenceFields } from '../management/StudioEvidenceFields';
import { imageService } from '@/services/imageService';
import type { useStudioRegistrationDraft } from '@/hooks/useStudioRegistrationDraft';

const selectClass =
  'min-h-12 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:border-[#DDD6C4] disabled:bg-[#E6E1D3] disabled:text-[#8A8375] disabled:opacity-100 aria-invalid:border-brick';

export interface RegistrationBasicFieldsProps {
  values: ReturnType<typeof useStudioRegistrationDraft>['values'];
  errors: Record<string, string>;
  onUpdate: <
    K extends keyof ReturnType<typeof useStudioRegistrationDraft>['values'],
  >(
    field: K,
    value: ReturnType<typeof useStudioRegistrationDraft>['values'][K],
  ) => void;
  categories: Array<{ id: string; name: string }>;
  isCategoryPending: boolean;
  categoryError: unknown;
  onRetryCategories: () => void;
  draft: ReturnType<typeof useStudioRegistrationDraft>;
  onPhotosBusyChange: (busy: boolean) => void;
  disabled: boolean;
}

export function RegistrationBasicFields({
  values,
  errors,
  onUpdate,
  categories,
  isCategoryPending,
  categoryError,
  onRetryCategories,
  draft,
  onPhotosBusyChange,
  disabled,
}: RegistrationBasicFieldsProps) {
  function fieldError(field: string) {
    return errors[field] ? (
      <p
        id={`studio-${field}-error`}
        role="alert"
        className="mt-2 text-sm text-brick"
      >
        {errors[field]}
      </p>
    ) : null;
  }

  return (
    <fieldset disabled={disabled} className="space-y-5">
      <section className="space-y-5 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-heading text-xl font-semibold">Cơ bản</h2>
        <AuthField
          id="studio-name"
          name="name"
          label="Tên studio"
          autoComplete="organization"
          required
          minLength={2}
          maxLength={120}
          value={values.name}
          error={errors.name}
          onChange={(event) => onUpdate('name', event.target.value)}
        />
        <div>
          <fieldset
            id="studio-categoryIds"
            tabIndex={-1}
            aria-describedby={
              errors.categoryIds ? 'studio-categoryIds-error' : undefined
            }
          >
            <legend className="mb-2 text-sm font-semibold">
              Các loại workshop của studio
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                    values.categoryIds.includes(category.id)
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-line bg-paper hover:border-primary/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={category.id}
                    checked={values.categoryIds.includes(category.id)}
                    onChange={(event) => {
                      const ids = event.target.checked
                        ? [...values.categoryIds, category.id]
                        : values.categoryIds.filter((id) => id !== category.id);
                      draft.update('categoryIds', ids);
                      if (!ids.includes('other'))
                        draft.update('proposedCategoryName', '');
                      onUpdate('categoryId', ids[0] ?? '');
                    }}
                    className="sr-only"
                  />
                  {(() => {
                    const Icon = getCategoryIcon(category.id);
                    return (
                      <Icon size={20} aria-hidden="true" className="shrink-0" />
                    );
                  })()}
                  <span className="flex-1 font-semibold">{category.name}</span>
                  {values.categoryIds.includes(category.id) && (
                    <Check size={18} aria-hidden="true" />
                  )}
                </label>
              ))}
            </div>
          </fieldset>
          {fieldError('categoryIds')}
          {Boolean(categoryError) && (
            <p role="alert" className="mt-2 text-sm text-brick">
              Chưa tải được loại workshop.{' '}
              <Button
                variant="outline"
                type="button"
                onClick={onRetryCategories}
              >
                Thử lại
              </Button>
            </p>
          )}
          {values.categoryIds.includes('other') && (
            <div className="mt-4">
              <AuthField
                id="studio-proposedCategoryName"
                name="proposedCategoryName"
                label="Loại workshop khác"
                required
                minLength={2}
                maxLength={80}
                value={values.proposedCategoryName}
                error={errors.proposedCategoryName}
                onChange={(event) =>
                  onUpdate('proposedCategoryName', event.target.value)
                }
                placeholder="Ví dụ: Thêu tay"
                hint="Nhập tên loại, không phải tên buổi trải nghiệm. Admin sẽ xét duyệt cùng hồ sơ studio trước khi thêm vào danh mục chung."
              />
            </div>
          )}
          <p className="mt-2 text-sm text-muted">
            Chọn một hoặc nhiều loại workshop. Chọn “Khác” nếu chưa có loại phù
            hợp.
          </p>
          {isCategoryPending && (
            <LoadingState
              label="Đang tải loại workshop…"
              className="mt-2 text-sm text-muted"
            />
          )}
        </div>
        <div>
          <label
            htmlFor="studio-description"
            className="mb-2 block text-sm font-semibold"
          >
            Giới thiệu studio{' '}
            <span className="font-normal text-muted">(không bắt buộc)</span>
          </label>
          <textarea
            id="studio-description"
            name="description"
            className={`${selectClass} min-h-32 py-3`}
            maxLength={2000}
            value={values.description}
            onChange={(event) => onUpdate('description', event.target.value)}
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={
              errors.description
                ? 'studio-description-hint studio-description-error'
                : 'studio-description-hint'
            }
            placeholder="Chia sẻ về nghề, không gian và trải nghiệm bạn muốn mang đến."
          />
          <p id="studio-description-hint" className="mt-2 text-sm text-muted">
            Tối đa 2000 ký tự.
          </p>
          {fieldError('description')}
        </div>
      </section>

      <section className="space-y-5 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-heading text-xl font-semibold">Địa điểm</h2>
        <div>
          <label
            htmlFor="studio-provinceId"
            className="mb-2 block text-sm font-semibold"
          >
            Tỉnh / thành phố
          </label>
          <select
            id="studio-provinceId"
            name="provinceId"
            required
            value={values.provinceId}
            onChange={(event) => onUpdate('provinceId', event.target.value)}
            className={selectClass}
            aria-invalid={Boolean(errors.provinceId) || undefined}
            aria-describedby={
              errors.provinceId ? 'studio-provinceId-error' : undefined
            }
          >
            <option value="">Chọn tỉnh / thành phố</option>
            {studioProvinces.map((province) => (
              <option value={province.id} key={province.id}>
                {province.name}
              </option>
            ))}
          </select>
          {fieldError('provinceId')}
        </div>
        <AuthField
          id="studio-address"
          name="address"
          label="Địa chỉ cụ thể"
          autoComplete="street-address"
          required
          maxLength={500}
          value={values.address}
          error={errors.address}
          hint="Số nhà, tên đường và phường/xã để khách tìm đến studio."
          onChange={(event) => onUpdate('address', event.target.value)}
        />
      </section>

      <StudioEvidenceFields
        values={values}
        errors={errors}
        onChange={(field, value) => {
          if (field === 'photoIds')
            onUpdate(field, Array.isArray(value) ? value : []);
          else onUpdate(field, typeof value === 'string' ? value : '');
        }}
        studioId={values.draftStudioId || undefined}
        ensureStudio={async () => {
          const id = await imageService.startDraft();
          draft.update('draftStudioId', id);
          return id;
        }}
        prepareAuth={draft.prepareAuth}
        onBusyChange={onPhotosBusyChange}
      />
    </fieldset>
  );
}
