import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/AuthContext';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { patchUser, isAuthenticated } = useAuth();

  const [state, setState] = useState(token ? 'verifying' : 'missing');
  const [message, setMessage] = useState('');
  const ranFor = useRef(null);

  useEffect(() => {
    if (!token || ranFor.current === token) return;
    ranFor.current = token; // guard against StrictMode double-invoke

    authApi
      .verifyEmail(token)
      .then(() => {
        setState('success');
        if (isAuthenticated) patchUser({ emailVerified: true });
      })
      .catch((error) => {
        setState('error');
        setMessage(toApiError(error).message);
      });
  }, [token, isAuthenticated, patchUser]);

  return (
    <div className="text-center">
      {state === 'verifying' && (
        <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Verifying your email…</h1>
        </>
      )}

      {state === 'success' && (
        <>
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Email verified</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your email address is confirmed. You can now create projects and run scans.
          </p>
          <Button asChild className="mt-6">
            <Link to={isAuthenticated ? '/app/dashboard' : '/login'}>
              {isAuthenticated ? 'Go to dashboard' : 'Sign in'}
            </Link>
          </Button>
        </>
      )}

      {(state === 'error' || state === 'missing') && (
        <>
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Verification failed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {state === 'missing' ? 'This link is missing its verification token.' : message}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to={isAuthenticated ? '/app/dashboard' : '/login'}>Continue</Link>
          </Button>
        </>
      )}
    </div>
  );
}
