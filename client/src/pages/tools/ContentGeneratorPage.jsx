import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Copy, Download, FileText, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';

import { seoApi } from '@/api/seo';
import { toApiError } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PAGE_TYPE_OPTIONS, TONE_OPTIONS, contentFormSchema } from '@/schemas/seo.schema';

/** Turns the structured draft into plain text for copy/download. */
function contentToText(content) {
  const lines = [
    `Title: ${content.metaTitle}`,
    `Meta description: ${content.metaDescription}`,
    '',
    `# ${content.h1}`,
    '',
    ...content.sections.flatMap((section) => [`## ${section.heading}`, section.body, '']),
  ];
  return lines.join('\n').trim();
}

export default function ContentGeneratorPage() {
  const location = useLocation();
  // Prefill from the keyword tool hand-off, if present.
  const handoff = location.state ?? {};

  const { data: capabilities } = useQuery({
    queryKey: ['seo', 'capabilities'],
    queryFn: seoApi.capabilities,
  });

  const form = useForm({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      businessName: handoff.businessName ?? '',
      category: handoff.category ?? '',
      location: handoff.location ?? '',
      pageType: 'homepage',
      keywords: Array.isArray(handoff.keywords) ? handoff.keywords.join(', ') : '',
      tone: 'professional',
      details: '',
    },
  });
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const values = watch();

  const mutation = useMutation({
    mutationFn: (payload) => seoApi.content(payload),
    onSuccess: () => toast.success('Page content generated.'),
    onError: (error) => toast.error(toApiError(error).message),
  });

  const errorInfo = mutation.isError ? toApiError(mutation.error) : null;
  const result = mutation.data;

  const onSubmit = (formValues) => {
    // Backend accepts a comma-separated string or an array; send the string.
    mutation.mutate({ ...formValues, keywords: formValues.keywords });
  };

  const copyText = async (text, label) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied.`);
  };

  const download = () => {
    const blob = new Blob([contentToText(result.content)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${values.pageType || 'page'}-content.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6 flex items-start gap-4">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
          <PenLine className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Page content writer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Draft SEO page content built around your target keywords. It&apos;s a draft to review —
            we never invent facts about your business.
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
              two-up grid would squeeze each field. */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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
              <Field id="location" label="Location" error={errors.location?.message} hint="Optional">
                <Input placeholder="London, UK" {...register('location')} />
              </Field>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                The page
              </p>

              {/* Two short selects pair comfortably even at this width. */}
              <div className="grid grid-cols-2 gap-3">
                <Field id="pageType" label="Page type" error={errors.pageType?.message}>
                  <Select value={values.pageType} onValueChange={(v) => setValue('pageType', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="tone" label="Tone" error={errors.tone?.message}>
                  <Select value={values.tone} onValueChange={(v) => setValue('tone', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field
                id="keywords"
                label="Target keywords"
                error={errors.keywords?.message}
                hint="Comma-separated. Prefilled if you came from keyword research."
                required
              >
                <Textarea rows={2} placeholder="italian restaurant london, best pizza london" {...register('keywords')} />
              </Field>

              <Field
                id="details"
                label="Real details to include"
                error={errors.details?.message}
                hint="Optional — nothing gets invented beyond what you put here."
              >
                <Textarea rows={3} placeholder="Family-run since 1998, wood-fired oven, outdoor terrace." {...register('details')} />
              </Field>
            </div>

            <Button type="submit" size="lg" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
              {mutation.isPending ? 'Writing…' : 'Generate content'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results column */}
      <div>
      {errorInfo && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Couldn&apos;t generate content</AlertTitle>
          <AlertDescription>
            <p>{errorInfo.message}</p>
            <p className="mt-2 text-xs opacity-80">Error code: <code>{errorInfo.code}</code></p>
          </AlertDescription>
        </Alert>
      )}

      {!result && !errorInfo && !mutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold">Your page content will appear here</h3>
            <p className="max-w-sm text-xs text-muted-foreground">
              Fill in the business and target keywords on the left. You&apos;ll get meta tags, an
              H1, and ready-to-edit sections.
            </p>
          </CardContent>
        </Card>
      )}

      {mutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Writing your page content…</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Draft content
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copyText(contentToText(result.content), 'Content')}>
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={download}>
                <Download className="h-4 w-4" /> .md
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <MetaField label="Meta title" value={result.content.metaTitle} onCopy={copyText} />
            <MetaField label="Meta description" value={result.content.metaDescription} onCopy={copyText} />

            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">H1</p>
              <h2 className="text-xl font-semibold">{result.content.h1}</h2>
            </div>

            <div className="space-y-4">
              {result.content.sections.map((section, index) => (
                <div key={index} className="rounded-lg border border-border p-4">
                  <h3 className="font-semibold">{section.heading}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{section.body}</p>
                </div>
              ))}
            </div>

            {result.content.keywordsUsed?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Keywords used:</span>
                {result.content.keywordsUsed.map((keyword) => (
                  <Badge key={keyword} variant="secondary">
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">{result.note}</p>
          </CardContent>
        </Card>
      )}
      </div>
      </div>
    </div>
  );
}

function MetaField({ label, value, onCopy }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label} · {value.length} chars
        </p>
        <button
          type="button"
          onClick={() => onCopy(value, label)}
          className="text-xs text-primary hover:underline"
        >
          Copy
        </button>
      </div>
      <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">{value}</p>
    </div>
  );
}
