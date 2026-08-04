import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { accessApi } from '@/api/access';
import { toApiError } from '@/api/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/common/Logo';
import { useAuth } from '@/store/AuthContext';

// Mirrors the server's password policy so the user isn't told "too short" only
// after a round trip.
const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(128)
    .refine((v) => /[a-zA-Z]/.test(v), 'Include at least one letter.')
    .refine((v) => /[0-9]/.test(v), 'Include at least one number.'),
});

/**
 * Creates a workspace and its owner in one step, then signs them in — no email
 * round trip.
 *
 * Deliberately not linked from anywhere in the app. Set ADMIN_ACCESS_CODE on the
 * server to additionally require the ?code= this page passes through.
 */
export default function JoinAdminPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') ?? '';
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [failure, setFailure] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setFailure(null);
    try {
      const session = await accessApi.registerOwner({ ...values, code });
      applySession(session);
      toast.success('Your workspace is ready.');
      navigate('/app/dashboard', { replace: true });
    } catch (error) {
      setFailure(toApiError(error).message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardContent className="p-6">
            <h1 className="text-xl font-semibold tracking-tight">Create your workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ll own it — your projects and data stay private to you.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              {failure && (
                <Alert variant="destructive">
                  <AlertDescription>{failure}</AlertDescription>
                </Alert>
              )}

              <Field id="name" label="Full name" error={errors.name?.message} required>
                <Input placeholder="Jane Smith" autoComplete="name" {...register('name')} />
              </Field>

              <Field id="email" label="Email" error={errors.email?.message} required>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register('email')}
                />
              </Field>

              <Field
                id="password"
                label="Password"
                error={errors.password?.message}
                hint="At least 10 characters, with a letter and a number."
                required
              >
                <Input
                  type="password"
                  placeholder="••••••••••"
                  autoComplete="new-password"
                  {...register('password')}
                />
              </Field>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Create workspace
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
