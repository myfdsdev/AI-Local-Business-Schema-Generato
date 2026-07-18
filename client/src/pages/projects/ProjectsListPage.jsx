import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink, FolderKanban, Plus, Search } from 'lucide-react';

import { projectsApi } from '@/api/projects';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/utils';

const STATUS_VARIANT = {
  ready: 'success',
  scanning: 'default',
  draft: 'secondary',
  archived: 'outline',
};

export default function ProjectsListPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects', { search }],
    queryFn: () => projectsApi.list({ search: search || undefined }),
  });

  const projects = data?.data?.projects ?? [];

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Each project is a website you scan and generate structured data for."
        actions={
          <Button asChild>
            <Link to="/app/projects/new">
              <Plus className="h-4 w-4" />
              New project
            </Link>
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search projects…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isError ? (
        <ErrorState title="Couldn't load your projects" onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={search ? 'No matching projects' : 'No projects yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Create your first project to scan a website and generate schema.'
          }
          action={
            !search && (
              <Button asChild>
                <Link to="/app/projects/new">
                  <Plus className="h-4 w-4" />
                  New project
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project._id} to={`/app/projects/${project._id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight">{project.projectName}</h3>
                    <Badge variant={STATUS_VARIANT[project.status] ?? 'secondary'}>{project.status}</Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <ExternalLink className="h-3 w-3" />
                    {project.normalizedDomain}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{project.businessType}</span>
                    <span>
                      {project.schemaHealthScore != null
                        ? `Health ${project.schemaHealthScore}`
                        : `Updated ${formatRelativeTime(project.updatedAt)}`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
