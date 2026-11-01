import { Route, Routes } from 'react-router-dom';
import { useCategories } from './hooks/useCategories';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { ArtisanPage } from './pages/ArtisanPage';
import { AboutPage } from './pages/AboutPage';
import { StudioPage } from './pages/StudioPage';
import { WorkshopPage } from './pages/WorkshopPage';
import { TicketDemoPage } from './pages/TicketDemoPage';

function App() {
  useCategories();
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/kham-pha" element={<ExplorePage />} />
      <Route path="/demo/ve" element={<TicketDemoPage />} />
      <Route path="/danh-cho-nghe-nhan" element={<ArtisanPage />} />
      <Route path="/ve-open-slot" element={<AboutPage />} />
      <Route path="/xuong/:slug" element={<StudioPage />} />
      <Route path="/studios/:id" element={<StudioPage />} />
      <Route path="/workshop/:slug" element={<WorkshopPage />} />
      <Route path="/workshops/:id" element={<WorkshopPage />} />
      <Route
        path="*"
        element={
          <main className="mx-auto max-w-3xl px-6 py-20 text-center text-lg text-muted">
            Không tìm thấy trang.
          </main>
        }
      />
    </Routes>
  );
}

export default App;
