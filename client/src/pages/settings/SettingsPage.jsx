import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Copy, CreditCard, Loader2, User as UserIcon, Users } from 'lucide-react';
import { toast } from 'sonner';

import { workspaceApi } from '@/api/workspace';
import { toApiError } from '@/api/client';
import { ErrorState } from '@/components/common/ErrorState';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PageHeader } from '@/components/common/PageHeader';
import { ApiKeyPanel } from '@/components/workspace/ApiKeyPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

/** A read-only value with a copy button — used for the workspace id. */
function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy.');
    }
  };
  return (
    <div>
      <p className="mb-1.5 text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">{value}</code>
        <Button variant="outline" size="icon" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  // Shared hook so this page, the nav, and the team page can never disagree
  // about who owns the workspace.
  const { workspace: data, isLoading, isError, refetch, isWorkspaceAdmin } = useWorkspace();

  const [name, setName] = useState('');
  // Seed the input once the workspace loads (and whenever it changes).
  useEffect(() => {
    if (data?.name != null) setName(data.name);
  }, [data?.name]);

  const canEdit = isWorkspaceAdmin;

  const renameMutation = useMutation({
    mutationFn: (payload) => workspaceApi.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'context'] });
      toast.success('Workspace updated.');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  const onSave = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error('Enter a workspace name.');
      return;
    }
    renameMutation.mutate({ name: trimmed });
  };

  const dirty = data && name.trim() !== (data.name ?? '');

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" description="Manage your workspace details and preferences." />

      {isError ? (
        <ErrorState title="Couldn't load your settings" onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          {/* Workspace */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Workspace</CardTitle>
              {!isLoading && data?.status && (
                <Badge variant={data.status === 'active' ? 'success' : 'outline'} className="capitalize">
                  {data.status}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <form onSubmit={onSave} className="space-y-4">
                    <Field
                      id="workspaceName"
                      label="Workspace name"
                      hint={canEdit ? undefined : 'Only a workspace owner or admin can change this.'}
                    >
                      <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="My business"
                        disabled={!canEdit || renameMutation.isPending}
                        maxLength={200}
                      />
                    </Field>
                    {canEdit && (
                      <div className="flex justify-end">
                        <Button type="submit" disabled={!dirty || renameMutation.isPending}>
                          {renameMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                          Save changes
                        </Button>
                      </div>
                    )}
                  </form>

                  <CopyRow label="Workspace ID" value={data?.workspaceId ?? ''} />

                  {data?.ownerEmail && (
                    <div>
                      <p className="mb-1 text-sm text-muted-foreground">Owner</p>
                      <p className="text-sm">{data.ownerEmail}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Bring-your-own AI key — owner/admin only, same as the backend route. */}
          {canEdit && <ApiKeyPanel />}

          {/* Quick links to related management pages. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manage</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <Button asChild variant="outline" className="justify-start">
                <Link to="/app/team">
                  <Users className="h-4 w-4" />
                  Team
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/app/billing">
                  <CreditCard className="h-4 w-4" />
                  Plan & billing
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/app/profile">
                  <UserIcon className="h-4 w-4" />
                  Your profile
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
