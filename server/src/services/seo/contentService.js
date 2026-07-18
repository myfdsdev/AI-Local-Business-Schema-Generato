import ApiError from '../../utils/ApiError.js';
import { extractJson } from '../../utils/jsonExtract.js';
import { contentResponseSchema } from '../../validators/seo.validators.js';
import { activeProvider, chatJson } from '../ai/aiClient.js';
import { CONTENT_SYSTEM_PROMPT } from '../ai/contentPrompt.js';

const PAGE_TYPE_LABELS = {
  homepage: 'Homepage',
  service: 'Service page',
  about: 'About page',
  contact: 'Contact page',
  location: 'Location page',
  faq: 'FAQ page',
};

function buildUserContent({ businessName, category, location, pageType, keywords, details, tone }) {
  const lines = [
    `Page type: ${PAGE_TYPE_LABELS[pageType] ?? pageType}`,
    `Business name: ${businessName}`,
    `Category: ${category}`,
    location && `Location: ${location}`,
    `Target keywords: ${keywords.join(', ')}`,
    `Tone: ${tone}`,
    details && `Additional real details to use (do not invent beyond these): ${details}`,
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Generates a page-content draft built around the chosen keywords. The output
 * is Zod-validated (spec: validate every AI response) before it is returned,
 * and is explicitly a draft for the user to review — no facts are invented.
 */
export async function generateContent(input) {
  const userContent = buildUserContent(input);

  const completion = await chatJson({
    system: CONTENT_SYSTEM_PROMPT,
    user: userContent,
    maxTokens: 4000,
  });

  const parsed = extractJson(completion.content);
  const validated = contentResponseSchema.safeParse(parsed);

  if (!validated.success) {
    throw new ApiError(502, 'The AI returned content we could not read. Please try again.', {
      code: 'AI_RESPONSE_INVALID',
      errors: validated.error?.issues?.slice(0, 5).map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })) ?? [],
    });
  }

  return {
    content: validated.data,
    pageType: input.pageType,
    targetKeywords: input.keywords,
    provider: activeProvider(),
    model: completion.model,
    note: 'This is an AI-written draft. Review and edit for accuracy before publishing — nothing here is fact-checked.',
  };
}

export { PAGE_TYPE_LABELS };
export default { generateContent };
