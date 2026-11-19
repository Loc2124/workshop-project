import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { PublicShell } from '../../components/layout/PublicShell';
import { lazy } from 'react';
import {
  renderPublicRoutes,
  LegacyPublicStudio,
  LegacyStudioRegistration,
} from './public.routes';
import { renderAuthRoutes } from './auth.routes';
import { renderStudioRoutes } from './studio.routes';
import { renderAdminRoutes } from './admin.routes';

const NotFoundPage = lazy(() =>
  import('../../pages/public/NotFoundPage').then((m) => ({
    default: m.NotFoundPage,
  })),
);

function LegacyStudioDetail() {
  const { studioId } = useParams();
  return (
    <Navigate to={`/studio/${encodeURIComponent(studioId ?? '')}`} replace />
  );
}

export function AppRouter() {
  return (
    <Routes>
      {/* 1. Public & Customer Routes */}
      {renderPublicRoutes()}

      {/* 2. Authentication Routes */}
      {renderAuthRoutes()}

      {/* 3. Studio Routes */}
      {renderStudioRoutes()}

      {/* 4. Admin Routes */}
      {renderAdminRoutes()}

      {/* 5. Legacy Redirections */}
      <Route path="/quan-ly" element={<Navigate to="/studio" replace />} />
      <Route path="/quan-ly/xuong/:studioId" element={<LegacyStudioDetail />} />
      <Route path="/quan-ly/tao-xuong" element={<LegacyStudioRegistration />} />
      <Route
        path="/quan-tri/duyet"
        element={<Navigate to="/admin/ho-so-studio" replace />}
      />
      <Route path="/xuong/:slug" element={<LegacyPublicStudio />} />

      {/* 6. Fallback Catch-all Route */}
      <Route element={<PublicShell />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
