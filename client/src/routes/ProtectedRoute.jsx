import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { FullPageLoader } from '@/components/common/FullPageLoader';
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

/** Keeps signed-in users out of /login and /register. */
export function PublicOnlyRoute() {
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />;

  return <Outlet />;
}
