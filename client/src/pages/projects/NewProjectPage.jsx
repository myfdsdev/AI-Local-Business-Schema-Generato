import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { catalogApi, projectsApi } from '@/api/projects';
import { PageHeader } from '@/components/common/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { applyApiErrorToForm } from '@/hooks/useApiForm';
import {
  CMS_OPTIONS,
  COUNTRY_OPTIONS,
  LOCATION_MODE_OPTIONS,
  createProjectSchema,
} from '@/schemas/project.schema';
import { useAuth } from '@/store/AuthContext';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Business types come from the admin-managed catalog, not a hardcoded list.
  const { data: schemaTypes } = useQuery({
    queryKey: ['catalog', 'schema-types'],
    queryFn: () => catalogApi.schemaTypes(),
    staleTime: 5 * 60 * 1000,
  });

  const form = useForm({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      projectName: '',
      websiteUrl: '',
      businessName: '',
      businessType: 'LocalBusiness',
      country: user?.country || 'US',
      language: 'en',
      cms: 'other',
      locationMode: 'single',
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const values = watch();

  const onSubmit = async (payload) => {
    try {
      const project = await projectsApi.create(payload);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Project created successfully');
      navigate(`/app/projects/${project.id ?? project._id}`);
    } catch (error) {
      const parsed = applyApiErrorToForm(error, form);
      if (parsed.code === 'EMAIL_NOT_VERIFIED') {
        toast.error('Verify your email address before creating a project.');
      }
    }
  };

  const typeOptions = schemaTypes?.length
    ? schemaTypes
    : [{ name: 'LocalBusiness', label: 'Local business (generic)' }];

  return (
    <div className="mx-auto max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/app/projects">
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
      </Button>

      <PageHeader
        title="Create a project"
        description="Tell us about the business and website you want to generate schema for."
      />

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {errors.root && (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}

            <Field id="projectName" label="Project name" error={errors.projectName?.message} required>
              <Input placeholder="Bella Vista Trattoria" {...register('projectName')} />
            </Field>

            <Field
              id="websiteUrl"
              label="Website URL"
              error={errors.websiteUrl?.message}
              hint="We validate this before creating the project. Private and internal addresses are blocked."
              required
            >
              <Input placeholder="https://example.com" {...register('websiteUrl')} />
            </Field>

            <Field id="businessName" label="Business name" error={errors.businessName?.message} required>
              <Input placeholder="Bella Vista Trattoria" {...register('businessName')} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="businessType" label="Business type" error={errors.businessType?.message} required>
                <Select
                  value={values.businessType}
                  onValueChange={(value) => setValue('businessType', value, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {typeOptions.map((type) => (
                      <SelectItem key={type.name} value={type.name}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="country" label="Country" error={errors.country?.message} required>
                <Select
                  value={values.country}
                  onValueChange={(value) => setValue('country', value, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {COUNTRY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="cms" label="Website platform" error={errors.cms?.message}>
                <Select value={values.cms} onValueChange={(value) => setValue('cms', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a platform" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {CMS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="locationMode" label="Locations" error={errors.locationMode?.message}>
                <Select value={values.locationMode} onValueChange={(value) => setValue('locationMode', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button asChild variant="outline" type="button">
                <Link to="/app/projects">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
