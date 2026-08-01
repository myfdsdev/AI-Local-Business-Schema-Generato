import { useSearchParams } from 'react-router-dom';
import { BarChart3, UserPlus, Users } from 'lucide-react';

import { useWorkspace } from '@/hooks/useWorkspace';
import { PageHeader } from '@/components/common/PageHeader';
import { InvitePanel } from '@/components/workspace/InvitePanel';
import { MembersPanel } from '@/components/workspace/MembersPanel';
import { WorkspaceStats } from '@/components/workspace/WorkspaceStats';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Team area, split into tabs. TABS is the single source of truth — to add a
 * section later, add one entry here and it appears in the toggle automatically.
 */
const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3, Panel: WorkspaceStats },
  { id: 'members', label: 'Members', icon: Users, Panel: MembersPanel },
  { id: 'invite', label: 'Invite', icon: UserPlus, Panel: InvitePanel },
];

export default function TeamPage() {
  // The URL is the source of truth for the active tab, so other parts of the
  // app can deep-link straight to a section (e.g. the header's Invite button
  // → /app/team?tab=invite). An unknown value falls back to the first tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const activeId = TABS.some((tab) => tab.id === requested) ? requested : TABS[0].id;

  const setActiveId = (id) =>
    // Default tab keeps the URL clean; `replace` avoids stacking history entries.
    setSearchParams(id === TABS[0].id ? {} : { tab: id }, { replace: true });

  // Only owners/admins manage the team. The shared hook gates positively, so a
  // member never briefly sees the tabs and the notice shows reliably.
  const { isWorkspaceAdmin: canManage, isLoading: roleLoading } = useWorkspace();

  const ActivePanel = TABS.find((tab) => tab.id === activeId)?.Panel ?? TABS[0].Panel;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Team"
        description="Everyone here shares this workspace. Its data is private to you — no other customer can see it."
      />

      {roleLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : !canManage ? (
        <Alert>
          <AlertTitle>Members can&apos;t manage the team</AlertTitle>
          <AlertDescription>
            Only the workspace owner or an admin can view the team, invite, or remove people.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* Toggle nav */}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveId(id)}
                aria-pressed={activeId === id}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  activeId === id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Active panel */}
          <ActivePanel />
        </div>
      )}
    </div>
  );
}
