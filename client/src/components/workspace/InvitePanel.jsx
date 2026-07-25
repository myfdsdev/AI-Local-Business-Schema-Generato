import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { workspaceApi } from '@/api/workspace';
import { toApiError } from '@/api/client';
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

/** Create a one-time join link to add someone to the workspace. */
export function InvitePanel() {
  const queryClient = useQueryClient();
  const [lastLink, setLastLink] = useState(null);
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

  const copyLink = async () => {
    await navigator.clipboard.writeText(lastLink);
    toast.success('Link copied.');
  };

  return (
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
            <Select value={form.watch('role')} onValueChange={(v) => form.setValue('role', v)}>
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
  );
}

export default InvitePanel;
