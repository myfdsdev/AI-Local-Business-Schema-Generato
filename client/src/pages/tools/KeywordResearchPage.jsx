import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Copy, Loader2, PenLine, Search } from 'lucide-react';
import { toast } from 'sonner';

import { seoApi } from '@/api/seo';
import { toApiError } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { INTENT_VARIANT, PRIORITY_VARIANT, keywordFormSchema } from '@/schemas/seo.schema';

/**
 * Local-SEO keyword research. Suggests keyword ideas (not search-volume data)
 * and lets the user select some to hand off to the content generator.
 */
export default function KeywordResearchPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const { data: capabilities } = useQuery({
    queryKey: ['seo', 'capabilities'],
    queryFn: seoApi.capabilities,
  });

  const form = useForm({
    resolver: zodResolver(keywordFormSchema),
    defaultValues: { businessName: '', category: '', location: '', website: '', services: '', seedKeywords: '' },
  });
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = form;

  const mutation = useMutation({
    mutationFn: (values) => seoApi.keywords(values),
    onSuccess: (data) => {
      setResult(data);
      setSelected(new Set());
      toast.success(`${data.count} keyword ideas generated.`);
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  const errorInfo = mutation.isError ? toApiError(mutation.error) : null;

  const toggle = (keyword) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });

  const copyAll = async () => {
    const text = result.keywords.map((k) => k.keyword).join('\n');
    await navigator.clipboard.writeText(text);
    toast.success('All keywords copied.');
  };

  const writeContent = () => {
    const keywords = [...selected];
    const { businessName, category, location } = getValues();
    navigate('/app/content', { state: { keywords, businessName, category, location } });
  };

  return (
    <div>
      <div className="mb-6 flex items-start gap-4">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
          <Search className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Keyword research</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Get local-SEO keyword ideas for a business, then hand the best ones to the content
            writer. These are AI-suggested ideas — not search-volume data.
          </p>
        </div>
      </div>

      {capabilities && !capabilities.aiConfigured && (
        <Alert variant="warning" className="mb-6">
          <AlertTitle>AI isn&apos;t configured yet</AlertTitle>
          <AlertDescription>
            Set the active provider&apos;s API key (
            <code>{capabilities.aiProvider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'}</code>) on
            the server to use this tool.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)] xl:items-start">
        <Card className="xl:sticky xl:top-24">
        <CardContent className="p-6">
          {/* Single column: this card sits in a 480px sticky column, so a
              two-up grid would squeeze each field to ~215px. */}
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-5" noValidate>
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                About the business
              </p>
              <Field id="businessName" label="Business name" error={errors.businessName?.message} required>
                <Input placeholder="Bella Vista Trattoria" {...register('businessName')} />
              </Field>
              <Field id="category" label="Category" error={errors.category?.message} required>
                <Input placeholder="Italian restaurant" {...register('category')} />
              </Field>
              <Field id="location" label="Location" error={errors.location?.message} hint="City or region — drives local keywords">
                <Input placeholder="London, UK" {...register('location')} />
              </Field>
              <Field id="website" label="Website" error={errors.website?.message} hint="Optional">
                <Input placeholder="bellavista.com" {...register('website')} />
              </Field>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fine-tune <span className="normal-case font-normal">(optional)</span>
              </p>
              <Field
                id="services"
                label="Key services or products"
                error={errors.services?.message}
                hint="Comma-separated"
              >
                <Input placeholder="dine-in, takeaway, catering, private dining" {...register('services')} />
              </Field>
              <Field
                id="seedKeywords"
                label="Seed keywords to expand on"
                error={errors.seedKeywords?.message}
                hint="Terms you already know you want to rank for"
              >
                <Input placeholder="wood-fired pizza, family restaurant" {...register('seedKeywords')} />
              </Field>
            </div>

            <Button type="submit" size="lg" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {mutation.isPending ? 'Researching…' : 'Find keywords'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results column */}
      <div>
      {errorInfo && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Couldn&apos;t research keywords</AlertTitle>
          <AlertDescription>
            <p>{errorInfo.message}</p>
            <p className="mt-2 text-xs opacity-80">Error code: <code>{errorInfo.code}</code></p>
          </AlertDescription>
        </Alert>
      )}

      {mutation.isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!result && !errorInfo && !mutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold">Your keyword ideas will appear here</h3>
            <p className="max-w-sm text-xs text-muted-foreground">
              Describe the business on the left, then pick the keywords you want and send them
              straight to the content writer.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {result.count} ideas · {selected.size} selected
            </p>
            <Button variant="outline" size="sm" onClick={copyAll}>
              <Copy className="h-4 w-4" />
              Copy all
            </Button>
          </div>

          {result.grouped.map((group) => (
            <Card key={group.theme}>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-semibold capitalize">{group.theme}</h3>
                <div className="flex flex-wrap gap-2">
                  {group.keywords.map((item) => {
                    const active = selected.has(item.keyword);
                    return (
                      <button
                        key={item.keyword}
                        type="button"
                        onClick={() => toggle(item.keyword)}
                        title={item.rationale}
                        className={cn(
                          'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/40 hover:bg-accent',
                        )}
                      >
                        <span>{item.keyword}</span>
                        <Badge variant={INTENT_VARIANT[item.intent] ?? 'secondary'} className="px-1.5 py-0 text-[10px]">
                          {item.intent}
                        </Badge>
                        <Badge variant={PRIORITY_VARIANT[item.priority] ?? 'outline'} className="px-1.5 py-0 text-[10px]">
                          {item.priority}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          <p className="text-xs text-muted-foreground">{result.note}</p>

          {selected.size > 0 && (
            <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card p-3 shadow-md">
              <span className="text-sm font-medium">{selected.size} keyword(s) selected</span>
              <Button onClick={writeContent}>
                <PenLine className="h-4 w-4" />
                Write page content
              </Button>
            </div>
          )}
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
