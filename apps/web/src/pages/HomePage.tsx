import { CategoryShortcuts } from '../components/catalog/CategoryShortcuts';
import { HomeSearchHero } from '../components/home/HomeSearchHero';
import { HomeWorkshopSection } from '../components/home/HomeWorkshopSection';
import { HomeProcessSection } from '../components/home/HomeProcessSection';
import { HomeArtisanSection } from '../components/home/HomeArtisanSection';
import { PageContainer } from '../components/layout/PageContainer';
import { SectionHeading } from '../components/layout/SectionHeading';
import { useHomeCatalog } from '../hooks/useHomeCatalog';
import { useCategoryCatalog } from '../hooks/useCategoryCatalog';
import { HomeFeaturedStudios } from '../components/home/HomeFeaturedStudios';

export function HomePage() {
  const home = useHomeCatalog();
  const { items: categoryWorkshops } = useCategoryCatalog();
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
          <CategoryShortcuts variant="home" workshops={categoryWorkshops} />
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
