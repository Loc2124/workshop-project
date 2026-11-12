import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  studioProvinces,
  createStudioRegistrationSchema,
  defaultSiteSettings,
} from '@workshop/shared';
import { LoadingState } from '../../components/ui/LoadingState';
import { Button } from '../../components/ui/button';
import { AuthLink } from '../../components/ui/auth-link';
import { PageBreadcrumb } from '../../components/layout/PageBreadcrumb';
import { PageContainer } from '../../components/layout/PageContainer';
import { useAuth } from '../../hooks/useAuth';
import { useCategoriesQuery } from '../../hooks/useCategories';
import { useCreateStudio, useMyStudios } from '../../hooks/useManagement';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { useStudioRegistrationDraft } from '../../hooks/useStudioRegistrationDraft';
import { authHref } from '../../lib/auth-navigation';
import { authFieldErrors } from '../../lib/auth-validation';
import { studioMissingFields } from '../../lib/studio-missing-fields';
import type { CreatedStudio } from '../../services/managementService';
import { RegistrationProgress } from '../../components/registration/RegistrationProgress';
import { RegistrationReceipt } from '../../components/registration/RegistrationReceipt';
import { RegistrationBasicFields } from '../../components/registration/RegistrationBasicFields';
import { RegistrationReviewSummary } from '../../components/registration/RegistrationReviewSummary';
import { RegistrationSidebar } from '../../components/registration/RegistrationSidebar';

function StudioRegistrationForm() {
  const settingsQuery = useSiteSettings();
  const { user, isLoading: authLoading, authError, retryAuth } = useAuth();
  const draft = useStudioRegistrationDraft(user?.id, authLoading);
  const categoryQuery = useCategoriesQuery();
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

  const missingFieldTargets: Record<string, string> = {
    'tên studio': 'studio-name',
    'loại workshop': 'studio-categoryIds',
    'tỉnh/thành': 'studio-provinceId',
    'địa chỉ': 'studio-address',
    SĐT: 'studio-contactPhone',
    email: 'studio-contactEmail',
    ảnh: 'studio-photoIds',
    'giới thiệu hợp lệ': 'studio-description',
    'liên kết Facebook hợp lệ': 'studio-facebookUrl',
    'liên kết Instagram hợp lệ': 'studio-instagramUrl',
    'liên kết Google Maps hợp lệ': 'studio-googleMapsUrl',
  };

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
      // The mutation reports server errors through the global toast.
    } finally {
      sending.current = false;
    }
  }

  const summaryItems: Array<[string, string]> = [
    ['Tên studio', values.name],
    ['Loại workshop', categoryName],
    ['Số điện thoại', values.contactPhone],
    ['Email', values.contactEmail],
    ['Ảnh thật của studio', `${values.photoIds.length} ảnh`],
    ['Facebook', values.facebookUrl || 'Chưa thêm'],
    ['Instagram', values.instagramUrl || 'Chưa thêm'],
    ['Google Maps', values.googleMapsUrl || 'Chưa thêm'],
    ...(values.categoryIds.includes('other')
      ? ([['Loại đề xuất (chờ duyệt)', values.proposedCategoryName]] as Array<[string, string]>)
      : []),
    ['Giới thiệu', values.description || 'Chưa thêm giới thiệu'],
    ['Tỉnh / thành phố', provinceName ?? values.provinceId],
    ['Địa chỉ', values.address],
  ];

  return (
    <main className="flex-1">
      <PageContainer className="py-6 md:py-10">
        <PageBreadcrumb
          items={[
            { label: 'Dành cho nghệ nhân', href: '/danh-cho-nghe-nhan' },
            { label: 'Đăng ký studio' },
          ]}
        />
        <div className="mx-auto mt-8 max-w-5xl">
          <RegistrationProgress
            currentStep={draft.step}
            hasReceipt={Boolean(receipt)}
          />

          {receipt ? (
            <RegistrationReceipt receipt={receipt} headingRef={heading} />
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
                  Bạn đã tham gia {memberStudios.data.length} studio. Đây là hồ
                  sơ đăng ký một studio mới.{' '}
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
                      <RegistrationBasicFields
                        values={values}
                        errors={errors}
                        onUpdate={update}
                        categories={categories}
                        isCategoryPending={categoryQuery.isPending}
                        categoryError={categoryQuery.error}
                        onRetryCategories={() => void categoryQuery.refetch()}
                        draft={draft}
                        onPhotosBusyChange={setPhotosBusy}
                        disabled={createStudio.isPending}
                      />
                    ) : (
                      <RegistrationReviewSummary
                        summaryItems={summaryItems}
                        onEdit={() => draft.setStep(0)}
                        disabled={createStudio.isPending}
                      />
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
                          <Button asChild className="min-h-11">
                            <AuthLink
                              to="/dang-nhap"
                              onClick={draft.prepareAuth}
                            >
                              Đăng nhập và tiếp tục
                            </AuthLink>
                          </Button>
                          <Button asChild variant="outline" className="min-h-11">
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

                    <div className="flex flex-wrap items-center gap-3">
                      {(draft.step === 0 || user) && (
                        <Button
                          type="submit"
                          className="min-h-11"
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
                      <Button asChild variant="ghost" className="min-h-11">
                        <Link to="/danh-cho-nghe-nhan">
                          {draft.step === 0
                            ? 'Quay lại giới thiệu'
                            : 'Tìm hiểu quy trình'}
                        </Link>
                      </Button>
                    </div>

                    {(missingFields.length > 0 ||
                      photosBusy ||
                      !catalogReady ||
                      Boolean(authError)) && (
                      <p
                        id="studio-missing-fields"
                        role="status"
                        className="text-sm leading-6 text-muted"
                      >
                        {missingFields.length > 0 ? (
                          <>
                            <span>Còn thiếu hoặc cần sửa:</span>
                            <ul className="mt-2 flex flex-wrap gap-2">
                              {missingFields.map((label) => (
                                <li key={label}>
                                  <button
                                    type="button"
                                    className="min-h-9 rounded-full border border-line bg-surface px-3 font-semibold text-primary underline"
                                    onClick={() => {
                                      draft.setStep(0);
                                      const parsed = formValidation;
                                      if (!parsed.success)
                                        setErrors(
                                          authFieldErrors(parsed.error),
                                        );
                                      requestAnimationFrame(() =>
                                        document
                                          .getElementById(
                                            missingFieldTargets[label],
                                          )
                                          ?.focus(),
                                      );
                                    }}
                                  >
                                    {label}
                                  </button>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2">
                              Nút “Xem lại hồ sơ” sẽ bật khi các mục bắt buộc
                              hợp lệ và ảnh không còn đang tải.
                            </p>
                          </>
                        ) : photosBusy ? (
                          'Đang tải ảnh, vui lòng chờ hoàn tất.'
                        ) : authError ? (
                          'Cần kết nối tài khoản ổn định để tiếp tục.'
                        ) : (
                          'Đang tải danh sách bộ môn hoặc yêu cầu hồ sơ; nút sẽ bật sau khi dữ liệu sẵn sàng.'
                        )}
                      </p>
                    )}
                  </form>

                  <RegistrationSidebar
                    storageAvailable={draft.storageAvailable}
                    userEmail={user?.email}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </main>
  );
}

export function StudioRegistrationPage() {
  const { user, isLoading, authError, retryAuth } = useAuth();
  if (isLoading)
    return (
      <main>
        <LoadingState label="Đang kiểm tra đăng nhập…" variant="page" />
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
export default StudioRegistrationPage;
