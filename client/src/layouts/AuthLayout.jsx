import { Link, Outlet } from 'react-router-dom';

import { Logo } from '@/components/common/Logo';
import { LottieAnimation } from '@/components/common/LottieAnimation';

/** Split auth layout: form on the left, brand panel with animation on the right. */
export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-10 inline-block">
            <Logo />
          </Link>
          <Outlet />
        </div>
      </div>

      {/* Brand panel — hidden on small screens where it would just push the form
          down. Charcoal base with the deep teal rising from the bottom, so it
          reads with depth instead of as one flat block of colour. */}
      <div className="relative hidden overflow-hidden bg-[#222222] lg:block">
        <div className="absolute inset-0 bg-gradient-to-b from-[#222222] via-[#0B3B39] to-[#05524F]" />

        {/* Soft teal glow behind the animation. */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/3 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#14A39C]/20 blur-3xl"
        />

        {/* Animation carries the panel; the copy is deliberately short so it
            doesn't compete with it. */}
        <div className="relative flex h-full flex-col items-center justify-center px-14 py-16 text-center text-white">
          <LottieAnimation
            src="/animations/secure-login.json"
            className="w-full max-w-[22rem]"
          />

          <h2 className="mt-8 max-w-sm text-balance text-[1.75rem] font-semibold leading-tight tracking-tight">
            Accurate structured data for your local business
          </h2>

          <p className="mt-3 max-w-xs text-[0.9375rem] leading-relaxed text-white/70">
            Scan, confirm, and publish valid JSON-LD.
          </p>
        </div>
      </div>
    </div>
  );
}
