import { Route, Routes } from 'react-router-dom';

import { ComingSoon } from '@/components/common/ComingSoon';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { ProtectedRoute, PublicOnlyRoute } from '@/routes/ProtectedRoute';

import LandingPage from '@/pages/marketing/LandingPage';
import PricingPage from '@/pages/marketing/PricingPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import ProjectsListPage from '@/pages/projects/ProjectsListPage';
import NewProjectPage from '@/pages/projects/NewProjectPage';
import ProjectDetailPage from '@/pages/projects/ProjectDetailPage';
import GenerateFromDocumentsPage from '@/pages/tools/GenerateFromDocumentsPage';
import KeywordResearchPage from '@/pages/tools/KeywordResearchPage';
import ContentGeneratorPage from '@/pages/tools/ContentGeneratorPage';
import ProfilePage from '@/pages/settings/ProfilePage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      {/* Public marketing */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />

      {/* Auth — redirect signed-in users away from login/register */}
      <Route element={<AuthLayout />}>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        {/* Reachable whether or not signed in */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Onboarding sits outside the app shell */}
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      {/* Authenticated app */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsListPage />} />
          <Route path="projects/new" element={<NewProjectPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="generate" element={<GenerateFromDocumentsPage />} />
          <Route path="keywords" element={<KeywordResearchPage />} />
          <Route path="content" element={<ContentGeneratorPage />} />
          <Route
            path="locations"
            element={
              <ComingSoon
                title="Locations"
                description="Manage physical business locations across your projects."
                note="Multi-location management arrives with the location engine. Projects already record whether they are single- or multi-location."
              />
            }
          />
          <Route
            path="billing"
            element={
              <ComingSoon
                title="Billing"
                description="Manage your plan and scan credits."
                note="Billing integrates in a later phase. Your plan and remaining credits are already tracked."
              />
            }
          />
          <Route
            path="settings"
            element={
              <ComingSoon
                title="Settings"
                description="Workspace and notification preferences."
                note="Account details and password are available on your Profile page."
              />
            }
          />
          <Route path="profile" element={<ProfilePage />} />
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
