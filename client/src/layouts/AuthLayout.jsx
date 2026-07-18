import { Link, Outlet } from 'react-router-dom';

import { Logo } from '@/components/common/Logo';

/** Centered card layout for the auth pages, with a subtle brand panel. */
export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-8 inline-block">
            <Logo />
          </Link>
          <Outlet />
        </div>
      </div>

      {/* Brand panel — hidden on small screens */}
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/70" />
        <div className="relative flex h-full flex-col justify-center px-12 text-primary-foreground">
          <h2 className="max-w-md text-3xl font-semibold leading-tight">
            Accurate structured data for your local business.
          </h2>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Scan your website, confirm the details, and generate valid JSON-LD that helps search
            engines understand your business and improves local search visibility.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-primary-foreground/90">
            <li>• Detect and audit your existing schema</li>
            <li>• Generate a connected Schema.org graph</li>
            <li>• Validate before you publish</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
