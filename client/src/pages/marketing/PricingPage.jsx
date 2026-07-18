import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

import { catalogApi } from '@/api/projects';
import { Logo } from '@/components/common/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function formatLimit(value, noun) {
  if (value === -1) return `Unlimited ${noun}`;
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

export default function PricingPage() {
  const { data: plans, isLoading } = useQuery({ queryKey: ['plans'], queryFn: catalogApi.plans });

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/">
          <Logo />
        </Link>
        <Button asChild variant="ghost">
          <Link to="/login">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Simple, transparent pricing</h1>
          <p className="mt-2 text-muted-foreground">Start free. Upgrade as you add sites and locations.</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-96 w-full rounded-xl" />
              ))
            : plans?.map((plan) => (
                <Card key={plan._id} className={plan.slug === 'pro' ? 'border-primary shadow-md' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {plan.slug === 'pro' && <Badge>Popular</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                    <div className="mt-2">
                      <span className="text-3xl font-semibold">${plan.price}</span>
                      <span className="text-sm text-muted-foreground">/{plan.billingInterval}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button asChild className="w-full" variant={plan.slug === 'pro' ? 'default' : 'outline'}>
                      <Link to="/register">{plan.price === 0 ? 'Start free' : `Choose ${plan.name}`}</Link>
                    </Button>
                    <ul className="space-y-2 text-sm">
                      <PlanLine>{formatLimit(plan.projectLimit, 'project')}</PlanLine>
                      <PlanLine>{formatLimit(plan.locationLimit, 'location')}</PlanLine>
                      <PlanLine>Scan up to {plan.pageScanLimit} pages per site</PlanLine>
                      {plan.features?.map((feature) => (
                        <PlanLine key={feature}>{feature}</PlanLine>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          LocalSchema AI helps search engines understand your business. It does not promise
          guaranteed Google rankings or rich results.
        </p>
      </main>
    </div>
  );
}

function PlanLine({ children }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}
