import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { FullPageLoader } from '@/components/common/FullPageLoader';
import { useWorkspace } from '@/hooks/useWorkspace';
import NoAccessPage from '@/pages/auth/NoAccessPage';
import { useAuth } from '@/store/AuthContext';

/**
 * Gate for the authenticated app. While the boot-time silent refresh is in
 * flight we show a loader rather than bouncing to /login, so a signed-in user
 * reloading the page is not briefly kicked out.
 */
export function ProtectedRoute({ roles }) {
  const { status, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Role-gated section (e.g. /admin). Admins pass every gate.
  if (roles && user?.role !== 'admin' && !roles.includes(user?.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}

/**
 * Gate for everything that needs a workspace — i.e. the whole app shell.
 *
 * Signing up no longer grants a workspace, so "signed in" and "can use the app"
 * are now different things. Wraps ProtectedRoute's children rather than
 * redirecting, because there is nowhere useful to send them: the admin-access
 * URL is secret and must not be advertised.
 */
export function RequireWorkspace() {
  const { hasWorkspace, isLoading, isError } = useWorkspace();

  if (isLoading) return <FullPageLoader />;

  // Any failure to prove a workspace — 403 WORKSPACE_REQUIRED or otherwise —
  // blocks. Failing open here would render an app shell whose every request
  // 403s, which reads as "broken" rather than "not for you".
  if (isError || !hasWorkspace) return <NoAccessPage />;

  return <Outlet />;
}

/** Keeps signed-in users out of /login and /register. */
export function PublicOnlyRoute() {
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />;

  return <Outlet />;
}
