import { MediaImage } from '../ui/MediaImage';
import { ArrowRight, Search } from 'lucide-react';
import type { useHomeCatalog } from '../../hooks/useHomeCatalog';
import { PageContainer } from '../layout/PageContainer';
import { ProvinceCombobox } from '../catalog/ProvinceCombobox';
import { SingleDatePicker } from '../ui/single-date-picker';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

type Props = Pick<
  ReturnType<typeof useHomeCatalog>,
  | 'provinceId'
  | 'provinces'
  | 'provinceError'
  | 'provincesLoading'
  | 'locationStatus'
  | 'changeProvince'
  | 'retryLocation'
  | 'date'
  | 'setDate'
  | 'query'
  | 'setQuery'
  | 'submitSearch'
  | 'searchError'
>;
const labelClass = 'grid min-w-0 gap-1.5 text-sm font-semibold md:gap-2';

export function HomeSearchHero(props: Props) {
  const {
    provinceId,
    provinces,
    provinceError,
    provincesLoading,
    locationStatus,
    changeProvince,
    retryLocation,
    date,
    setDate,
    query,
    setQuery,
    submitSearch,
    searchError,
  } = props;
  return (
    <PageContainer
      as="section"
      className="grid gap-4 pt-2 md:grid-cols-2"
      aria-labelledby="home-title"
    >
      <div className="home-invitation flex flex-col gap-5 rounded-2xl bg-soft px-5 py-5 md:gap-8 md:p-6 lg:p-9">
        <div className="motion-safe:animate-home-rise">
          <h1
            id="home-title"
            className="font-heading text-[clamp(2.125rem,4.2vw,4rem)] font-medium leading-[1.15] tracking-[-.055em]"
          >
            Dành một buổi
            <br />
            cho đôi tay.
          </h1>
          <p className="mt-4 max-w-[41ch] text-base leading-relaxed md:mt-8">
            Tìm workshop gần bạn, gặp nghệ nhân địa phương và tự tay làm nên
            điều của riêng mình.
          </p>
        </div>
        <form
          noValidate
          className="grid gap-3 md:gap-4"
          onSubmit={submitSearch}
        >
          <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-1 lg:grid-cols-2 lg:gap-4">
            <div>
              <label className={labelClass}>
                Tỉnh, thành phố
                <ProvinceCombobox
                  options={provinces}
                  value={provinceId}
                  onChange={changeProvince}
                  loading={provincesLoading}
                />
                {provinceError && <span role="status">{provinceError}</span>}
                {locationStatus && (
                  <span className="font-normal" role="status">
                    {locationStatus}
                  </span>
                )}
              </label>
              {!provinceId && provinces.length > 0 && (
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-sm"
                  onClick={retryLocation}
                  disabled={locationStatus.startsWith('Đang')}
                >
                  Dùng vị trí của tôi
                </Button>
              )}
            </div>
            <label className={labelClass}>
              Ngày trải nghiệm
              <SingleDatePicker value={date} onChange={setDate} />
            </label>
          </div>
          <label className={labelClass}>
            Bạn muốn thử điều gì?
            <span className="flex min-h-11 items-center gap-2 rounded-lg bg-surface pl-3 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
              <Search size={18} aria-hidden="true" />
              <Input
                className="min-w-0 flex-1 border-0 bg-transparent text-base font-normal shadow-none focus-visible:ring-0"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nặn gốm, làm nến, vẽ tranh…"
                type="search"
                maxLength={200}
              />
            </span>
          </label>
          {searchError && (
            <p role="alert" className="text-sm text-brick">
              {searchError}
            </p>
          )}
          <Button
            className="min-h-12 w-full justify-between text-base font-semibold"
            type="submit"
          >
            Tìm buổi trải nghiệm
            <ArrowRight size={20} aria-hidden="true" />
          </Button>
        </form>
      </div>
      <figure className="min-w-0 overflow-hidden rounded-2xl bg-beige">
        <MediaImage
          src="/images/workshops/stampPhoto.webp"
          alt="Bàn làm thủ công với kéo, bút chì và dụng cụ cắt giấy"
          width={900}
          height={1100}
          priority
          placeholder="Dụng cụ thủ công"
          loading="eager"
          imageClassName="object-center motion-safe:animate-home-photo-drift"
          className="h-40 w-full sm:h-56 md:h-full md:min-h-[570px]"
        />
      </figure>
    </PageContainer>
  );
}
