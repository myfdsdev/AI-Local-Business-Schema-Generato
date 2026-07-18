import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { resetPasswordSchema } from '@/schemas/auth.schema';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async ({ password }) => {
    try {
      await authApi.resetPassword({ token, password });
      toast.success('Password reset. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (error) {
      setError('root', { message: toApiError(error).message });
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Invalid reset link</h1>
        <p className="mt-1 text-sm text-muted-foreground">This link is missing its reset token.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your new password signs out all other sessions.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}

        <Field
          id="password"
          label="New password"
          error={errors.password?.message}
          hint="At least 10 characters, with a letter and a number."
        >
          <Input type="password" autoComplete="new-password" placeholder="••••••••" {...register('password')} />
        </Field>

        <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" placeholder="••••••••" {...register('confirmPassword')} />
        </Field>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Reset password
        </Button>
      </form>
    </div>
  );
}
