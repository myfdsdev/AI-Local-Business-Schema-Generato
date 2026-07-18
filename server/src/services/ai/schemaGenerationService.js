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

  // Did the model actually find a business to describe? An empty or type-less
  // graph means the source had no business details (e.g. a code README), which
  // is the model correctly refusing to invent data — not an app failure. The
  // UI uses this to show guidance instead of a wall of validation errors.
  const hasBusinessData = Boolean(
    graph &&
      typeof graph === 'object' &&
      graph['@type'] &&
      (graph.name || graph.address || graph.telephone || graph.url),
  );

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

export { isAiConfigured, activeProvider };

export default { generateFromDocuments, generateFromText, isAiConfigured, activeProvider };
