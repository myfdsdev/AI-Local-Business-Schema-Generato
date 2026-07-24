import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Public signup is closed. Accounts exist only two ways: the AppsFields hub
 * creates the owner when someone buys, or a workspace owner invites a teammate.
 * The backend rejects /auth/register regardless — this page just explains why.
 */
export default function RegisterPage() {
  return (
    <div>
      <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-5 w-5" />
      </span>

      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">
        Accounts come with your purchase
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        You can&apos;t create an account here. When you buy LocalSchema AI, we email your login
        details — sign in with those.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Joining someone&apos;s team? Ask them to send you an invite link.
      </p>

      <Button asChild className="mt-6 w-full">
        <Link to="/login">Go to sign in</Link>
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Haven&apos;t bought it yet?{' '}
        <a
          href="https://app.appsfields.com"
          className="font-medium text-primary hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          Get LocalSchema AI
        </a>
      </p>
    </div>
  );
}
