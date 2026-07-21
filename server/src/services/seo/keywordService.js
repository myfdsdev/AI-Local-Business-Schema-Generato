import ApiError from '../../utils/ApiError.js';
import { extractJson } from '../../utils/jsonExtract.js';
import { keywordResponseSchema } from '../../validators/seo.validators.js';
import { activeProvider, chatJson } from '../ai/aiClient.js';
import { KEYWORD_SYSTEM_PROMPT } from '../ai/keywordPrompt.js';

/**
 * Local-SEO keyword research.
 *
 * Today the ideas come from the AI provider. The AI call is deliberately the
 * only source-specific part of this function: to plug in a real keyword-data
 * API later (SEMrush/Ahrefs/DataForSEO for true volumes/difficulty), swap the
 * block marked below and keep the same return shape. The `source` field records
 * which was used.
 */
function buildUserContent({ businessName, category, location, services, language }) {
  const lines = [
    `Business name: ${businessName}`,
    `Category: ${category}`,
    location && `Location: ${location}`,
    services && `Services, products, or terms to focus on: ${services}`,
    `Language: ${language || 'en'}`,
  ].filter(Boolean);

  return lines.join('\n');
}

export async function researchKeywords(input) {
  const userContent = buildUserContent(input);

  // --- Source: AI provider (swap here for a real keyword-data API) ----------
  const completion = await chatJson({
    system: KEYWORD_SYSTEM_PROMPT,
    user: userContent,
    maxTokens: 4000,
  });

  const parsed = extractJson(completion.content);
  const validated = keywordResponseSchema.safeParse(parsed);
  // --------------------------------------------------------------------------

  if (!validated.success) {
    throw new ApiError(502, 'The AI returned keyword data we could not read. Please try again.', {
      code: 'AI_RESPONSE_INVALID',
      errors: validated.error?.issues?.slice(0, 5).map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })) ?? [],
    });
  }

  const { keywords } = validated.data;

  // Convenience grouping for the UI; the flat list is the source of truth.
  const themes = {};
  for (const keyword of keywords) {
    (themes[keyword.theme] ??= []).push(keyword);
  }
  const grouped = Object.entries(themes).map(([theme, items]) => ({ theme, keywords: items }));

  return {
    keywords,
    grouped,
    count: keywords.length,
    source: 'ai_suggested',
    provider: activeProvider(),
    model: completion.model,
    // Honest disclaimer surfaced by the UI.
    note: 'These are AI-suggested keyword ideas, not search-volume data. Validate priorities with a keyword tool before committing budget.',
  };
}

export default { researchKeywords };
