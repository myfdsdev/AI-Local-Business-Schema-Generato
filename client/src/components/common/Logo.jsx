import { ScanSearch } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Word + mark used in the marketing header and app sidebar. */
export function Logo({ className, iconClassName, showText = true }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground',
          iconClassName,
        )}
      >
        <ScanSearch className="h-5 w-5" />
      </span>
      {showText && <span className="text-foreground">LocalSchema&nbsp;AI</span>}
    </span>
  );
}
