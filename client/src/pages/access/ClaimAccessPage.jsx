import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { accessApi } from '@/api/access';
import { toApiError } from '@/api/client';
import { Logo } from '@/components/common/Logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/store/AuthContext';

/**
 * The target of the emailed confirmation link. Clicking it IS the approval step:
 * it creates the account, the workspace, and the owner membership, then signs
 * the user in — same pattern as JoinPage, but no form to fill in.
 */
export default function ClaimAccessPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const { applySession } = useAuth();

  const [failure, setFailure] = useState(null);
  // The token is single-use, so a double-invoke (React 18 StrictMode remounts in
  // development) would burn it and show a spurious "already used" error.
  const claimed = useRef(false);

  useEffect(() => {
    if (!token || claimed.current) return;
    claimed.current = true;

    accessApi
      .claim(token)
      .then((session) => {
        applySession(session);
        toast.success('Your workspace is ready.');
        navigate('/app/dashboard', { replace: true });
      })
      .catch((error) => setFailure(toApiError(error).message));
  }, [token, applySession, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            {!token ? (
              <Alert variant="destructive" className="text-left">
                <AlertTitle>This link is incomplete</AlertTitle>
                <AlertDescription>
                  Your email app may have broken it across two lines. Copy the whole link, or
                  request a new one.
                </AlertDescription>
              </Alert>
            ) : failure ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <TriangleAlert className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight">Couldn&apos;t confirm access</h1>
                <p className="text-sm text-muted-foreground">{failure}</p>
                <Button asChild variant="outline" className="mt-2">
                  <Link to="/login">Go to sign in</Link>
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <h1 className="text-xl font-semibold tracking-tight">Setting up your workspace…</h1>
                <p className="text-sm text-muted-foreground">This only takes a moment.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
