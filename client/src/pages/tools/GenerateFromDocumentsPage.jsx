import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileSearch, FileUp, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { schemaGenApi } from '@/api/schemaGen';
import { toApiError } from '@/api/client';
import { FileDropzone } from '@/components/forms/FileDropzone';
import { JsonLdResult } from '@/components/schema/JsonLdResult';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const STEPS = [
  { icon: FileUp, title: 'Add your info', text: 'Upload documents or paste business details.' },
  { icon: Wand2, title: 'Generate', text: 'We extract real details and build the schema.' },
  { icon: CheckCircle2, title: 'Copy & install', text: 'Validated JSON-LD, ready to paste on your site.' },
];

/**
 * Upload business documents (and/or paste details) and generate validated
 * JSON-LD. Documents are parsed on the server; the AI output is run through
 * AJV before it reaches this screen.
 */
export default function GenerateFromDocumentsPage() {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState(null);

  const { data: capabilities } = useQuery({
    queryKey: ['schema-generator', 'capabilities'],
    queryFn: schemaGenApi.capabilities,
  });

  const mutation = useMutation({
    mutationFn: () => schemaGenApi.generate({ files, notes }),
    onSuccess: (data) => {
      setResult(data);
      if (data.sources?.failures?.length) {
        toast.warning(`${data.sources.failures.length} file(s) could not be read.`);
      }
      if (data.hasBusinessData === false) toast.message('No business details found in what you provided.');
      else toast.success('Schema generated.');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  // Full error surfaced inline; a toast is easy to miss and the details
  // (provider message, request id) are what actually explain a failure.
  const errorInfo = mutation.isError ? toApiError(mutation.error) : null;
  const canSubmit = (files.length > 0 || notes.trim().length > 0) && !mutation.isPending;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Generate schema from documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload business documents or paste details, and we&apos;ll generate validated JSON-LD.
            We never invent data — missing fields are simply left out.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <div key={title} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {index + 1}. {title}
              </p>
              <p className="text-xs text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </div>

      {capabilities && !capabilities.aiConfigured && (
        <Alert variant="warning" className="mb-6">
          <AlertTitle>AI generation isn&apos;t configured yet</AlertTitle>
          <AlertDescription>
            The server needs an API key for the active provider (
            <code>{capabilities.aiProvider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'}</code>{' '}
            in the server environment). Uploading and parsing still work, but generation returns an
            error until the key is set.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5 p-6">
            <div>
              <Label className="text-sm font-semibold">Upload documents</Label>
              <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
                About page, business profile, menu, flyer — anything with your real details.
              </p>
              <FileDropzone
                files={files}
                onChange={setFiles}
                onReject={(reasons) => toast.error(reasons.join(' · '))}
                disabled={mutation.isPending}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">and / or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-sm font-semibold">
                Type business details
              </Label>
              <Textarea
                id="notes"
                rows={5}
                value={notes}
                disabled={mutation.isPending}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. Sharma's Kitchen, a North Indian restaurant at 12 MG Road, Jodhpur, Rajasthan 342001, India. Phone +91 9876543210. Open Mon-Sat 11am-11pm. Website sharmaskitchen.in."
              />
              <p className="text-xs text-muted-foreground">
                Include the business name, address, phone, hours, and website. Only real details —
                anything you don&apos;t provide is left out.
              </p>
            </div>

            <Button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit}
              size="lg"
              className="w-full sm:w-auto"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {mutation.isPending ? 'Generating…' : 'Generate JSON-LD'}
            </Button>
          </CardContent>
        </Card>

        {errorInfo && (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t generate the schema</AlertTitle>
            <AlertDescription>
              <p>{errorInfo.message}</p>
              {errorInfo.errors?.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                  {errorInfo.errors.map((item, index) => (
                    <li key={index}>{item.message || JSON.stringify(item)}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs opacity-80">
                Error code: <code>{errorInfo.code}</code>
                {errorInfo.status ? ` · HTTP ${errorInfo.status}` : ''}
                {mutation.error?.response?.data?.requestId
                  ? ` · request ${mutation.error.response.data.requestId}`
                  : ''}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {result?.sources?.documents?.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Read {result.sources.documents.length} document(s):{' '}
            {result.sources.documents.map((doc) => doc.filename).join(', ')}
            {result.sources.failures?.length > 0 && (
              <span className="text-destructive">
                {' '}· couldn&apos;t read: {result.sources.failures.map((failure) => failure.filename).join(', ')}
              </span>
            )}
          </p>
        )}

        {/* No business found: guidance instead of an empty object + errors. Only
            when the server explicitly reports it, so an older server response
            (no field) still falls through to the result view. */}
        {result && result.hasBusinessData === false && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning-foreground">
                <FileSearch className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">No business details found</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                What you provided didn&apos;t contain the details we need — a business name, address,
                phone number, or opening hours. We only build schema from real information we can
                find, and never make it up, so there was nothing to generate.
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Try a document that describes your business (an About page, business profile, or
                flyer), or type the details in the box above and generate again.
              </p>
            </CardContent>
          </Card>
        )}

        {result && result.hasBusinessData !== false && <JsonLdResult result={result} />}
      </div>
    </div>
  );
}
