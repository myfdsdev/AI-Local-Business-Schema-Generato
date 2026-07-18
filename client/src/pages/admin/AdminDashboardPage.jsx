import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileCode2, FolderKanban, ScanSearch, UserCheck, Users } from 'lucide-react';

import { adminApi } from '@/api/admin';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard, StatCardSkeleton } from '@/components/dashboard/StatCard';

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.dashboard,
  });

  const stats = data?.stats;

  return (
    <div>
      <PageHeader title="Admin overview" description="Platform-wide statistics and health." />

      {isError ? (
        <ErrorState title="Couldn't load admin stats" onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total users" value={stats.totalUsers} icon={Users} />
          <StatCard label="Active users" value={stats.activeUsers} icon={UserCheck} tone="success" />
          <StatCard
            label="Suspended users"
            value={stats.suspendedUsers}
            icon={AlertTriangle}
            tone={stats.suspendedUsers ? 'warning' : 'default'}
          />
          <StatCard label="Projects" value={stats.totalProjects} icon={FolderKanban} />
          <StatCard label="Scans" value={stats.totalScans} icon={ScanSearch} />
          <StatCard label="Schemas" value={stats.totalSchemas} icon={FileCode2} />
          <StatCard
            label="Errors (24h)"
            value={stats.errorsLast24h}
            icon={AlertTriangle}
            tone={stats.errorsLast24h ? 'destructive' : 'default'}
          />
        </div>
      )}
    </div>
  );
}
