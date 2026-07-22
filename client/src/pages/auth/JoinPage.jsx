import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

import { workspaceApi } from '@/api/workspace';
import { toApiError } from '@/api/client';
import { Logo } from '@/components/common/Logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/store/AuthContext';

/**
 * The link an owner sends. Accepting it creates the user, binds them to that
 * workspace, and logs them straight in — the workspace comes from the token,
 * never from anything the user types.
 */
export default function JoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { applySession } = useAuth();

  const { data: info, isLoading } = useQuery({
    queryKey: ['join', token],
    queryFn: () => workspaceApi.joinInfo(token),
    retry: false,
  });

  const form = useForm({ defaultValues: { name: '', password: '' } });

  const mutation = useMutation({
    mutationFn: (values) => workspaceApi.acceptJoin(token, values),
    onSuccess: (session) => {
      applySession(session);
      toast.success('Welcome to the workspace.');
      navigate('/app/dashboard', { replace: true });
    },
    onError: (err) => toast.error(toApiError(err).message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your invitation…
          </div>
        ) : !info?.valid ? (
          <Alert variant="destructive">
            <AlertTitle>This invitation isn&apos;t valid</AlertTitle>
            <AlertDescription>
              The link is invalid, already used, or has expired. Ask whoever invited you for a new
              one.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-semibold leading-tight tracking-tight">
                  Join the workspace
                </h1>
                <p className="text-sm text-muted-foreground">
                  You&apos;re joining as <span className="font-medium capitalize">{info.role}</span>
                  {info.email ? ` · ${info.email}` : ''}
                </p>
              </div>
            </div>

            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="space-y-4"
              noValidate
            >
              <Field id="name" label="Your name" required>
                <Input autoComplete="name" placeholder="Dana Member" {...form.register('name')} />
              </Field>
              <Field
                id="password"
                label="Create a password"
                hint="At least 10 characters, with a letter and a number."
                required
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...form.register('password')}
                />
              </Field>

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Join and continue
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
