import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { z } from 'zod';

import { accessApi } from '@/api/access';
import { toApiError } from '@/api/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/common/Logo';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
});

/**
 * Self-service workspace access at /join-admin.
 *
 * An optional ?code= is passed straight through; the server requires it only
 * when ADMIN_ACCESS_CODE is configured, and is the only thing that can judge it
 * — there is no client-side validation of it by design.
 */
export default function JoinAdminPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') ?? '';
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', email: '' } });

  const onSubmit = async (values) => {
    setFailure(null);
    try {
      await accessApi.request({ ...values, code });
      setSent(true);
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

        {sent ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We&apos;ve sent a confirmation link to{' '}
                <span className="font-medium text-foreground">{getValues('email')}</span>. Open it
                and your workspace will be created and ready to use.
              </p>
              <p className="text-xs text-muted-foreground">
                The link expires in 72 hours. Check your spam folder if it doesn&apos;t arrive.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <h1 className="text-xl font-semibold tracking-tight">Get workspace access</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us who you are and we&apos;ll email you a link to set up your workspace.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
                {failure && (
                  <Alert variant="destructive">
                    <AlertDescription>{failure}</AlertDescription>
                  </Alert>
                )}

                <Field id="name" label="Your name" error={errors.name?.message}>
                  <Input placeholder="Jane Smith" autoComplete="name" {...register('name')} />
                </Field>

                <Field id="email" label="Email" error={errors.email?.message}>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...register('email')}
                  />
                </Field>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Get access
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
