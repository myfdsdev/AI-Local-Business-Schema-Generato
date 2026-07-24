import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Loader2,
  ScanSearch,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { projectsApi, scansApi } from '@/api/projects';
import { toApiError } from '@/api/client';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { ScanPanel } from '@/components/scan/ScanPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

/** Phase 1 shows the confirmed project facts; Phase 2 adds the scan workflow. */
export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  // Most recent scan drives the panel; polled while one is in flight.
  const { data: scans } = useQuery({
    queryKey: ['project', projectId, 'scans'],
    queryFn: () => scansApi.listForProject(projectId),
  });
  const latestScan = scans?.[0] ?? null;
  const scanInFlight = latestScan?.status === 'queued' || latestScan?.status === 'running';

  const { data: liveScan } = useQuery({
    queryKey: ['scan', latestScan?.id],
    queryFn: () => scansApi.get(latestScan.id),
    enabled: Boolean(latestScan?.id) && scanInFlight,
    // Poll while running; stop as soon as it finishes. Also stop once the scan
    // is older than the server's own deadline, so a stuck scan can't leave the
    // UI spinning forever.
    refetchInterval: (query) => {
      const scanData = query.state.data;
      const status = scanData?.status;
      if (status !== 'queued' && status !== 'running') return false;

      const startedAt = scanData?.startedAt ?? scanData?.createdAt;
      const tooOld = startedAt && Date.now() - new Date(startedAt).getTime() > 150_000;
      return tooOld ? false : 1500;
    },
  });

  const scan = liveScan ?? latestScan;
  const isScanning = scan?.status === 'queued' || scan?.status === 'running';

  const scanMutation = useMutation({
    mutationFn: () => scansApi.start(projectId),
    onSuccess: () => {
      toast.success('Scan started.');
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'scans'] });
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  // Refresh project counters and credits once a scan finishes.
  const previousStatus = scan?.status;
  useEffect(() => {
    if (previousStatus === 'completed' || previousStatus === 'failed') {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId, 'scans'] });
    }
  }, [previousStatus, projectId, queryClient]);

  const removeMutation = useMutation({
    mutationFn: () => projectsApi.remove(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Project deleted.');
      navigate('/app/projects', { replace: true });
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load this project"
        description="It may have been deleted, or you may not have access to it."
        onRetry={refetch}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const { project, businessData, counts } = data;

  const handleDelete = () => {
    if (window.confirm(`Delete "${project.projectName}"? This cannot be undone.`)) {
      removeMutation.mutate();
    }
  };

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/app/projects">
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
      </Button>

      <PageHeader
        title={project.projectName}
        description={project.businessName}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={isScanning || scanMutation.isPending}
            >
              {isScanning || scanMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="h-4 w-4" />
              )}
              {isScanning ? 'Scanning…' : scan ? 'Re-scan website' : 'Scan website'}
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={removeMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              {removeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Business details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Detail label="Website">
                <a
                  href={project.websiteUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {project.normalizedDomain}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Detail>
              <Detail label="Business type">{project.businessType}</Detail>
              <Detail label="Country">{project.country}</Detail>
              <Detail label="Platform">{project.cms}</Detail>
              <Detail label="Locations">
                {project.locationMode === 'multi' ? 'Multiple locations' : 'Single location'}
              </Detail>
              <Detail label="Created">{formatDate(project.createdAt)}</Detail>
            </CardContent>
          </Card>

          {scan ? (
            <ScanPanel scan={scan} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Next: scan your website</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
                  <Globe className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Ready to scan {project.normalizedDomain}.</p>
                    <p className="mt-1">
                      We&apos;ll read your homepage and key pages, honour your robots.txt, detect any
                      schema already published, and pull out the business details we can find — nothing
                      is invented. Costs 1 scan credit.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Project status</span>
                <Badge variant="secondary">{project.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Schema Health Score</span>
                <span className="font-medium">
                  {project.schemaHealthScore != null ? project.schemaHealthScore : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Scans</span>
                <span className="font-medium">{counts?.scans ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Schemas</span>
                <span className="font-medium">{counts?.schemas ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confirmed fields</span>
                <span className="font-medium">{businessData?.confirmedFields?.length ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{children}</p>
    </div>
  );
}
