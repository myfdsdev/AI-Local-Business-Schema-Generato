import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { workspaceApi } from '@/api/workspace';
import { toApiError } from '@/api/client';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/store/AuthContext';

/**
 * Owner activation. The buyer enters the email they bought with plus the 6–7
 * digit code the main app gave them, sets a password, and is signed straight in
 * as owner of their workspace. The workspace comes from the email+code, never
 * from anything else the user types.
 */
export default function ActivatePage() {
  const navigate = useNavigate();
  const { applySession } = useAuth();

  const form = useForm({ defaultValues: { email: '', code: '', name: '', password: '' } });

  const mutation = useMutation({
    mutationFn: (values) => workspaceApi.activate(values),
    onSuccess: (session) => {
      applySession(session);
      toast.success('Activated. Welcome to your workspace.');
      navigate('/app/dashboard', { replace: true });
    },
    onError: (err) => toast.error(toApiError(err).message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />

        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold leading-tight tracking-tight">Activate your app</h1>
            <p className="text-sm text-muted-foreground">
              Enter the email you bought with and your activation code.
            </p>
          </div>
        </div>

        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
          noValidate
        >
          <Field id="email" label="Email" required>
            <Input type="email" autoComplete="email" placeholder="you@example.com" {...form.register('email')} />
          </Field>
          <Field id="code" label="Activation code" required>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="1234567"
              {...form.register('code')}
            />
          </Field>
          <Field id="name" label="Your name" required>
            <Input autoComplete="name" placeholder="Dana Owner" {...form.register('name')} />
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
            Activate and continue
          </Button>
        </form>
      </div>
    </div>
  );
}
