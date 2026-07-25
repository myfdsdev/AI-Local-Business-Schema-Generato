import { LottieAnimation } from '@/components/common/LottieAnimation';

/**
 * Full-screen loader shown during the boot-time silent refresh. Uses the brand
 * Lottie (recoloured to the teal palette); if it fails to load, the text alone
 * still communicates the state.
 */
export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background">
      <LottieAnimation src="/animations/loading.json" className="w-full max-w-[16rem]" />
      <p className="-mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
