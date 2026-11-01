import { CategoryShortcuts } from '../components/catalog/CategoryShortcuts';
import { HomeSearchHero } from '../components/home/HomeSearchHero';
import { HomeWorkshopSection } from '../components/home/HomeWorkshopSection';
import { HomeProcessSection } from '../components/home/HomeProcessSection';
import { HomeArtisanSection } from '../components/home/HomeArtisanSection';
import { PageContainer } from '../components/layout/PageContainer';
import { SectionHeading } from '../components/layout/SectionHeading';
import { SiteHeader } from '../components/layout/SiteHeader';
import { SiteFooter } from '../components/layout/SiteFooter';
import { useHomeCatalog } from '../hooks/useHomeCatalog';
import { useCategoryCatalog } from '../hooks/useCategoryCatalog';

export function HomePage() {
  const home = useHomeCatalog();
  const { items: categoryWorkshops } = useCategoryCatalog();
  return (
    <div className="home-page min-h-screen bg-paper text-ink">
      <SiteHeader />
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
        <HomeProcessSection browseUrl={home.browseUrl} />
        <HomeArtisanSection />
      </main>
      <SiteFooter />
    </div>
  );
}
