import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Globe, Loader2, MapPin, Pencil, Phone, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { catalogApi, projectsApi } from '@/api/projects';
import { locationsApi } from '@/api/locations';
import { toApiError } from '@/api/client';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { applyApiErrorToForm } from '@/hooks/useApiForm';
import { emptyLocation, locationFormSchema } from '@/schemas/location.schema';

/** One line like "12 High St, Austin, TX 78701" — skips blank parts. */
function formatAddress(address) {
  if (!address) return '';
  return [
    address.streetAddress,
    address.addressLocality,
    [address.addressRegion, address.postalCode].filter(Boolean).join(' '),
    address.addressCountry,
  ]
    .filter(Boolean)
    .join(', ');
}

function LocationForm({ projects, typeOptions, initial, onDone, onCancel }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(initial?._id);

  const form = useForm({
    resolver: zodResolver(locationFormSchema),
    defaultValues: initial
      ? {
          ...emptyLocation,
          ...initial,
          projectId: initial.projectId?._id ?? initial.projectId ?? '',
          address: { ...emptyLocation.address, ...(initial.address ?? {}) },
        }
      : { ...emptyLocation, projectId: projects[0]?._id ?? '' },
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
      if (isEdit) {
        const { projectId: _ignore, ...patch } = payload;
        await locationsApi.update(initial._id, patch);
        toast.success('Location updated.');
      } else {
        await locationsApi.create(payload);
        toast.success('Location added.');
      }
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      onDone();
    } catch (error) {
      applyApiErrorToForm(error, form);
      toast.error(toApiError(error).message);
    }
  };

  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{isEdit ? 'Edit location' : 'Add a location'}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel} type="button">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {errors.root && <p className="text-sm font-medium text-destructive">{errors.root.message}</p>}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="projectId" label="Project" error={errors.projectId?.message} required>
              <Select
                value={values.projectId}
                onValueChange={(value) => setValue('projectId', value, { shouldValidate: true })}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {projects.map((project) => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="name" label="Location name" error={errors.name?.message} required>
              <Input placeholder="Downtown branch" {...register('name')} />
            </Field>
          </div>

          <Field
            id="pageUrl"
            label="Location page URL"
            error={errors.pageUrl?.message}
            hint="The public page for this location — its unique address in the schema graph."
            required
          >
            <Input placeholder="https://example.com/locations/downtown" {...register('pageUrl')} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="businessType" label="Business type" error={errors.businessType?.message}>
              <Select
                value={values.businessType}
                onValueChange={(value) => setValue('businessType', value)}
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

            <Field id="telephone" label="Phone" error={errors.telephone?.message}>
              <Input placeholder="+1 512 555 0100" {...register('telephone')} />
            </Field>
          </div>

          <Field id="email" label="Email" error={errors.email?.message}>
            <Input placeholder="downtown@example.com" {...register('email')} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="streetAddress" label="Street address" error={errors.address?.streetAddress?.message}>
              <Input placeholder="12 High Street" {...register('address.streetAddress')} />
            </Field>
            <Field id="addressLocality" label="City" error={errors.address?.addressLocality?.message}>
              <Input placeholder="Austin" {...register('address.addressLocality')} />
            </Field>
            <Field id="addressRegion" label="Region / State" error={errors.address?.addressRegion?.message}>
              <Input placeholder="TX" {...register('address.addressRegion')} />
            </Field>
            <Field id="postalCode" label="Postal code" error={errors.address?.postalCode?.message}>
              <Input placeholder="78701" {...register('address.postalCode')} />
            </Field>
            <Field
              id="addressCountry"
              label="Country code"
              error={errors.address?.addressCountry?.message}
              hint="2-letter ISO code, e.g. US."
            >
              <Input placeholder="US" maxLength={2} {...register('address.addressCountry')} />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Add location'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LocationsPage() {
  const queryClient = useQueryClient();
  // null = form closed; 'new' = adding; an object = editing that location.
  const [editing, setEditing] = useState(null);

  const projectsQuery = useQuery({
    queryKey: ['projects', { for: 'locations' }],
    queryFn: () => projectsApi.list(),
  });
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  });
  const { data: schemaTypes } = useQuery({
    queryKey: ['catalog', 'schema-types'],
    queryFn: () => catalogApi.schemaTypes(),
    staleTime: 5 * 60 * 1000,
  });

  const removeMutation = useMutation({
    mutationFn: (locationId) => locationsApi.remove(locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Location removed.');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  const projects = projectsQuery.data?.data?.projects ?? [];
  const locations = locationsQuery.data ?? [];
  const typeOptions = schemaTypes?.length
    ? schemaTypes
    : [{ name: 'LocalBusiness', label: 'Local business (generic)' }];

  const handleDelete = (location) => {
    if (window.confirm(`Remove "${location.name}"? This can't be undone.`)) {
      removeMutation.mutate(location._id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Each physical branch you manage. Every location gets its own page URL so it stays unique in the schema graph."
        actions={
          projects.length > 0 && (
            <Button onClick={() => setEditing('new')} disabled={editing === 'new'}>
              <Plus className="h-4 w-4" />
              Add location
            </Button>
          )
        }
      />

      {editing === 'new' && (
        <LocationForm
          projects={projects}
          typeOptions={typeOptions}
          onDone={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      )}
      {editing && editing !== 'new' && (
        <LocationForm
          projects={projects}
          typeOptions={typeOptions}
          initial={editing}
          onDone={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      )}

      {projectsQuery.isError || locationsQuery.isError ? (
        <ErrorState
          title="Couldn't load your locations"
          onRetry={() => {
            projectsQuery.refetch();
            locationsQuery.refetch();
          }}
        />
      ) : projectsQuery.isLoading || locationsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Create a project first"
          description="Locations belong to a project. Add a project, then start listing its branches here."
          action={
            <Button asChild>
              <Link to="/app/projects/new">
                <Plus className="h-4 w-4" />
                New project
              </Link>
            </Button>
          }
        />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add your first branch to generate location-specific structured data."
          action={
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              Add location
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {locations.map((location) => {
            const projectName = location.projectId?.projectName;
            const address = formatAddress(location.address);
            return (
              <Card key={location._id} className="h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold leading-tight">{location.name}</h3>
                      {projectName && (
                        <p className="truncate text-xs text-muted-foreground">{projectName}</p>
                      )}
                    </div>
                    <Badge variant={location.active ? 'success' : 'outline'}>
                      {location.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    {address && (
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0">{address}</span>
                      </p>
                    )}
                    {location.telephone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {location.telephone}
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <a
                        href={location.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-primary hover:underline"
                      >
                        {location.pageUrl}
                      </a>
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-1 border-t pt-3">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(location)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(location)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
