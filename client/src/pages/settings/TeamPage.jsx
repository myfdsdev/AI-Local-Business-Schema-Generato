import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Loader2, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { workspaceApi } from '@/api/workspace';
import { toApiError } from '@/api/client';
import { PageHeader } from '@/components/common/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/store/AuthContext';

const ROLE_VARIANT = { owner: 'default', admin: 'secondary', member: 'outline' };

/**
 * Workspace team management. Owners/admins invite people (via a join link),
 * see the roster, and remove members. Plain members get a read-only notice
 * (the backend also enforces this).
 */
export default function TeamPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lastLink, setLastLink] = useState(null);

  const { data: members, isLoading, isError, error } = useQuery({
    queryKey: ['workspace', 'members'],
    queryFn: workspaceApi.members,
    retry: false,
  });

  const form = useForm({ defaultValues: { email: '', role: 'member' } });

  const inviteMutation = useMutation({
    mutationFn: (values) => workspaceApi.invite(values),
    onSuccess: (data) => {
      setLastLink(data.joinUrl);
      form.reset({ email: '', role: 'member' });
      queryClient.invalidateQueries({ queryKey: ['workspace', 'members'] });
      toast.success('Invite link created.');
    },
    onError: (err) => toast.error(toApiError(err).message),
  });

  const removeMutation = useMutation({
    mutationFn: (userId) => workspaceApi.removeMember(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'members'] });
      toast.success('Member removed.');
    },
    onError: (err) => toast.error(toApiError(err).message),
  });

  // The members endpoint 403s for plain members — that's the signal.
  const forbidden = isError && toApiError(error).status === 403;

  const copyLink = async () => {
    await navigator.clipboard.writeText(lastLink);
    toast.success('Link copied.');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Team"
        description="Everyone here shares this workspace. Its data is private to you — no other customer can see it."
      />

      {forbidden ? (
        <Alert>
          <AlertTitle>Members can&apos;t manage the team</AlertTitle>
          <AlertDescription>
            Only the workspace owner or an admin can invite or remove people. Ask them if you need
            access changed.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4" /> Invite someone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={form.handleSubmit((values) => inviteMutation.mutate(values))}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <Field id="email" label="Email (optional)" className="flex-1">
                  <Input placeholder="teammate@example.com" {...form.register('email')} />
                </Field>
                <Field id="role" label="Role" className="sm:w-40">
                  <Select
                    value={form.watch('role')}
                    onValueChange={(v) => form.setValue('role', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Create link
                </Button>
              </form>

              {lastLink && (
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Send this one-time link to the person. It joins them to your workspace.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{lastLink}</code>
                    <Button variant="outline" size="sm" onClick={copyLink}>
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
                          <button
                            type="button"
                            onClick={() => removeMutation.mutate(m.userId)}
                            disabled={removeMutation.isPending}
                            aria-label={`Remove ${m.name || m.email}`}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
