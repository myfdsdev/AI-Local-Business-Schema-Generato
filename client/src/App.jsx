import { Route, Routes } from 'react-router-dom';

import { ComingSoon } from '@/components/common/ComingSoon';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { ProtectedRoute, PublicOnlyRoute, RequireWorkspace } from '@/routes/ProtectedRoute';
import JoinAdminPage from '@/pages/access/JoinAdminPage';
import ClaimAccessPage from '@/pages/access/ClaimAccessPage';
import LandingPage from '@/pages/marketing/LandingPage';
import PricingPage from '@/pages/marketing/PricingPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import JoinPage from '@/pages/auth/JoinPage';
import ActivatePage from '@/pages/auth/ActivatePage';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import ProjectsListPage from '@/pages/projects/ProjectsListPage';
import NewProjectPage from '@/pages/projects/NewProjectPage';
import ProjectDetailPage from '@/pages/projects/ProjectDetailPage';
import LocationsPage from '@/pages/locations/LocationsPage';
import BillingPage from '@/pages/billing/BillingPage';
import GenerateFromDocumentsPage from '@/pages/tools/GenerateFromDocumentsPage';
import KeywordResearchPage from '@/pages/tools/KeywordResearchPage';
import ContentGeneratorPage from '@/pages/tools/ContentGeneratorPage';
import ProfilePage from '@/pages/settings/ProfilePage';
import SettingsPage from '@/pages/settings/SettingsPage';
import TeamPage from '@/pages/settings/TeamPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      {/* Public marketing */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />

      {/* Workspace invite link + owner activation — public, work signed out */}
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="/activate" element={<ActivatePage />} />

      {/* Self-service workspace access. Deliberately not linked from anywhere in
          the app — set ADMIN_ACCESS_CODE to additionally require ?code=. */}
      <Route path="/join-admin" element={<JoinAdminPage />} />
      <Route path="/claim-access" element={<ClaimAccessPage />} />

      {/* Auth — redirect signed-in users away from login/register */}
      <Route element={<AuthLayout />}>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        {/* Reachable whether or not signed in: someone with a live session may
            still be following a reset link from their inbox. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Onboarding sits outside the app shell */}
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      {/* Authenticated app. RequireWorkspace sits INSIDE ProtectedRoute: signed
          in is no longer enough — an account with no workspace gets the
          no-access screen instead of a shell whose every request would 403. */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RequireWorkspace />}>
          <Route path="/app" element={<AppLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsListPage />} />
            <Route path="projects/new" element={<NewProjectPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="generate" element={<GenerateFromDocumentsPage />} />
            <Route path="keywords" element={<KeywordResearchPage />} />
            <Route path="content" element={<ContentGeneratorPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>
      </Route>

      {/* Admin */}
      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin" element={<AppLayout />}>
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route
            path="users"
            element={<ComingSoon title="Users" description="Manage platform users." />}
          />
          <Route
            path="schema-types"
            element={<ComingSoon title="Schema types" description="Manage supported business types." />}
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
