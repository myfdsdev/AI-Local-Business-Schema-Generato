import { useNavigate } from 'react-router-dom';
import { LockKeyhole, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/store/AuthContext';

/**
 * Shown to a signed-in user whose account is not linked to any workspace.
 *
 * Deliberately does NOT link to the admin-access page — that URL is a secret,
 * and printing it here would hand workspace ownership to anyone who registers.
 */
export default function NoAccessPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LockKeyhole className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-xl font-semibold tracking-tight">No workspace yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account was created, but it isn&apos;t linked to a workspace — so there&apos;s
              nothing here to use yet.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            If you bought this app, check your email for your login details. If someone invited you
            to their workspace, open the invitation link they sent.
          </p>

          {user?.email && (
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.email}</span>
            </p>
          )}

          <Button variant="outline" onClick={handleLogout} className="mt-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
