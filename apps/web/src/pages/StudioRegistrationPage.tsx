import {
  studioProvinces,
  createStudioRegistrationSchema,
  defaultSiteSettings,
} from '@workshop/shared';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { studioMissingFields } from '../lib/studio-missing-fields';
import { authHref } from '../lib/auth-navigation';
import { StudioEvidenceFields } from '../components/management/StudioEvidenceFields';
import { imageService } from '../services/imageService';
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Check } from 'lucide-react';
import { AuthLink } from '../components/ui/auth-link';
import { AuthField } from '../components/ui/auth-field';
import { Button } from '../components/ui/button';
import { PageBreadcrumb } from '../components/layout/PageBreadcrumb';
import { PageContainer } from '../components/layout/PageContainer';
import { useAuth } from '../hooks/useAuth';
import { useCategoriesQuery } from '../hooks/useCategories';
import { useCreateStudio, useMyStudios } from '../hooks/useManagement';
import { useStudioRegistrationDraft } from '../hooks/useStudioRegistrationDraft';
import { authFieldErrors } from '../lib/auth-validation';
import type { CreatedStudio } from '../services/managementService';

const selectClass =
  'min-h-12 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 aria-invalid:border-brick';

function StudioRegistrationForm() {
  const settingsQuery = useSiteSettings();
  const { user, isLoading: authLoading, authError, retryAuth } = useAuth();
  const draft = useStudioRegistrationDraft(user?.id, authLoading);
  const categoryQuery = useCategoriesQuery(true);
  const categories = (categoryQuery.data ?? []).filter(
    (category) =>
      category.isVisible !== false &&
      (category.status === 'active' || category.id === 'other'),
  );
  const memberStudios = useMyStudios();
  const createStudio = useCreateStudio();
  const [photosBusy, setPhotosBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<CreatedStudio>();
  const sending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const values = draft.values;
  const schema = createStudioRegistrationSchema(
    (settingsQuery.data ?? defaultSiteSettings).studio,
  )
    .strict()
    .refine(
      (input) =>
        (input.categoryIds?.length ?? 0) > 0 &&
        input.categoryIds!.every((id) =>
          categories.some((category) => category.id === id),
        ),
      {
        path: ['categoryIds'],
        message: 'Chọn ít nhất một loại workshop trong danh sách.',
      },
    )
    .refine(
      (input) =>
        studioProvinces.some((province) => province.id === input.provinceId),
      {
        path: ['provinceId'],
        message: 'Chọn tỉnh hoặc thành phố trong danh sách.',
      },
    );
  const categoryName = values.categoryIds
    .map((id) => categories.find((category) => category.id === id)?.name ?? id)
    .join(', ');
  const provinceName = studioProvinces.find(
    (province) => province.id === values.provinceId,
  )?.name;
  const catalogReady =
    settingsQuery.isSuccess && categoryQuery.isSuccess && categories.length > 0;
  function update<K extends keyof typeof values>(
    field: K,
    value: (typeof values)[K],
  ) {
    draft.update(field, value);
    setErrors((current) => ({ ...current, [field]: '' }));
    createStudio.reset();
  }
  const formValidation = schema.safeParse({
    ...values,
    facebookUrl: values.facebookUrl.trim() || null,
    instagramUrl: values.instagramUrl.trim() || null,
    googleMapsUrl: values.googleMapsUrl.trim() || null,
    proposedCategoryName: values.categoryIds.includes('other')
      ? values.proposedCategoryName.trim() || null
      : null,
    description: values.description.trim() || null,
  });
  const missingFields = formValidation.success
    ? []
    : studioMissingFields(formValidation.error.issues);
  function validate() {
    const parsed = formValidation;
    if (!parsed.success) {
      setErrors(authFieldErrors(parsed.error));
      draft.setStep(0);
      requestAnimationFrame(() =>
        document
          .getElementById(`studio-${String(parsed.error.issues[0]?.path[0])}`)
          ?.focus(),
      );
      return null;
    }
    setErrors({});
    return parsed.data;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      sending.current ||
      createStudio.isPending ||
      photosBusy ||
      !catalogReady
    )
      return;
    const input = validate();
    if (!input) return;
    if (draft.step === 0) {
      draft.setStep(1);
      requestAnimationFrame(() => heading.current?.focus());
      return;
    }
    if (!user || authError) return;
    sending.current = true;
    try {
      const created = await createStudio.mutateAsync(input);
      draft.clear();
      setReceipt(created);
      requestAnimationFrame(() => heading.current?.focus());
    } catch {
      /* The mutation's error is rendered below. The draft stays available. */
    } finally {
      sending.current = false;
    }
  }
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
  const steps = ['Thông tin studio', 'Kiểm tra và gửi', 'Hoàn tất'];
  return (
    <>
      <main className="flex-1">
        <PageContainer className="py-6 md:py-10">
          <PageBreadcrumb
            items={[
              { label: 'Dành cho nghệ nhân', href: '/danh-cho-nghe-nhan' },
              { label: 'Đăng ký studio' },
            ]}
          />
          <div className="mx-auto mt-8 max-w-5xl">
            <ol
              aria-label="Tiến trình đăng ký"
              className="mb-8 grid grid-cols-3 text-center text-sm"
            >
              {steps.map((label, index) => (
                <li
                  key={label}
                  aria-current={
                    (receipt ? 2 : draft.step) === index ? 'step' : undefined
                  }
                  className="relative flex min-w-0 flex-col items-center gap-2 px-1"
                >
                  {index < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-1/2 top-4 h-px w-full ${(receipt ? 2 : draft.step) > index ? 'bg-primary' : 'bg-line'}`}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={`relative z-10 flex size-8 items-center justify-center rounded-full border ${(receipt ? 2 : draft.step) >= index ? 'border-primary bg-primary font-bold text-white' : 'border-line bg-paper text-muted'}`}
                  >
                    {(receipt ? 2 : draft.step) > index ? (
                      <Check size={16} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={
                      (receipt ? 2 : draft.step) === index
                        ? 'font-bold text-ink'
                        : (receipt ? 2 : draft.step) > index
                          ? 'font-semibold text-primary'
                          : 'text-muted'
                    }
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>
            {receipt ? (
              <section
                className="max-w-2xl rounded-2xl bg-soft p-6 md:p-10"
                aria-labelledby="studio-application-title"
              >
                <CheckCircle2
                  size={32}
                  className="text-primary"
                  aria-hidden="true"
                />
                <h1
                  id="studio-application-title"
                  ref={heading}
                  tabIndex={-1}
                  className="mt-5 font-heading text-3xl font-semibold text-primary focus:outline-none"
                >
                  Hồ sơ đã được gửi
                </h1>
                <p className="mt-4 text-lg">
                  <strong>{receipt.name}</strong> đang chờ Open Slot xét duyệt.
                </p>
                <p className="mt-3 leading-7 text-muted">
                  Bạn đã được ghi nhận là chủ studio. Theo dõi trạng thái hồ sơ
                  trong mục Quản lý studio; studio sẽ xuất hiện công khai sau
                  khi được duyệt.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link to={`/studio/studios/${receipt.id}`}>
                      Xem hồ sơ studio
                      <ArrowRight size={17} />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/studio">Danh sách studio</Link>
                  </Button>
                </div>
              </section>
            ) : (
              <>
                <h1
                  ref={heading}
                  tabIndex={-1}
                  className="font-heading text-3xl font-semibold text-primary focus:outline-none md:text-4xl"
                >
                  {draft.step === 0
                    ? 'Giới thiệu studio của bạn'
                    : 'Kiểm tra hồ sơ studio'}
                </h1>
                <p className="mt-3 max-w-2xl leading-7 text-muted">
                  {draft.step === 0
                    ? 'Cho Open Slot biết bạn làm nghề gì và đón khách ở đâu. Bạn có thể xem lại toàn bộ hồ sơ trước khi gửi.'
                    : 'Kiểm tra thông tin bên dưới. Hồ sơ được gửi ở trạng thái chờ duyệt, chưa hiển thị công khai.'}
                </p>
                {user && memberStudios.data?.length ? (
                  <p className="mt-4 text-sm text-muted">
                    Bạn đã tham gia {memberStudios.data.length} studio. Đây là
                    hồ sơ đăng ký một studio mới.{' '}
                    <Link
                      to="/studio"
                      className="font-semibold text-primary underline"
                    >
                      Xem studio hiện có
                    </Link>
                  </p>
                ) : null}
                {authLoading || !draft.ready ? (
                  <p
                    role="status"
                    aria-busy="true"
                    className="py-10 text-muted"
                  >
                    Đang chuẩn bị hồ sơ…
                  </p>
                ) : (
                  <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
                    <form
                      noValidate
                      onSubmit={submit}
                      aria-busy={createStudio.isPending}
                      className="min-w-0 space-y-6"
                    >
                      {settingsQuery.isError && (
                        <div
                          role="alert"
                          className="space-y-2 text-sm text-brick"
                        >
                          <p>Chưa tải được yêu cầu hồ sơ studio.</p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void settingsQuery.refetch()}
                          >
                            Thử lại
                          </Button>
                        </div>
                      )}
                      {draft.step === 0 ? (
                        <fieldset
                          disabled={createStudio.isPending}
                          className="space-y-5"
                        >
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
                            onChange={(event) =>
                              update('name', event.target.value)
                            }
                          />
                          <div>
                            <fieldset
                              id="studio-categoryIds"
                              tabIndex={-1}
                              aria-describedby={
                                errors.categoryIds
                                  ? 'studio-categoryIds-error'
                                  : undefined
                              }
                            >
                              <legend className="mb-2 text-sm font-semibold">
                                Các loại workshop của studio
                              </legend>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {categories.map((category) => (
                                  <label
                                    key={category.id}
                                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 text-base"
                                  >
                                    <input
                                      type="checkbox"
                                      name="categoryIds"
                                      value={category.id}
                                      checked={values.categoryIds.includes(
                                        category.id,
                                      )}
                                      onChange={(event) => {
                                        const ids = event.target.checked
                                          ? [...values.categoryIds, category.id]
                                          : values.categoryIds.filter(
                                              (id) => id !== category.id,
                                            );
                                        draft.update('categoryIds', ids);
                                        if (!ids.includes('other'))
                                          draft.update(
                                            'proposedCategoryName',
                                            '',
                                          );
                                        update('categoryId', ids[0] ?? '');
                                        setErrors((current) => ({
                                          ...current,
                                          categoryIds: '',
                                        }));
                                      }}
                                      className="h-5 w-5 accent-primary"
                                    />
                                    {category.name}
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                            {fieldError('categoryIds')}
                            {categoryQuery.error && (
                              <p
                                role="alert"
                                className="mt-2 text-sm text-brick"
                              >
                                Chưa tải được loại workshop.{' '}
                                <Button
                                  variant="outline"
                                  type="button"
                                  onClick={() => void categoryQuery.refetch()}
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
                                    update(
                                      'proposedCategoryName',
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ví dụ: Thêu tay"
                                  hint="Nhập tên loại, không phải tên buổi trải nghiệm. Admin sẽ xét duyệt cùng hồ sơ studio trước khi thêm vào danh mục chung."
                                />
                              </div>
                            )}
                            <p className="mt-2 text-sm text-muted">
                              Chọn một hoặc nhiều loại workshop. Chọn “Khác” nếu
                              chưa có loại phù hợp.
                            </p>
                            {categoryQuery.isPending && (
                              <p
                                role="status"
                                className="mt-2 text-sm text-muted"
                              >
                                Đang tải loại workshop…
                              </p>
                            )}
                          </div>
                          <div>
                            <label
                              htmlFor="studio-description"
                              className="mb-2 block text-sm font-semibold"
                            >
                              Giới thiệu studio{' '}
                              <span className="font-normal text-muted">
                                (không bắt buộc)
                              </span>
                            </label>
                            <textarea
                              id="studio-description"
                              name="description"
                              className={`${selectClass} min-h-32 py-3`}
                              maxLength={2000}
                              value={values.description}
                              onChange={(event) =>
                                update('description', event.target.value)
                              }
                              aria-invalid={
                                Boolean(errors.description) || undefined
                              }
                              aria-describedby={
                                errors.description
                                  ? 'studio-description-hint studio-description-error'
                                  : 'studio-description-hint'
                              }
                              placeholder="Chia sẻ về nghề, không gian và trải nghiệm bạn muốn mang đến."
                            />
                            <p
                              id="studio-description-hint"
                              className="mt-2 text-sm text-muted"
                            >
                              Tối đa 2000 ký tự.
                            </p>
                            {fieldError('description')}
                          </div>
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
                              onChange={(event) =>
                                update('provinceId', event.target.value)
                              }
                              className={selectClass}
                              aria-invalid={
                                Boolean(errors.provinceId) || undefined
                              }
                              aria-describedby={
                                errors.provinceId
                                  ? 'studio-provinceId-error'
                                  : undefined
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
                            onChange={(event) =>
                              update('address', event.target.value)
                            }
                          />
                          <StudioEvidenceFields
                            values={values}
                            errors={errors}
                            onChange={(field, value) => {
                              if (field === 'photoIds')
                                update(
                                  field,
                                  Array.isArray(value) ? value : [],
                                );
                              else
                                update(
                                  field,
                                  typeof value === 'string' ? value : '',
                                );
                            }}
                            studioId={values.draftStudioId || undefined}
                            ensureStudio={async () => {
                              const id = await imageService.startDraft();
                              draft.update('draftStudioId', id);
                              return id;
                            }}
                            prepareAuth={draft.prepareAuth}
                            onBusyChange={setPhotosBusy}
                          />
                        </fieldset>
                      ) : (
                        <section
                          className="rounded-xl bg-surface p-5 md:p-6"
                          aria-label="Thông tin hồ sơ"
                        >
                          <dl className="space-y-5 break-words">
                            {[
                              ['Tên studio', values.name],
                              ['Loại workshop', categoryName],
                              ['Số điện thoại', values.contactPhone],
                              ['Email', values.contactEmail],
                              [
                                'Ảnh thật của studio',
                                `${values.photoIds.length} ảnh`,
                              ],
                              ['Facebook', values.facebookUrl || 'Chưa thêm'],
                              ['Instagram', values.instagramUrl || 'Chưa thêm'],
                              [
                                'Google Maps',
                                values.googleMapsUrl || 'Chưa thêm',
                              ],
                              ...(values.categoryIds.includes('other')
                                ? [
                                    [
                                      'Loại đề xuất (chờ duyệt)',
                                      values.proposedCategoryName,
                                    ],
                                  ]
                                : []),
                              [
                                'Giới thiệu',
                                values.description || 'Chưa thêm giới thiệu',
                              ],
                              [
                                'Tỉnh / thành phố',
                                provinceName ?? values.provinceId,
                              ],
                              ['Địa chỉ', values.address],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <dt className="text-sm text-muted">{label}</dt>
                                <dd className="mt-1 whitespace-pre-wrap font-medium">
                                  {value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-6"
                            disabled={createStudio.isPending}
                            onClick={() => draft.setStep(0)}
                          >
                            <ArrowLeft size={16} />
                            Chỉnh sửa thông tin
                          </Button>
                        </section>
                      )}
                      {authError ? (
                        <div role="alert" className="rounded-lg bg-soft p-4">
                          <p className="text-sm text-brick">
                            Chưa thể kiểm tra tài khoản: {authError.message}
                          </p>
                          <Button
                            type="button"
                            variant="link"
                            className="mt-2 px-0"
                            onClick={() => void retryAuth()}
                          >
                            Kiểm tra lại
                          </Button>
                        </div>
                      ) : draft.step === 1 && !user ? (
                        <div className="rounded-xl bg-soft p-5">
                          <h2 className="font-heading text-xl font-semibold">
                            Đăng nhập để gửi hồ sơ
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-muted">
                            {draft.storageAvailable
                              ? 'Hồ sơ nháp được giữ lại khi bạn đăng nhập hoặc tạo tài khoản.'
                              : 'Trình duyệt đang chặn lưu bản nháp. Hãy sao chép thông tin trước khi chuyển sang đăng nhập.'}{' '}
                            Tài khoản này sẽ trở thành chủ studio.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <Button asChild>
                              <AuthLink
                                to="/dang-nhap"
                                onClick={draft.prepareAuth}
                              >
                                Đăng nhập và tiếp tục
                              </AuthLink>
                            </Button>
                            <Button asChild variant="outline">
                              <AuthLink
                                to="/dang-ky"
                                onClick={draft.prepareAuth}
                              >
                                Tạo tài khoản
                              </AuthLink>
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {createStudio.error && (
                        <div
                          role="alert"
                          className="rounded-lg bg-soft p-4 text-sm text-brick"
                        >
                          {createStudio.error.message} Hồ sơ nháp vẫn được giữ
                          lại để bạn thử lại.
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        {(draft.step === 0 || user) && (
                          <Button
                            type="submit"
                            aria-describedby={
                              missingFields.length || photosBusy
                                ? 'studio-missing-fields'
                                : undefined
                            }
                            disabled={
                              createStudio.isPending ||
                              photosBusy ||
                              !formValidation.success ||
                              !catalogReady ||
                              Boolean(authError)
                            }
                          >
                            {createStudio.isPending
                              ? 'Đang gửi hồ sơ…'
                              : draft.step === 0
                                ? 'Xem lại hồ sơ'
                                : 'Gửi hồ sơ xét duyệt'}
                            <ArrowRight size={17} />
                          </Button>
                        )}
                        <Button asChild variant="ghost">
                          <Link to="/danh-cho-nghe-nhan">
                            {draft.step === 0
                              ? 'Quay lại giới thiệu'
                              : 'Tìm hiểu quy trình'}
                          </Link>
                        </Button>
                      </div>
                      {(missingFields.length > 0 || photosBusy) && (
                        <p
                          id="studio-missing-fields"
                          role="status"
                          className="text-sm leading-6 text-muted"
                        >
                          {missingFields.length > 0
                            ? `Còn thiếu: ${missingFields.join(', ')}.`
                            : 'Đang tải ảnh, vui lòng chờ hoàn tất.'}
                        </p>
                      )}
                    </form>
                    <aside className="rounded-xl bg-soft p-5 md:p-6">
                      <h2 className="font-heading text-xl font-semibold">
                        Sau khi gửi hồ sơ
                      </h2>
                      <ul className="mt-4 space-y-4 text-sm leading-6">
                        <li>
                          Open Slot xem xét thông tin nghề và địa điểm của
                          studio.
                        </li>
                        <li>
                          Bạn theo dõi trạng thái trong mục Quản lý studio.
                        </li>
                        <li>
                          Sau khi được duyệt, bạn có thể chia sẻ trang studio
                          công khai.
                        </li>
                      </ul>
                      <p className="mt-5 text-sm text-muted">
                        {draft.storageAvailable
                          ? 'Bản nháp được giữ trong phiên trình duyệt này.'
                          : 'Trình duyệt đang chặn lưu bản nháp; thông tin sẽ mất khi bạn rời trang.'}{' '}
                        Chỉ bấm gửi mới chuyển hồ sơ đến bước xét duyệt.
                      </p>
                      {user && (
                        <p className="mt-4 break-all text-sm">
                          Tài khoản chủ studio:
                          <br />
                          <strong>{user.email}</strong>
                        </p>
                      )}
                    </aside>
                  </div>
                )}
              </>
            )}
          </div>
        </PageContainer>
      </main>
    </>
  );
}

export function StudioRegistrationPage() {
  const { user, isLoading, authError, retryAuth } = useAuth();
  if (isLoading)
    return (
      <main className="p-8" role="status">
        Đang kiểm tra đăng nhập…
      </main>
    );
  if (authError)
    return (
      <main className="p-8">
        <p role="alert">{authError.message}</p>
        <Button onClick={() => void retryAuth()}>Thử lại</Button>
      </main>
    );
  if (!user)
    return <Navigate to={authHref('/dang-nhap', '/dang-ky-studio')} replace />;
  return <StudioRegistrationForm />;
}
