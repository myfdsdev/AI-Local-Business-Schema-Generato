import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { workspaceApi } from '@/api/workspace';
import { toApiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/utils';

/**
 * Mirrors server/src/services/ai/providers.js so the user sees which provider
 * was recognised the moment they paste. The server re-detects and is the
 * authority — this is only a hint.
 *
 * ORDER MATTERS, same as the server: "sk-ant-" and "sk-or-" are also matched by
 * OpenAI's broader "sk-", so they must be tested first.
 */
const SIGNATURES = [
  { provider: 'anthropic', label: 'Anthropic (Claude)', match: /^sk-ant-[A-Za-z0-9_-]{20,}$/ },
  { provider: 'openrouter', label: 'OpenRouter', match: /^sk-or-[A-Za-z0-9_-]{20,}$/ },
  { provider: 'groq', label: 'Groq', match: /^gsk_[A-Za-z0-9]{20,}$/ },
  { provider: 'gemini', label: 'Google Gemini', match: /^AIza[\w-]{30,}$/ },
  { provider: 'openai', label: 'OpenAI', match: /^sk-[A-Za-z0-9_-]{20,}$/ },
];

function detectProvider(key) {
  const value = key.trim();
  return SIGNATURES.find((signature) => signature.match.test(value)) ?? null;
}

const STATUS_META = {
  active: { label: 'Verified', variant: 'success', icon: CheckCircle2 },
  unverified: { label: 'Unverified', variant: 'secondary', icon: TriangleAlert },
  invalid: { label: 'Invalid', variant: 'destructive', icon: TriangleAlert },
};

export function ApiKeyPanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['workspace', 'api-key'],
    queryFn: workspaceApi.getApiKey,
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['workspace', 'api-key'] });
    // Capability flags across the app depend on which key is in play.
    queryClient.invalidateQueries({ queryKey: ['seo', 'capabilities'] });
    queryClient.invalidateQueries({ queryKey: ['assistant', 'capabilities'] });
  };

  const saveMutation = useMutation({
    mutationFn: (apiKey) => workspaceApi.saveApiKey({ apiKey }),
    onSuccess: (key) => {
      setDraft('');
      setReveal(false);
      invalidate();
      toast.success(
        key.status === 'active'
          ? `${key.providerLabel} key saved and verified.`
          : `${key.providerLabel} key saved. It could not be verified just now.`,
      );
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  const testMutation = useMutation({
    mutationFn: workspaceApi.testApiKey,
    onSuccess: (key) => {
      invalidate();
      if (key.status === 'active') toast.success('Key verified — AI features are live.');
      else toast.error('That key could not be verified. Check it is still active.');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: workspaceApi.deleteApiKey,
    onSuccess: () => {
      invalidate();
      toast.success('Key removed. This workspace now uses the shared platform key.');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  const stored = data?.key ?? null;
  const platform = data?.platformFallback;
  // Server-driven, so registering a provider backend-side surfaces it here.
  const supported = data?.providers ?? [];
  const detected = draft.trim() ? detectProvider(draft) : null;
  const busy = saveMutation.isPending || testMutation.isPending || deleteMutation.isPending;

  const onSubmit = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    saveMutation.mutate(draft.trim());
  };

  const statusMeta = stored ? (STATUS_META[stored.status] ?? STATUS_META.unverified) : null;
  const StatusIcon = statusMeta?.icon;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          AI provider key
        </CardTitle>
        {!isLoading && stored && (
          <Badge variant={statusMeta.variant} className="gap-1">
            {StatusIcon && <StatusIcon className="h-3 w-3" />}
            {statusMeta.label}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            {/* What this workspace is using right now. */}
            {stored ? (
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {stored.providerLabel}
                      <span className="ml-2 font-mono text-muted-foreground">
                        ••••••••{stored.last4}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {stored.model && <>Model {stored.model} · </>}
                      {stored.lastUsedAt
                        ? `Last used ${formatRelativeTime(stored.lastUsedAt)}`
                        : 'Not used yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testMutation.mutate()}
                      disabled={busy}
                    >
                      {testMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (window.confirm('Remove this key? AI features will fall back to the shared key.')) {
                          deleteMutation.mutate();
                        }
                      }}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {platform?.available
                  ? 'This workspace is using the shared platform key. Add your own to bill AI usage to your own provider account.'
                  : 'No AI key is set for this workspace yet. Paste one below to turn on the AI features.'}
              </div>
            )}

            {/* Paste / replace */}
            <form onSubmit={onSubmit} className="space-y-3">
              <Field
                id="apiKey"
                label={stored ? 'Replace key' : 'Paste your API key'}
                hint="Paste a key from any supported provider — we detect which one automatically."
              >
                <div className="relative">
                  <Input
                    type={reveal ? 'text' : 'password'}
                    className="pr-10 font-mono text-sm"
                    placeholder="sk-… or AIza…"
                    autoComplete="off"
                    spellCheck={false}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((value) => !value)}
                    aria-label={reveal ? 'Hide key' : 'Show key'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {/* Live feedback the moment something is pasted. */}
              {draft.trim() && (
                <p className="flex items-center gap-1.5 text-xs">
                  {detected ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-muted-foreground">
                        Detected <span className="font-medium text-foreground">{detected.label}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-muted-foreground">
                        Not a recognised OpenAI or Gemini key yet.
                      </span>
                    </>
                  )}
                </p>
              )}

              {/* Which providers this app accepts, driven by the server. */}
              {supported.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Supported:</span>
                  {supported.map((provider) => (
                    <Badge
                      key={provider.id}
                      variant={
                        detected?.provider === provider.id || stored?.provider === provider.id
                          ? 'default'
                          : 'outline'
                      }
                      className="font-normal"
                    >
                      {provider.label}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={!detected || busy}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {stored ? 'Replace key' : 'Save key'}
                </Button>
              </div>
            </form>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Your key is encrypted before it is stored and is never shown again or sent to your
                browser — only the last 4 characters. It is used solely for this workspace&apos;s own AI
                requests.
              </span>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ApiKeyPanel;
