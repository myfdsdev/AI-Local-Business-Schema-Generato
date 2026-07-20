import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { PageHeader } from '@/components/common/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { applyApiErrorToForm } from '@/hooks/useApiForm';
import { useAuth } from '@/store/AuthContext';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  companyName: z.string().trim().max(160).optional(),
});

export default function ProfilePage() {
  const { user, patchUser } = useAuth();

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', companyName: user?.companyName ?? '' },
  });

  const onSaveProfile = async (values) => {
    try {
      const updated = await authApi.updateProfile(values);
      patchUser(updated);
      toast.success('Profile updated.');
    } catch (error) {
      applyApiErrorToForm(error, profileForm);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" description="Manage your account details." />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4" noValidate>
              {profileForm.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertDescription>{profileForm.formState.errors.root.message}</AlertDescription>
                </Alert>
              )}
              <Field id="name" label="Full name" error={profileForm.formState.errors.name?.message}>
                <Input {...profileForm.register('name')} />
              </Field>
              <Field
                id="companyName"
                label="Business or agency name"
                error={profileForm.formState.errors.companyName?.message}
              >
                <Input {...profileForm.register('companyName')} />
              </Field>
              <Field id="email" label="Email">
                <Input value={user?.email ?? ''} disabled readOnly />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                  {profileForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
