import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';

import { fetchPage } from '../../src/services/scan/fetcher.js';
import { parsePage } from '../../src/services/scan/pageParser.js';

/**
 * The crawler fetches attacker-influenced URLs, so the SSRF guard is the most
 * safety-critical part of it. A public URL that 302s to localhost must be
 * refused — that is the classic bypass when redirects aren't re-validated.
 */
describe('scan fetcher SSRF guard', () => {
  let server;
  let port;

  before(async () => {
    // Serves a trivial page; the point is that it lives on loopback, which the
    // guard must refuse. Redirect hops are re-validated through this same
    // assertSafeUrl + DNS check (fetcher.js uses maxRedirects: 0 and loops),
    // but exercising a public→private redirect would need a real public host,
    // so that path is covered by construction rather than by this test.
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>ok</title></head><body>hello</body></html>');
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('refuses a direct loopback URL', async () => {
    const result = await fetchPage(`http://127.0.0.1:${port}/`);
    assert.equal(result.ok, false);
    assert.match(result.reason, /private|loopback|internal/i);
  });

  it('refuses cloud metadata addresses', async () => {
    const result = await fetchPage('http://169.254.169.254/latest/meta-data/');
    assert.equal(result.ok, false);
  });

  it('refuses non-http schemes', async () => {
    const result = await fetchPage('file:///etc/passwd');
    assert.equal(result.ok, false);
  });

  it('refuses a URL with embedded credentials', async () => {
    const result = await fetchPage('http://user:pass@example.com/');
    assert.equal(result.ok, false);
  });
});

describe('page parser', () => {
  const HTML = `
    <html><head>
      <title>Bella Vista Trattoria</title>
      <meta name="description" content="Italian restaurant in London">
      <script type="application/ld+json">{"@type":"Restaurant","name":"Bella Vista"}</script>
      <script type="application/ld+json">{ broken json </script>
    </head><body>
      <script>var tracking = 1;</script>
      <style>.a{color:red}</style>
      <p>Open Mon-Sat. Call +44 20 7946 0958.</p>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <a href="https://other-site.example/page">External</a>
      <a href="mailto:hi@example.com">Mail</a>
    </body></html>`;

  const parsed = parsePage(HTML, 'https://bellavista.example/');

  it('extracts title and meta description', () => {
    assert.equal(parsed.title, 'Bella Vista Trattoria');
    assert.equal(parsed.metaDescription, 'Italian restaurant in London');
  });

  it('detects existing JSON-LD and records unparseable blocks without throwing', () => {
    assert.equal(parsed.detectedSchemas.length, 2);
    assert.equal(parsed.detectedSchemas[0].type, 'Restaurant');
    assert.equal(parsed.detectedSchemas[1].type, 'Unparseable');
  });

  it('keeps only same-site links and drops mailto/external', () => {
    assert.ok(parsed.links.some((link) => link.endsWith('/about')));
    assert.ok(parsed.links.some((link) => link.endsWith('/contact')));
    assert.ok(!parsed.links.some((link) => link.includes('other-site.example')));
    assert.ok(!parsed.links.some((link) => link.startsWith('mailto:')));
  });

  it('strips script and style content from the readable text', () => {
    assert.ok(parsed.text.includes('Open Mon-Sat'));
    assert.ok(!parsed.text.includes('var tracking'));
    assert.ok(!parsed.text.includes('color:red'));
  });
});
