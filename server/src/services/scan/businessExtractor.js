import logger from '../../config/logger.js';
import { extractJson } from '../../utils/jsonExtract.js';
import { chatJson, isAiConfigured } from '../ai/aiClient.js';

const MAX_CHARS_PER_PAGE = 4000;
const MAX_TOTAL_CHARS = 18_000;

const EXTRACTION_PROMPT = `You extract factual business information from the text of a company's own website.

## OUTPUT RULES (non-negotiable)
1. Output ONLY a JSON object, parseable by JSON.parse(). No markdown fences, no commentary.
2. NEVER invent, guess or infer anything. Only report details that literally appear in the supplied page text.
3. Omit any field you cannot find. Do NOT use placeholders, empty strings, "N/A" or example values.
4. Do not fabricate ratings, review counts, prices or awards under any circumstance.

## SHAPE (include only the fields you actually found)
{
  "name": "string",
  "description": "string, one or two sentences taken from the site",
  "telephone": "string exactly as written on the site",
  "email": "string",
  "address": { "streetAddress": "", "addressLocality": "", "addressRegion": "", "postalCode": "", "addressCountry": "ISO 3166-1 alpha-2" },
  "openingHours": ["e.g. Mo-Fr 09:00-17:00"],
  "sameAs": ["social profile URLs found on the site"],
  "priceRange": "string",
  "suggestedType": "the most specific schema.org LocalBusiness subtype the text supports"
}

Return {} if the text contains no business facts at all.`;

function buildUserContent({ project, pages }) {
  const header = [
    `Website: ${project.websiteUrl}`,
    `Business name on file: ${project.businessName}`,
    project.businessType && `Business type on file: ${project.businessType}`,
    project.country && `Country on file: ${project.country}`,
    '',
    'Page text follows. Only use facts that appear here.',
  ]
    .filter(Boolean)
    .join('\n');

  let budget = MAX_TOTAL_CHARS;
  const blocks = [];

  for (const page of pages) {
    if (budget <= 0) break;
    const slice = page.text.slice(0, Math.min(MAX_CHARS_PER_PAGE, budget));
    if (!slice.trim()) continue;
    budget -= slice.length;
    blocks.push(`--- ${page.url}${page.title ? ` (${page.title})` : ''} ---\n${slice}`);
  }

  return `${header}\n\n${blocks.join('\n\n')}`;
}

/**
 * Turns crawled page text into structured business data.
 *
 * Everything here is extraction, never generation: the prompt forbids inventing
 * fields, and anything the model returns is still presented to the user as
 * unconfirmed until they approve it.
 */
export async function extractBusinessData({ project, pages }) {
  if (!isAiConfigured()) {
    return {
      businessData: null,
      warnings: ['AI is not configured, so business details were not extracted from the crawled pages.'],
    };
  }

  const usable = pages.filter((page) => page.text?.trim());
  if (usable.length === 0) {
    return { businessData: null, warnings: ['No readable text was found on the crawled pages.'] };
  }

  try {
    const completion = await chatJson({
      system: EXTRACTION_PROMPT,
      user: buildUserContent({ project, pages: usable }),
      maxTokens: 2000,
    });

    const parsed = extractJson(completion.content);
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
      return { businessData: null, warnings: ['No business details could be read from the crawled pages.'] };
    }

    return { businessData: parsed, warnings: [] };
  } catch (error) {
    // A failed extraction must not fail the whole crawl — the pages and any
    // detected schema are still worth keeping.
    logger.error('Business extraction failed', { message: error.message });
    return { businessData: null, warnings: [`Business details could not be extracted: ${error.message}`] };
  }
}

export default { extractBusinessData };
