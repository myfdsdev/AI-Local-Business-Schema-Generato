import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

// Mirrors the server's passwordSchema so the user isn't told "too short" only
// after a round trip.
const schema = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(128)
      .refine((v) => /[a-zA-Z]/.test(v), 'Include at least one letter.')
      .refine((v) => /[0-9]/.test(v), 'Include at least one number.'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Both passwords must match.',
    path: ['confirm'],
  });

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [failure, setFailure] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  const onSubmit = async ({ password }) => {
    setFailure(null);
    try {
      await authApi.resetPassword({ token, password });
      toast.success('Password changed. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (error) {
      setFailure(toApiError(error).message);
    }
  };

  // A link opened without a token can't work — say so instead of showing a form
  // that will always fail.
  if (!token) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset link incomplete</h1>
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>This link is missing its token</AlertTitle>
          <AlertDescription>
            It may have been broken across two lines by your email app. Try copying the whole link, or
            request a new one.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-6 w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick something you don&apos;t use anywhere else. You&apos;ll be signed out everywhere once it
        changes.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        {failure && (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}

        <Field
          id="password"
          label="New password"
          error={errors.password?.message}
          hint="At least 10 characters, with a letter and a number."
        >
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••"
            {...register('password')}
          />
        </Field>

        <Field id="confirm" label="Confirm new password" error={errors.confirm?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••"
            {...register('confirm')}
          />
        </Field>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Change password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
