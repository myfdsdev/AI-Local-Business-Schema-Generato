import { Link } from 'react-router-dom';
import { CheckCircle2, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react';

import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/AuthContext';

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'Scan and understand your site',
    description:
      'We crawl only your approved domain, read the visible content, and detect any structured data you already have.',
  },
  {
    icon: Sparkles,
    title: 'Generate a connected JSON-LD graph',
    description:
      'Deterministic templates turn your confirmed business details into valid, connected Schema.org markup — never invented data.',
  },
  {
    icon: ShieldCheck,
    title: 'Validate before you publish',
    description:
      'Three levels of checks catch JSON, Schema.org, and common local-SEO issues, with clear, honest recommendations.',
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const appHref = isAuthenticated ? '/app/dashboard' : '/register';

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/pricing">Pricing</Link>
          </Button>
          {isAuthenticated ? (
            <Button asChild>
              <Link to="/app/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI-assisted, deterministic schema generation
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Accurate structured data for your local business
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Help search engines understand your local business and improve local search visibility
            with accurate structured data.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to={appHref}>Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No guaranteed rankings or rich results — just correct, validated markup you control.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <ul className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
              {[
                'Create a project for your website',
                'Scan the site and detect existing schema',
                'Review and confirm extracted details',
                'Generate and validate connected JSON-LD',
                'Copy or download and follow install steps',
                'Verify the schema is live on your page',
              ].map((step) => (
                <li key={step} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} LocalSchema AI. Structured data that helps search engines
        understand your business.
      </footer>
    </div>
  );
}
