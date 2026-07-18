import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Download, Info, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Renders a generated JSON-LD result: validation status, the code with copy /
 * download, and honest (non-guaranteed) recommendations. Issues are always
 * shown alongside the output — invalid schema is never hidden.
 */
export function JsonLdResult({ result }) {
  const [copied, setCopied] = useState(false);
  const jsonString = result.jsonLdString ?? JSON.stringify(result.jsonLd ?? {}, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast.success('JSON-LD copied to clipboard.');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy. Select and copy manually.');
    }
  };

  const download = (asHtml) => {
    const content = asHtml
      ? `<script type="application/ld+json">\n${jsonString}\n</script>\n`
      : jsonString;
    const blob = new Blob([content], { type: asHtml ? 'text/html' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = asHtml ? 'schema.html' : 'schema.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle>Generated JSON-LD</CardTitle>
          {result.valid ? (
            <Badge variant="success">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Valid
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="mr-1 h-3 w-3" /> Has errors
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => download(false)}>
            <Download className="h-4 w-4" />
            .json
          </Button>
          <Button variant="outline" size="sm" onClick={() => download(true)}>
            <Download className="h-4 w-4" />
            .html
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <pre className="max-h-[28rem] overflow-auto rounded-lg bg-muted/60 p-4 text-xs leading-relaxed">
          <code>{jsonString}</code>
        </pre>

        {result.errors?.length > 0 && (
          <IssueList
            icon={XCircle}
            tone="text-destructive"
            title="Validation errors"
            items={result.errors.map((error) => error.message)}
          />
        )}
        {result.warnings?.length > 0 && (
          <IssueList
            icon={AlertTriangle}
            tone="text-warning-foreground"
            title="Warnings"
            items={result.warnings.map((warning) => warning.message)}
          />
        )}
        {result.recommendations?.length > 0 && (
          <IssueList
            icon={Info}
            tone="text-muted-foreground"
            title="Recommendations (not guaranteed Google outcomes)"
            items={result.recommendations.map((rec) => rec.message)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function IssueList({ icon: Icon, tone, title, items }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{title}</p>
      <ul className="space-y-1">
        {items.map((text, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
