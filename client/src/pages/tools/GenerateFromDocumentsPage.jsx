import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { schemaGenApi } from '@/api/schemaGen';
import { toApiError } from '@/api/client';
import { PageHeader } from '@/components/common/PageHeader';
import { FileDropzone } from '@/components/forms/FileDropzone';
import { JsonLdResult } from '@/components/schema/JsonLdResult';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
      toast.success('Schema generated.');
    },
    onError: (error) => {
      const parsed = toApiError(error);
      if (parsed.code === 'AI_NOT_CONFIGURED') {
        toast.error('AI generation is not configured on the server.');
      } else {
        toast.error(parsed.message);
      }
    },
  });

  const canSubmit = (files.length > 0 || notes.trim().length > 0) && !mutation.isPending;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Generate schema from documents"
        description="Upload business documents or paste details, and we'll generate validated JSON-LD. We never invent data — missing fields are simply left out."
      />

      {capabilities && !capabilities.aiConfigured && (
        <Alert variant="warning" className="mb-6">
          <AlertTitle>AI generation isn&apos;t configured yet</AlertTitle>
          <AlertDescription>
            The server needs an OpenAI API key (set <code>OPENAI_API_KEY</code> in the server
            environment). Uploading and parsing still work, but generation will return an error until
            the key is set.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FileDropzone
              files={files}
              onChange={setFiles}
              onReject={(reasons) => toast.error(reasons.join(' · '))}
              disabled={mutation.isPending}
            />

            <div className="space-y-1.5">
              <Label htmlFor="notes">Additional business details (optional)</Label>
              <Textarea
                id="notes"
                rows={5}
                value={notes}
                disabled={mutation.isPending}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. Sharma's Kitchen, a North Indian restaurant at 12 MG Road, Jodhpur, Rajasthan 342001, India. Phone +91 9876543210. Open Mon-Sat 11am-11pm. Website sharmaskitchen.in."
              />
              <p className="text-xs text-muted-foreground">
                Only include real details. Anything you don&apos;t provide is left out of the schema.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate JSON-LD
              </Button>
            </div>
          </CardContent>
        </Card>

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

        {result && <JsonLdResult result={result} />}
      </div>
    </div>
  );
}
