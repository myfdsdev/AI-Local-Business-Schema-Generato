/**
 * Defensively parses a JSON object/array out of a model response. The prompts
 * ask for bare JSON, but a stray code fence or surrounding prose is stripped
 * first so a minor formatting slip doesn't fail the whole request. Returns null
 * if nothing parseable is found.
 */
export function extractJson(rawText) {
  let cleaned = String(rawText ?? '').trim();

  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) cleaned = fence[1].trim();

  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const objStart = cleaned.indexOf('{');
    const arrStart = cleaned.indexOf('[');
    const start =
      objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export default extractJson;
