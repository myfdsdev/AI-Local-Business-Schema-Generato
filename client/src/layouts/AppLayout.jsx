import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MapPin,
  Settings,
  Shield,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';

import { Logo } from '@/components/common/Logo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, initials } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';

// Primary navigation, now surfaced from the avatar menu instead of a sidebar.
const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/projects', label: 'Projects', icon: FolderKanban },
  { to: '/app/generate', label: 'Generate schema', icon: Sparkles },
  { to: '/app/locations', label: 'Locations', icon: MapPin },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

/**
 * Top-bar layout: a single header with the brand on the left and an account
 * menu on the right. All navigation lives inside the avatar dropdown, so the
 * content area spans the full width with no sidebar.
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isAdmin = user?.role === 'admin';
  const isActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <NavLink to="/app/dashboard" aria-label="LocalSchema AI home">
            <Logo />
          </NavLink>

          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {user?.scanCredits ?? 0} credits
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open menu"
                >
                  <Avatar>
                    <AvatarFallback>{initials(user?.name) || <UserIcon className="h-4 w-4" />}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="truncate text-sm font-medium">{user?.name}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Primary navigation */}
                {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={to}
                    onClick={() => navigate(to)}
                    className={cn(isActive(to) && 'bg-accent text-accent-foreground')}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </DropdownMenuItem>
                ))}

                {isAdmin && (
                  <DropdownMenuItem
                    onClick={() => navigate('/admin/dashboard')}
                    className={cn(isActive('/admin') && 'bg-accent text-accent-foreground')}
                  >
                    <Shield className="h-4 w-4" />
                    Admin
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/app/profile')}>
                  <UserIcon className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {!user?.emailVerified && <VerifyEmailBanner email={user?.email} />}
        <Outlet />
      </main>
    </div>
  );
}

function VerifyEmailBanner({ email }) {
  return (
    <div className="mb-6 flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
      <span className="font-medium">Verify your email address</span>
      <span className="text-warning-foreground/80">
        We sent a verification link to {email}. Verify it to create projects and run scans.
      </span>
    </div>
  );
}
