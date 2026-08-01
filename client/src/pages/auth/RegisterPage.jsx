import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { applyApiErrorToForm } from '@/hooks/useApiForm';
import { registerSchema } from '@/schemas/auth.schema';
import { useAuth } from '@/store/AuthContext';

/**
 * Open signup: creating an account makes you the owner of your own new
 * workspace. Business name and role are asked during onboarding.
 */
export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = async (values) => {
    try {
      await registerUser(values);
      toast.success('Account created. Welcome to RankLocalBiz.');
      navigate('/onboarding', { replace: true });
    } catch (error) {
      applyApiErrorToForm(error, form);
    }
  };

  return (
    <div>
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;ll own your own workspace — your projects and data stay private to you.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}

        <Field id="name" label="Full name" error={errors.name?.message} required>
          <Input autoComplete="name" placeholder="Dana Owner" {...register('name')} />
        </Field>

        <Field id="email" label="Email" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
        </Field>

        <Field
          id="password"
          label="Password"
          error={errors.password?.message}
          hint="At least 10 characters, with a letter and a number."
          required
        >
          <Input type="password" autoComplete="new-password" placeholder="••••••••" {...register('password')} />
        </Field>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
