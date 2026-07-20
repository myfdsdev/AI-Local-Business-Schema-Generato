import { AlertTriangle, CheckCircle2, FileCode, Globe, Loader2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Human labels for the server's SCAN_STEPS values. */
const STEP_LABELS = {
  preparing_scan: 'Preparing scan',
  reading_homepage: 'Reading homepage',
  discovering_pages: 'Discovering pages',
  extracting_business_information: 'Extracting business information',
  detecting_existing_schema: 'Detecting existing schema',
  generating_recommendations: 'Generating recommendations',
  validating_results: 'Validating results',
  scan_completed: 'Scan complete',
};

const isRunning = (scan) => scan && (scan.status === 'queued' || scan.status === 'running');

export function ScanPanel({ scan }) {
  if (!scan) return null;

  if (isRunning(scan)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Scanning your website
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${scan.progress ?? 0}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {STEP_LABELS[scan.currentStep] ?? scan.currentStep}
            {scan.scannedPages?.length > 0 && ` · ${scan.scannedPages.length} page(s) read`}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (scan.status === 'failed') {
    return (
      <Alert variant="destructive">
        <AlertTitle>Scan failed</AlertTitle>
        <AlertDescription>
          <p>{scan.errors?.[0]?.message ?? 'The scan could not be completed.'}</p>
          <p className="mt-2 text-xs opacity-80">Your scan credit was refunded.</p>
        </AlertDescription>
      </Alert>
    );
  }

  const business = scan.extractedBusinessData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Scan complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Pages read" value={scan.scannedPages?.length ?? 0} />
            <Stat label="Existing schema found" value={scan.detectedSchemas?.length ?? 0} />
            <Stat label="Pages skipped" value={scan.failedPages?.length ?? 0} />
          </div>

          {scan.scannedPages?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pages read
              </p>
              <ul className="space-y-1.5">
                {scan.scannedPages.map((page) => (
                  <li key={page.url} className="flex items-center gap-2 text-sm">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{page.title || page.url}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {page.pageType}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {scan.warnings?.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {scan.warnings.map((warning, index) => (
                  <p key={index}>{warning.message}</p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {scan.detectedSchemas?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCode className="h-4 w-4" />
              Schema already on the site
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {scan.detectedSchemas.map((item, index) => (
                <Badge key={`${item.type}-${index}`} variant="outline">
                  {item.type}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business details found</CardTitle>
        </CardHeader>
        <CardContent>
          {business && Object.keys(business).length > 0 ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                {Object.entries(business).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{key}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                Read directly from your website — nothing here was invented. Check it before using it
                in schema.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No business details could be read from the crawled pages.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className={cn('rounded-lg border border-border p-3')}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">{value}</p>
    </div>
  );
}

export default ScanPanel;
