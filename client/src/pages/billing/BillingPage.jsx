import { useQuery } from '@tanstack/react-query';
import { Check, CreditCard, FolderKanban, Gauge, MapPin, Sparkles } from 'lucide-react';

import { catalogApi, dashboardApi } from '@/api/projects';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';

/** A used/limit bar; -1 limit renders as "Unlimited" with no bar. */
function UsageMeter({ icon: Icon, label, used, limit }) {
  const unlimited = limit === -1 || limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const near = !unlimited && pct >= 80;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </span>
        <span className="font-medium">
          {used}
          {unlimited ? '' : ` / ${limit}`}
          {unlimited && <span className="ml-1 text-xs font-normal text-muted-foreground">used</span>}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        {unlimited ? (
          <div className="h-full w-full bg-primary/30" />
        ) : (
          <div
            className={cn('h-full rounded-full transition-all', near ? 'bg-amber-500' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

function formatPrice(plan) {
  if (!plan.price) return 'Free';
  return `$${plan.price}`;
}

export default function BillingPage() {
  const { user } = useAuth();

  const overviewQuery = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.overview });
  const plansQuery = useQuery({
    queryKey: ['catalog', 'plans'],
    queryFn: catalogApi.plans,
    staleTime: 5 * 60 * 1000,
  });

  const stats = overviewQuery.data?.stats;
  const plans = plansQuery.data ?? [];
  const currentSlug = stats?.plan?.slug ?? user?.plan ?? 'free';
  const currentPlan = plans.find((p) => p.slug === currentSlug);

  const isLoading = overviewQuery.isLoading || plansQuery.isLoading;
  const isError = overviewQuery.isError || plansQuery.isError;

  return (
    <div>
      <PageHeader title="Plan & usage" description="Your current plan, what you've used this cycle, and the tiers you can move to." />

      {isError ? (
        <ErrorState
          title="Couldn't load your plan"
          onRetry={() => {
            overviewQuery.refetch();
            plansQuery.refetch();
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Current plan + usage */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                Current plan
              </CardTitle>
              {isLoading ? (
                <Skeleton className="h-6 w-20 rounded-full" />
              ) : (
                <Badge variant="default" className="capitalize">
                  {currentPlan?.name ?? currentSlug}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  <UsageMeter
                    icon={FolderKanban}
                    label="Projects"
                    used={stats?.totalProjects ?? 0}
                    limit={currentPlan?.projectLimit}
                  />
                  <UsageMeter
                    icon={MapPin}
                    label="Locations"
                    used={stats?.totalLocations ?? 0}
                    limit={currentPlan?.locationLimit}
                  />
                  <UsageMeter
                    icon={Gauge}
                    label="Scans this cycle"
                    used={stats?.scansUsed ?? 0}
                    limit={currentPlan?.monthlyScanLimit}
                  />
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CreditCard className="h-4 w-4" />
                      Scan credits left
                    </span>
                    <span className="text-lg font-semibold">{stats?.remainingCredits ?? 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tier comparison */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Available plans</h2>
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-96 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {plans.map((plan) => {
                  const isCurrent = plan.slug === currentSlug;
                  return (
                    <Card
                      key={plan.slug}
                      className={cn('flex flex-col', isCurrent && 'border-primary ring-1 ring-primary')}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{plan.name}</CardTitle>
                          {isCurrent && <Badge>Current</Badge>}
                          {plan.slug === 'pro' && !isCurrent && (
                            <Badge variant="secondary" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              Popular
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2">
                          <span className="text-2xl font-bold">{formatPrice(plan)}</span>
                          {plan.price > 0 && (
                            <span className="text-sm text-muted-foreground">/{plan.billingInterval}</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col">
                        <ul className="flex-1 space-y-2 text-sm">
                          {plan.features?.map((feature) => (
                            <li key={feature} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          className="mt-5 w-full"
                          variant={isCurrent ? 'outline' : 'default'}
                          disabled={isCurrent}
                        >
                          {isCurrent ? 'Your plan' : `Choose ${plan.name}`}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Honest note: no in-app payments yet. */}
          <Card className="border-dashed bg-muted/30">
            <CardContent className="p-5 text-sm text-muted-foreground">
              <p>
                Plan changes are handled by your AppsFields account team — in-app card payments aren&apos;t
                enabled yet. To move to a different plan, contact support and your workspace will be updated
                automatically.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
