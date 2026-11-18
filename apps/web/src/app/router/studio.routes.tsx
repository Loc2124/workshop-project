import { Route, Navigate, useParams } from 'react-router-dom';
import { RequireRole } from '../../components/auth/RequireRole';
import {
  StudioOverviewPage,
  StudioWorkspacePage,
  StudioCheckInPage,
  StudioDashboard,
} from '../../lib/dashboard-routes';

function LegacyStudioDetail() {
  const { studioId } = useParams();
  return (
    <Navigate to={`/studio/${encodeURIComponent(studioId ?? '')}`} replace />
  );
}

export function renderStudioRoutes() {
  return (
    <Route key="studio-root" element={<RequireRole role="studio_member" />}>
      <Route path="/studio" element={<StudioDashboard />} />
      <Route
        path="/studio/studios/:studioId"
        element={<LegacyStudioDetail />}
      />
      {[
        'workshops',
        'sessions',
        'bookings',
        'finances',
        'check-in',
        'members',
        'profile',
      ].map((section) => (
        <Route
          key={section}
          path={`/studio/${section}`}
          element={<StudioDashboard />}
        />
      ))}
      <Route path="/studio/:studioId" element={<StudioDashboard />}>
        <Route index element={<StudioOverviewPage />} />
        <Route
          path="workshops"
          element={<StudioWorkspacePage section="workshops" />}
        />
        <Route
          path="sessions"
          element={<StudioWorkspacePage section="sessions" />}
        />
        <Route
          path="bookings"
          element={<StudioWorkspacePage section="bookings" />}
        />
        <Route
          path="finances"
          element={<StudioWorkspacePage section="finances" />}
        />
        <Route path="check-in" element={<StudioCheckInPage />} />
        <Route
          path="reviews"
          element={<StudioWorkspacePage section="reviews" />}
        />
        <Route
          path="members"
          element={<StudioWorkspacePage section="members" />}
        />
        <Route
          path="profile"
          element={<StudioWorkspacePage section="profile" />}
        />
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Route>
    </Route>
  );
}
