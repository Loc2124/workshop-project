import { LoadingState } from '../components/ui/LoadingState';
import { CategoryShortcuts } from '../components/catalog/CategoryShortcuts';
import { HomeArtisanSection } from '../components/home/HomeArtisanSection';
import { HomeFeaturedStudios } from '../components/home/HomeFeaturedStudios';
import { HomeProcessSection } from '../components/home/HomeProcessSection';
import { HomeSearchHero } from '../components/home/HomeSearchHero';
import { HomeWorkshopSection } from '../components/home/HomeWorkshopSection';
import { PageContainer } from '../components/layout/PageContainer';
import { SectionHeading } from '../components/layout/SectionHeading';
import { Button } from '../components/ui/button';
import { useCategoriesQuery } from '../hooks/useCategories';
import { useHomeCatalog } from '../hooks/useHomeCatalog';
export function HomePage() {
  const home = useHomeCatalog();
  const categoryQuery = useCategoriesQuery();
  const categoryOptions = categoryQuery.data ?? [];
  return (
    <>
      {home.preview && (
        <div
          className="border-b border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-900"
          role="status"
        >
          {home.previewError ??
            'Đang xem trước nội dung nổi bật chưa lưu. Trang chủ công khai chưa thay đổi.'}
        </div>
      )}
      <main>
        <HomeSearchHero {...home} />
        <PageContainer
          as="section"
          aria-labelledby="materials-title"
          className="py-10 md:py-24"
        >
          <SectionHeading id="materials-title" title="Hôm nay, bạn muốn thử?" />
          {categoryQuery.isPending && true ? (
            <LoadingState
              label="Đang tải danh mục…"
              className="py-3 text-sm text-muted"
            />
          ) : categoryQuery.isError && true ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted" role="alert">
                Chưa tải được danh mục.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void categoryQuery.refetch()}
              >
                Thử lại
              </Button>
            </div>
          ) : (
            <CategoryShortcuts
              variant="home"
              workshops={[]}
              categoryOptions={categoryOptions}
            />
          )}
        </PageContainer>
        <HomeWorkshopSection {...home} />
        <HomeFeaturedStudios
          studios={home.featuredStudios}
          loading={home.loading}
          error={home.error}
          refetch={home.refetch}
        />
        <HomeProcessSection browseUrl={home.browseUrl} />
        <HomeArtisanSection />
      </main>
    </>
  );
}
