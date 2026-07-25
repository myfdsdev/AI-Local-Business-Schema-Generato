import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, UserPlus, Users } from 'lucide-react';

import { workspaceApi } from '@/api/workspace';
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
  const [activeId, setActiveId] = useState(TABS[0].id);

  // Only owners/admins manage the team. Gate POSITIVELY: show the tools only
  // once we've confirmed an owner/admin role, so a member never briefly sees the
  // tabs, and the notice reliably shows for members and on a failed role check.
  const { data: workspace, isLoading: roleLoading } = useQuery({
    queryKey: ['workspace', 'context'],
    queryFn: workspaceApi.context,
    retry: false,
  });
  const canManage = workspace?.role === 'owner' || workspace?.role === 'admin';

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
