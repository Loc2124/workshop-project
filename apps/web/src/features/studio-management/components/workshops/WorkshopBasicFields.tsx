import { StudioField } from '../StudioPrimitives';
import type { Category } from '@/constants/categories';
import type { WorkshopValues } from './WorkshopEditorSheet';

interface WorkshopBasicFieldsProps {
  values: WorkshopValues;
  categories: Category[];
  proposingCategory: boolean;
  proposalError: string;
  onUpdate: <K extends keyof WorkshopValues>(
    key: K,
    value: WorkshopValues[K],
  ) => void;
  onToggleProposingCategory: (enabled: boolean) => void;
}

export function WorkshopBasicFields({
  values,
  categories,
  proposingCategory,
  proposalError,
  onUpdate,
  onToggleProposingCategory,
}: WorkshopBasicFieldsProps) {
  return (
    <div className="grid gap-studio-group sm:grid-cols-2">
      <StudioField
        className="sm:col-span-2"
        label="Tên workshop"
        maxLength={200}
        onChange={(event) => onUpdate('title', event.target.value)}
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
          onChange={(event) => onUpdate('description', event.target.value)}
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
            onUpdate('categoryId', event.target.value);
            if (event.target.value !== 'other')
              onToggleProposingCategory(false);
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
          Mỗi workshop có thể thuộc một danh mục khác nhau. Nếu chưa có danh mục
          phù hợp, chọn “Khác” và ghi rõ tên, nội dung workshop ở trên.
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
            onUpdate('level', event.target.value as WorkshopValues['level'])
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
                onToggleProposingCategory(event.target.checked)
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
                onUpdate('proposedCategoryName', event.target.value)
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
        onChange={(event) => onUpdate('audience', event.target.value)}
        placeholder="Người mới, nhóm bạn"
        value={values.audience}
      />
    </div>
  );
}
