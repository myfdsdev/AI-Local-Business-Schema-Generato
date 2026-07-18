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
    <div className="mx-auto max-w-3xl">
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

      <Card className="mb-6">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="businessName" label="Business name" error={errors.businessName?.message} required>
                <Input placeholder="Sharma's Kitchen" {...register('businessName')} />
              </Field>
              <Field id="category" label="Category" error={errors.category?.message} required>
                <Input placeholder="North Indian restaurant" {...register('category')} />
              </Field>
              <Field id="location" label="Location" error={errors.location?.message} hint="City / region">
                <Input placeholder="Jodhpur, Rajasthan" {...register('location')} />
              </Field>
              <Field id="website" label="Website" error={errors.website?.message}>
                <Input placeholder="sharmaskitchen.in" {...register('website')} />
              </Field>
            </div>
            <Field id="services" label="Key services / products" error={errors.services?.message} hint="Optional, comma-separated">
              <Input placeholder="dine-in, home delivery, catering, thali" {...register('services')} />
            </Field>
            <Field id="seedKeywords" label="Seed keywords to expand on" error={errors.seedKeywords?.message} hint="Optional">
              <Input placeholder="best thali, veg restaurant" {...register('seedKeywords')} />
            </Field>

            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={mutation.isPending} className="w-full sm:w-auto">
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {mutation.isPending ? 'Researching…' : 'Find keywords'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
  );
}
