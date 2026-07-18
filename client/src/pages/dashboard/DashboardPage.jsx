import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FileCode2,
  FolderKanban,
  Gauge,
  MapPin,
  Plus,
} from 'lucide-react';

import { dashboardApi } from '@/api/projects';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard, StatCardSkeleton } from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';

const STATUS_COLORS = {
  valid: 'hsl(142 71% 40%)',
  warning: 'hsl(38 92% 50%)',
  error: 'hsl(0 72% 51%)',
  draft: 'hsl(215 16% 47%)',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.overview,
  });

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="An overview of your projects, scans, and schema health."
        actions={
          <Button asChild>
            <Link to="/app/projects/new">
              <Plus className="h-4 w-4" />
              New project
            </Link>
          </Button>
        }
      />

      {isError ? (
        <ErrorState
          title="Couldn't load your dashboard"
          description="There was a problem reaching the server."
          onRetry={refetch}
        />
      ) : (
        <div className="space-y-6">
          <StatGrid stats={data?.stats} isLoading={isLoading} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecentProjects projects={data?.recentProjects} isLoading={isLoading} />
            </div>
            <div className="space-y-6">
              <ValidationChart breakdown={data?.validationBreakdown} isLoading={isLoading} />
              <UpgradeCard plan={data?.stats?.plan} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatGrid({ stats, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const health = stats?.averageSchemaHealthScore;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Projects" value={stats?.totalProjects ?? 0} icon={FolderKanban} />
      <StatCard label="Locations" value={stats?.totalLocations ?? 0} icon={MapPin} />
      <StatCard
        label="Schemas generated"
        value={stats?.schemasGenerated ?? 0}
        icon={FileCode2}
        hint={`${stats?.validSchemas ?? 0} valid · ${stats?.schemasWithErrors ?? 0} with errors`}
      />
      <StatCard
        label="Avg. Schema Health Score"
        value={health == null ? '—' : `${health}`}
        icon={Gauge}
        tone={health == null ? 'default' : health >= 80 ? 'success' : health >= 60 ? 'warning' : 'destructive'}
        hint="Health of your generated schema"
      />
      <StatCard label="Remaining credits" value={stats?.remainingCredits ?? 0} icon={CreditCard} />
      <StatCard label="Scans used" value={stats?.scansUsed ?? 0} icon={Gauge} />
      <StatCard label="Valid schemas" value={stats?.validSchemas ?? 0} icon={CheckCircle2} tone="success" />
      <StatCard
        label="Need attention"
        value={stats?.projectsNeedingAttention ?? 0}
        icon={AlertTriangle}
        tone={stats?.projectsNeedingAttention ? 'warning' : 'default'}
      />
    </div>
  );
}

function RecentProjects({ projects, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Recent projects</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/projects">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : projects?.length ? (
          <ul className="divide-y divide-border">
            {projects.map((project) => (
              <li key={project._id}>
                <Link
                  to={`/app/projects/${project._id}`}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.projectName}</p>
                    <p className="truncate text-sm text-muted-foreground">{project.normalizedDomain}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{project.status}</Badge>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {formatRelativeTime(project.updatedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to scan a website and generate structured data."
            action={
              <Button asChild>
                <Link to="/app/projects/new">
                  <Plus className="h-4 w-4" />
                  New project
                </Link>
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function ValidationChart({ breakdown, isLoading }) {
  const data = (breakdown ?? []).filter((entry) => entry.count > 0);
  const total = data.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validation status</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="mx-auto h-40 w-40 rounded-full" />
        ) : total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No schemas generated yet. Your validation breakdown will appear here.
          </p>
        ) : (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {data.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-3 flex flex-wrap justify-center gap-3">
              {data.map((entry) => (
                <li key={entry.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[entry.status] }}
                  />
                  {entry.label} ({entry.count})
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UpgradeCard({ plan }) {
  if (!plan || plan.slug === 'agency') return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">You&apos;re on the {plan.name} plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Upgrade for more projects, larger scans, and schema monitoring.
        </p>
        <Button asChild size="sm">
          <Link to="/app/billing">View plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
