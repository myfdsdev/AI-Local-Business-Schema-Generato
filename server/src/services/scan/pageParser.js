import * as cheerio from 'cheerio';

import { PAGE_TYPES } from '../../config/constants.js';
import { isSameSite } from '../../utils/url.js';

const MAX_TEXT_CHARS = 12_000;

/** URL/title hints that map a page onto the spec's PAGE_TYPES list. */
const TYPE_HINTS = [
  { type: 'contact', patterns: [/contact/i, /get-in-touch/i, /reach-us/i] },
  { type: 'about', patterns: [/about/i, /our-story/i, /who-we-are/i] },
  { type: 'services', patterns: [/services?/i, /what-we-do/i, /treatments?/i, /menu/i] },
  { type: 'locations', patterns: [/locations?/i, /branches?/i, /stores?/i, /find-us/i] },
  { type: 'faq', patterns: [/faqs?/i, /questions/i] },
  { type: 'products', patterns: [/products?/i, /shop/i, /catalog/i] },
  { type: 'blog', patterns: [/blog/i, /news/i, /articles?/i] },
];

export function classifyPage(url, isHomepage = false) {
  if (isHomepage) return 'homepage';

  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    path = String(url);
  }
  if (path === '/' || path === '') return 'homepage';

  for (const { type, patterns } of TYPE_HINTS) {
    if (patterns.some((pattern) => pattern.test(path))) return type;
  }
  return PAGE_TYPES.includes('about') ? 'about' : PAGE_TYPES[0];
}

/**
 * Extracts everything the scan needs from one HTML document: readable text,
 * metadata, any structured data already on the page, and same-site links to
 * continue the crawl.
 */
export function parsePage(html, pageUrl) {
  const $ = cheerio.load(html);

  const title = $('title').first().text().trim();
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() ?? '';

  // Structured data the site already publishes. Read BEFORE scripts are
  // stripped. Parsed leniently: a broken block on their page must not fail our
  // scan, so it is recorded as unparseable instead.
  const detectedSchemas = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    const raw = $(element).text();
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const graph = node?.['@graph'] ?? node;
        for (const item of Array.isArray(graph) ? graph : [graph]) {
          if (item && typeof item === 'object') {
            detectedSchemas.push({
              type: String(item['@type'] ?? 'Unknown'),
              format: 'json-ld',
              url: pageUrl,
              raw: JSON.stringify(item).slice(0, 4000),
            });
          }
        }
      }
    } catch {
      detectedSchemas.push({ type: 'Unparseable', format: 'json-ld', url: pageUrl, raw: raw.slice(0, 500) });
    }
  });

  // Same-site links only — the scan is limited to the approved domain.
  const links = new Set();
  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return;

    try {
      const resolved = new URL(href, pageUrl);
      resolved.hash = '';
      if (isSameSite(resolved.toString(), pageUrl)) links.add(resolved.toString());
    } catch {
      /* skip unparseable hrefs */
    }
  });

  // Strip non-readable elements last, so the text is human content only.
  $('script, style, noscript, svg, iframe, template').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS);

  return { title, metaDescription, text, detectedSchemas, links: [...links] };
}

export default { parsePage, classifyPage };
