import { extractFromFiles } from '../extraction/documentParser.js';
import { parseAndValidate } from '../validation/jsonLdValidator.js';
import { activeProvider, chatJson, isAiConfigured } from './aiClient.js';
import { SCHEMA_SYSTEM_PROMPT } from './schemaPrompt.js';

/** Cap on the combined document text sent to the model. */
const MAX_PROMPT_CHARS = 24_000;

/**
 * Builds the user message from typed notes plus extracted document text. The
 * documents are the source of truth; notes (if any) are appended so a user can
 * add detail the files don't contain.
 */
function buildUserContent({ notes, documents }) {
  const sections = [];

  if (notes?.trim()) sections.push(`Business details provided directly:\n${notes.trim()}`);

  for (const doc of documents) {
    sections.push(`--- Content extracted from "${doc.filename}" ---\n${doc.text}`);
  }

  let content = sections.join('\n\n');
  if (content.length > MAX_PROMPT_CHARS) content = content.slice(0, MAX_PROMPT_CHARS);
  return content;
}

/**
 * Full pipeline: parse uploaded documents -> build prompt -> AI generation ->
 * defensive parse -> AJV validation. Returns the validated graph plus the
 * source metadata so the UI can show what was read and flag any files it could
 * not parse.
 */
export async function generateFromDocuments({ files = [], notes = '' }) {
  const { documents, failures } = await extractFromFiles(files);

  if (documents.length === 0 && !notes.trim()) {
    const detail = failures.length
      ? failures.map((failure) => `${failure.filename}: ${failure.error}`).join('; ')
      : 'No readable content was provided.';
    const error = new Error(`Nothing to generate from. ${detail}`);
    error.status = 400;
    error.code = 'NO_CONTENT';
    throw error;
  }

  const userContent = buildUserContent({ notes, documents });

  const completion = await chatJson({
    system: SCHEMA_SYSTEM_PROMPT,
    user: userContent,
  });

  const validation = parseAndValidate(completion.content);
  const graph = validation.graph;
  const hasBusinessData = describesLocalBusiness(graph);

  return {
    jsonLd: graph,
    jsonLdString: graph ? JSON.stringify(graph, null, 2) : completion.content,
    valid: validation.valid,
    hasBusinessData,
    errors: validation.errors,
    warnings: validation.warnings,
    recommendations: validation.recommendations,
    sources: {
      documents: documents.map(({ filename, chars, truncated }) => ({ filename, chars, truncated })),
      failures,
      usedNotes: Boolean(notes?.trim()),
    },
    model: completion.model,
  };
}

/**
 * Generates from typed text alone (no files) — the same pipeline without the
 * parsing step. Useful for the "paste business details" path.
 */
export async function generateFromText(notes) {
  return generateFromDocuments({ files: [], notes });
}

/**
 * Signals only a real-world business has. A name/url/description alone
 * describes ANY web page — a code library README, an article, a docs site — so
 * those are not sufficient. (Regression guard: an npm package README once
 * produced a confident, "valid" ProfessionalService graph.)
 */
const REAL_WORLD_SIGNALS = ['address', 'telephone', 'openingHoursSpecification', 'geo'];

/**
 * Whether an extracted graph actually describes a local business, as opposed to
 * the model having typed some non-business document as one. Exported so the
 * rule is unit-testable without calling the AI.
 */
export function describesLocalBusiness(graph) {
  if (!graph || typeof graph !== 'object') return false;
  if (!graph['@type'] || !graph.name) return false;

  return REAL_WORLD_SIGNALS.some((key) => {
    const value = graph[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

export { isAiConfigured, activeProvider };

export default { generateFromDocuments, generateFromText, isAiConfigured, activeProvider };
