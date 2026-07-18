import { Hammer } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';

/**
 * Honest placeholder for surfaces whose backend lands in a later phase. It does
 * not fake data — it states plainly that the feature is not built yet.
 */
export function ComingSoon({ title, description, note }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Hammer}
        title="Coming in a later phase"
        description={note ?? 'This part of LocalSchema AI is being built. The Phase 1 foundation it depends on is already in place.'}
      />
    </div>
  );
}
