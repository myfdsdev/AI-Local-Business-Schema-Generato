import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zipSync, strToU8 } from 'fflate';

import { extractText } from '../../src/services/extraction/documentParser.js';

/** Builds a real .xlsx/.pptx/.epub in memory so the zip-extraction paths run for real. */
function makeZip(entries) {
  const files = {};
  for (const [name, content] of Object.entries(entries)) files[name] = strToU8(content);
  return Buffer.from(zipSync(files));
}

describe('Document parser', () => {
  it('reads plain text, markdown and csv directly', async () => {
    const txt = await extractText({ buffer: Buffer.from('Bella Vista Trattoria'), originalname: 'a.txt' });
    assert.match(txt.text, /Bella Vista/);

    const md = await extractText({ buffer: Buffer.from('# Heading\nBody'), originalname: 'a.md' });
    assert.match(md.text, /Heading/);

    const csv = await extractText({ buffer: Buffer.from('name,phone\nBella,+91-90'), originalname: 'a.csv' });
    assert.match(csv.text, /\+91-90/);
  });

  it('extracts text from an .xlsx shared strings table', async () => {
    const xlsx = makeZip({
      'xl/sharedStrings.xml':
        '<?xml version="1.0"?><sst><si><t>Bella Vista Trattoria</t></si><si><t>Jodhpur</t></si></sst>',
      'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet><sheetData/></worksheet>',
    });
    const result = await extractText({ buffer: xlsx, originalname: 'book.xlsx' });
    assert.match(result.text, /Bella Vista Trattoria/);
    assert.match(result.text, /Jodhpur/);
  });

  it('extracts text from a .pptx slide', async () => {
    const pptx = makeZip({
      'ppt/slides/slide1.xml':
        '<?xml version="1.0"?><p:sld><a:t>Our Services</a:t><a:t>Open Mon-Sat</a:t></p:sld>',
    });
    const result = await extractText({ buffer: pptx, originalname: 'deck.pptx' });
    assert.match(result.text, /Our Services/);
    assert.match(result.text, /Open Mon-Sat/);
  });

  it('extracts text from an .epub xhtml document', async () => {
    const epub = makeZip({
      'mimetype': 'application/epub+zip',
      'OEBPS/chapter1.xhtml': '<html><body><p>About our bakery</p></body></html>',
    });
    const result = await extractText({ buffer: epub, originalname: 'guide.epub' });
    assert.match(result.text, /About our bakery/);
  });

  it('rejects an unsupported file type', async () => {
    await assert.rejects(
      () => extractText({ buffer: Buffer.from('x'), originalname: 'evil.exe' }),
      /Unsupported file type/,
    );
  });

  it('rejects an empty file', async () => {
    await assert.rejects(() => extractText({ buffer: Buffer.alloc(0), originalname: 'empty.txt' }), /empty/i);
  });

  it('throws a friendly error when text has no readable content', async () => {
    // A zip with no matching slide entries yields no text.
    const emptyPptx = makeZip({ 'ppt/presentation.xml': '<x/>' });
    await assert.rejects(() => extractText({ buffer: emptyPptx, originalname: 'blank.pptx' }), /No readable text/);
  });
});
