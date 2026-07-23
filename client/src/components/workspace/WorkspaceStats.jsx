import { useQuery } from '@tanstack/react-query';
import { FolderKanban, ScanSearch, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { workspaceApi } from '@/api/workspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const STAT_CARDS = [
  { key: 'members', label: 'Members', icon: Users },
  { key: 'projects', label: 'Projects', icon: FolderKanban },
  { key: 'scans', label: 'Scans run', icon: ScanSearch },
];

/**
 * Workspace overview: totals plus an 8-week projects & scans chart. Data is
 * workspace-scoped on the server, so it only ever reflects this customer.
 */
export function WorkspaceStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['workspace', 'stats'],
    queryFn: workspaceApi.stats,
    retry: false,
  });

  const hasActivity = data?.series?.some((row) => row.projects > 0 || row.scans > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {STAT_CARDS.map(({ key, label, icon: Icon }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-10" />
                ) : (
                  <p className="text-xl font-semibold">{data?.totals?.[key] ?? 0}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projects &amp; scans over time</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : hasActivity ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  cursor={{ fill: 'hsl(var(--muted))' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="projects" name="Projects" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="scans" name="Scans" fill="hsl(var(--brand))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <p>No activity yet.</p>
              <p className="text-xs">Create a project or run a scan and it&apos;ll show up here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default WorkspaceStats;
