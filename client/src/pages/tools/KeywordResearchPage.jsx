import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, Loader2, PenLine, Search } from 'lucide-react';
import { toast } from 'sonner';

import { seoApi } from '@/api/seo';
import { toApiError } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { INTENT_VARIANT, PRIORITY_VARIANT, keywordFormSchema } from '@/schemas/seo.schema';

/**
 * The form is asked one field at a time. Order matters: the two required
 * facts come first, so the user can generate after two answers if they want,
 * and the optional refinements follow.
 */
const STEPS = [
  {
    name: 'businessName',
    question: "What's the business called?",
    placeholder: 'Bella Vista Trattoria',
    required: true,
  },
  {
    name: 'category',
    question: 'What kind of business is it?',
    placeholder: 'Italian restaurant',
    hint: 'Be specific — "Italian restaurant" gives better keywords than "restaurant".',
    required: true,
  },
  {
    name: 'location',
    question: 'Where is it based?',
    placeholder: 'London, UK',
    hint: 'City or region. This is what makes the keywords local.',
  },
  {
    name: 'services',
    question: 'What should the keywords focus on?',
    placeholder: 'wood-fired pizza, takeaway, catering, private dining',
    hint: 'Services, products, or terms you already want to rank for. Each becomes its own keyword theme.',
  },
];

/**
 * Local-SEO keyword research. Suggests keyword ideas (not search-volume data)
 * and lets the user select some to hand off to the content generator.
 */
export default function KeywordResearchPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [step, setStep] = useState(0);

  const { data: capabilities } = useQuery({
    queryKey: ['seo', 'capabilities'],
    queryFn: seoApi.capabilities,
  });

  const form = useForm({
    resolver: zodResolver(keywordFormSchema),
    defaultValues: { businessName: '', category: '', location: '', services: '' },
  });
  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    watch,
    formState: { errors },
  } = form;

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const currentValue = watch(current.name) ?? '';
  // Required steps block progress until answered; optional ones never do.
  const canAdvance = !current.required || currentValue.trim().length >= 2;

  const goNext = async () => {
    // Validate only the field on screen, not the whole form.
    const valid = await trigger(current.name);
    if (!valid) return;
    if (!isLastStep) setStep((value) => value + 1);
  };

  const goBack = () => setStep((value) => Math.max(0, value - 1));

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
  // Until the form is submitted there is nothing to show on the right, so the
  // wizard stands alone and centred instead of sitting beside an empty panel.
  const showResults = Boolean(result) || mutation.isPending || Boolean(errorInfo);

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

      <div
        className={cn(
          showResults
            ? 'grid gap-6 xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)] xl:items-start'
            : 'mx-auto max-w-xl',
        )}
      >
        <Card className={cn(showResults && 'xl:sticky xl:top-24')}>
        <CardContent className="p-6">
          {/* One question at a time. Every field stays registered with the form
              the whole time, so nothing is lost when stepping back and forth. */}
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-5" noValidate>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Step {step + 1} of {STEPS.length}
                </span>
                {!current.required && <span>Optional</span>}
              </div>
              <div className="flex items-center gap-1.5" aria-hidden>
                {STEPS.map((item, index) => (
                  <div
                    key={item.name}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors',
                      index < step ? 'bg-primary' : index === step ? 'bg-primary/50' : 'bg-muted',
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Answers so far — click any to jump back and change it. */}
            {step > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {STEPS.slice(0, step).map((item, index) => {
                  const value = getValues(item.name);
                  if (!value?.trim()) return null;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setStep(index)}
                      title={`Edit: ${item.question}`}
                      className="max-w-full truncate rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Keyed so React remounts the input per step and autofocus fires. */}
            <div key={current.name} className="space-y-2">
              <label htmlFor={current.name} className="block text-lg font-semibold leading-snug tracking-tight">
                {current.question}
                {current.required && <span className="text-destructive"> *</span>}
              </label>

              <Input
                id={current.name}
                autoFocus
                // The input remounts on each step, so seed it from form state —
                // otherwise stepping Back would show an empty box.
                defaultValue={getValues(current.name)}
                placeholder={current.placeholder}
                onKeyDown={(event) => {
                  // Enter advances instead of submitting a half-filled form.
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (isLastStep) handleSubmit((values) => mutation.mutate(values))();
                    else if (canAdvance) goNext();
                  }
                }}
                {...register(current.name)}
              />

              {errors[current.name]?.message ? (
                <p className="text-xs text-destructive">{errors[current.name].message}</p>
              ) : (
                current.hint && <p className="text-xs text-muted-foreground">{current.hint}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={goBack} disabled={mutation.isPending}>
                  Back
                </Button>
              )}

              {isLastStep ? (
                <Button type="submit" disabled={mutation.isPending} className="flex-1">
                  {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {mutation.isPending ? 'Researching…' : 'Find keywords'}
                </Button>
              ) : (
                <Button type="button" onClick={goNext} disabled={!canAdvance} className="flex-1">
                  {current.required || currentValue.trim() ? 'Continue' : 'Skip'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Both required answers are in, so allow generating early. */}
            {!isLastStep && canAdvance && step >= 1 && (
              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Skip the rest and find keywords now
              </button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Results column — only mounted once there is something to show. */}
      {showResults && (
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
      )}
      </div>
    </div>
  );
}
