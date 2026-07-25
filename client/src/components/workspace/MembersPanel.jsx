import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import { workspaceApi } from '@/api/workspace';
import { toApiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/store/AuthContext';

const ROLE_VARIANT = { owner: 'default', admin: 'secondary', member: 'outline' };

/** The workspace roster: view roles, change a member's role, or remove them. */
export function MembersPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['workspace', 'members'] });

  const { data: members, isLoading } = useQuery({
    queryKey: ['workspace', 'members'],
    queryFn: workspaceApi.members,
    retry: false,
  });

  const removeMutation = useMutation({
    mutationFn: (userId) => workspaceApi.removeMember(userId),
    onSuccess: () => {
      invalidate();
      toast.success('Member removed.');
    },
    onError: (err) => toast.error(toApiError(err).message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }) => workspaceApi.updateMember(userId, role),
    onSuccess: () => {
      invalidate();
      toast.success('Role updated.');
    },
    onError: (err) => toast.error(toApiError(err).message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Members
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {members?.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.name || m.email}
                    {String(m.userId) === String(user?.id) && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={ROLE_VARIANT[m.role] ?? 'outline'} className="capitalize">
                    {m.role}
                  </Badge>
                  {m.role !== 'owner' && (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Change role for ${m.name || m.email}`}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={m.role === 'admin' || roleMutation.isPending}
                            onClick={() => roleMutation.mutate({ userId: m.userId, role: 'admin' })}
                          >
                            Make admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={m.role === 'member' || roleMutation.isPending}
                            onClick={() => roleMutation.mutate({ userId: m.userId, role: 'member' })}
                          >
                            Make member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <button
                        type="button"
                        onClick={() => removeMutation.mutate(m.userId)}
                        disabled={removeMutation.isPending}
                        aria-label={`Remove ${m.name || m.email}`}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default MembersPanel;
