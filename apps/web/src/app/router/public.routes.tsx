import { lazy } from 'react';
import { Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { PublicShell } from '../../components/layout/PublicShell';
import { renderCustomerRoutes } from './customer.routes';

const HomePage = lazy(() =>
  import('../../pages/public/HomePage').then((m) => ({ default: m.HomePage })),
);
const ExplorePage = lazy(() =>
  import('../../pages/public/ExplorePage').then((m) => ({ default: m.ExplorePage })),
);
const ArtisanPage = lazy(() =>
  import('../../pages/public/ArtisanPage').then((m) => ({ default: m.ArtisanPage })),
);
const AboutPage = lazy(() =>
  import('../../pages/public/AboutPage').then((m) => ({ default: m.AboutPage })),
);
const StudioPage = lazy(() =>
  import('../../pages/studio/StudioPage').then((m) => ({ default: m.StudioPage })),
);
const WorkshopPage = lazy(() =>
  import('../../pages/public/WorkshopPage').then((m) => ({ default: m.WorkshopPage })),
);
const StudioRegistrationPage = lazy(() =>
  import('../../pages/studio/StudioRegistrationPage').then((m) => ({
    default: m.StudioRegistrationPage,
  })),
);
const NotFoundPage = lazy(() =>
  import('../../pages/public/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const ForbiddenPage = lazy(() =>
  import('../../pages/public/ForbiddenPage').then((m) => ({ default: m.ForbiddenPage })),
);
const FaqPage = lazy(() =>
  import('../../pages/public/FaqPage').then((m) => ({ default: m.FaqPage })),
);
const ContactPage = lazy(() =>
  import('../../pages/public/ContactPage').then((m) => ({ default: m.ContactPage })),
);
const AcceptInvitationPage = lazy(() =>
  import('../../pages/auth/AcceptInvitationPage').then((m) => ({
    default: m.AcceptInvitationPage,
  })),
);
const UserAccountPage = lazy(() =>
  import('../../pages/customer/UserAccountPage').then((m) => ({
    default: m.UserAccountPage,
  })),
);

export function LegacyPublicStudio() {
  const { slug = '' } = useParams();
  const { search, hash } = useLocation();
  return (
    <Navigate
      to={`/studios/${encodeURIComponent(slug)}${search}${hash.replace('workshop-tai-xuong', 'workshop-tai-studio')}`}
      replace
    />
  );
}

export function LegacyStudioRegistration() {
  const { search, hash } = useLocation();
  return <Navigate to={`/dang-ky-studio${search}${hash}`} replace />;
}

export function renderPublicRoutes() {
  return (
    <Route key="public-shell" element={<PublicShell />}>
      <Route
        path="/check-in"
        element={<Navigate to="/studio/check-in" replace />}
      />
      <Route path="/" element={<HomePage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/kham-pha" element={<ExplorePage />} />
      <Route path="/dang-ky-studio" element={<StudioRegistrationPage />} />
      <Route path="/danh-cho-nghe-nhan" element={<ArtisanPage />} />
      <Route path="/ve-open-slot" element={<AboutPage />} />
      <Route path="/tro-giup" element={<FaqPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/lien-he" element={<ContactPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/tham-gia-studio" element={<AcceptInvitationPage />} />
      <Route path="/tai-khoan" element={<UserAccountPage />} />
      <Route
        path="/me/account"
        element={<Navigate to="/tai-khoan" replace />}
      />
      <Route
        path="/me/profile"
        element={<Navigate to="/tai-khoan" replace />}
      />
      <Route path="/khong-co-quyen" element={<ForbiddenPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/studios/:slug" element={<StudioPage />} />
      <Route path="/workshop/:slug" element={<WorkshopPage />} />
      <Route path="/workshops/:id" element={<WorkshopPage />} />

      {/* Customer protected routes rendered inside PublicShell */}
      {renderCustomerRoutes()}
    </Route>
  );
}
