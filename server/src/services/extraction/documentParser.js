import path from 'node:path';

import { unzipSync } from 'fflate';

import logger from '../../config/logger.js';

/**
 * Extracts plain text from uploaded business documents so it can be handed to
 * the schema generator. Formats: txt, md, csv, pdf, docx, pptx, xlsx, xls, epub.
 *
 * Security note: these are untrusted user uploads. Everything here is pure-JS
 * and reads from an already size-capped in-memory buffer (see upload
 * middleware). We deliberately avoid libraries with known ZIP-bomb or
 * prototype-pollution advisories on untrusted input.
 */

// Extensions we accept. Kept in sync with the upload middleware allowlist.
export const SUPPORTED_EXTENSIONS = Object.freeze([
  '.txt',
  '.md',
  '.csv',
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.xls',
  '.epub',
]);

// Guardrail so one large document cannot blow up the LLM prompt.
const MAX_TEXT_CHARS = 100_000;

const decoder = new TextDecoder('utf-8');

function stripXml(xml) {
  return xml
    // Block-level tags become spaces so words don't run together.
    .replace(/<\/(p|div|br|li|tr|td|h[1-6]|a:p|a:br|text:p)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*\n\s*/g, '\n\n')
    .trim();
}

/** Entries inside a zip whose name matches, concatenated as stripped text. */
function textFromZipEntries(buffer, matcher) {
  const files = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(files)
    .filter(matcher)
    // slide2.xml before slide10.xml, sheet order preserved, etc.
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const parts = [];
  for (const name of names) {
    const xml = decoder.decode(files[name]);
    const text = stripXml(xml);
    if (text) parts.push(text);
  }
  return parts.join('\n\n');
}

async function parsePdf(buffer) {
  // Import the library's inner module directly: pdf-parse's index.js runs a
  // debug harness that reads a sample file from disk when it thinks it's the
  // main module, which throws under a bundler/ESM.
  const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
  const result = await pdfParse(buffer);
  return result.text ?? '';
}

async function parseDocx(buffer) {
  const { default: mammoth } = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? '';
}

function parsePptx(buffer) {
  // Slide text lives in ppt/slides/slideN.xml; notes are skipped on purpose.
  return textFromZipEntries(buffer, (name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
}

function parseXlsx(buffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const parts = [];

  // Shared strings hold most human-readable cell text in an .xlsx.
  const shared = Object.keys(files).find((name) => /^xl\/sharedStrings\.xml$/i.test(name));
  if (shared) parts.push(stripXml(decoder.decode(files[shared])));

  // Inline strings and numbers live in the worksheet XML.
  for (const name of Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n))) {
    parts.push(stripXml(decoder.decode(files[name])));
  }

  return parts.filter(Boolean).join('\n\n');
}

function parseEpub(buffer) {
  return textFromZipEntries(buffer, (name) => /\.(x?html?)$/i.test(name) && !/nav|toc/i.test(name));
}

/**
 * Legacy binary .xls has no safe, dependency-free parser. Rather than pull in a
 * library with known advisories, pull out readable UTF-16LE / ASCII runs. Crude
 * but safe — enough for an LLM to find a business name, phone, or address.
 */
function parseLegacyXls(buffer) {
  const runs = [];

  const utf16 = buffer.toString('utf16le').match(/[\x20-\x7E -￿]{4,}/g);
  if (utf16) runs.push(...utf16);

  const ascii = buffer.toString('latin1').match(/[\x20-\x7E]{4,}/g);
  if (ascii) runs.push(...ascii);

  return [...new Set(runs)].join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Returns { text, chars, truncated } for one uploaded file, or throws an Error
 * whose message is safe to show the user.
 */
export async function extractText({ buffer, originalname, mimetype }) {
  const ext = path.extname(originalname || '').toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type: ${ext || 'unknown'}.`);
  }
  if (!buffer?.length) throw new Error('The file is empty.');

  let text = '';
  try {
    switch (ext) {
      case '.txt':
      case '.md':
      case '.csv':
        text = buffer.toString('utf8');
        break;
      case '.pdf':
        text = await parsePdf(buffer);
        break;
      case '.docx':
        text = await parseDocx(buffer);
        break;
      case '.pptx':
        text = parsePptx(buffer);
        break;
      case '.xlsx':
        text = parseXlsx(buffer);
        break;
      case '.xls':
        text = parseLegacyXls(buffer);
        break;
      case '.epub':
        text = parseEpub(buffer);
        break;
      default:
        throw new Error(`Unsupported file type: ${ext}.`);
    }
  } catch (error) {
    logger.warn('Document parse failed', { originalname, ext, message: error.message });
    throw new Error(`Could not read ${originalname}. The file may be corrupt or password-protected.`);
  }

  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  const truncated = text.length > MAX_TEXT_CHARS;
  if (truncated) text = text.slice(0, MAX_TEXT_CHARS);

  if (!text) {
    throw new Error(`No readable text found in ${originalname}. It may be a scanned image or empty.`);
  }

  return { text, chars: text.length, truncated };
}

/**
 * Extracts text from many files, returning successes and per-file failures
 * separately so one bad upload doesn't sink the batch.
 */
export async function extractFromFiles(files = []) {
  const documents = [];
  const failures = [];

  for (const file of files) {
    try {
      const { text, chars, truncated } = await extractText(file);
      documents.push({ filename: file.originalname, chars, truncated, text });
    } catch (error) {
      failures.push({ filename: file.originalname, error: error.message });
    }
  }

  return { documents, failures };
}

export default { extractText, extractFromFiles, SUPPORTED_EXTENSIONS };
