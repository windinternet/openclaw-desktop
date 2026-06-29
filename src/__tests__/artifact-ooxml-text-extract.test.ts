import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { extractOoxmlTextFromBuffer } from '../../electron/artifact-ooxml-text-extract';

interface ZipEntryInput {
  name: string;
  content: string;
}

function zip(entries: ZipEntryInput[]): Buffer {
  return Buffer.concat(
    entries.map((entry) => {
      const name = Buffer.from(entry.name, 'utf8');
      const content = Buffer.from(entry.content, 'utf8');
      const compressed = deflateRawSync(content);
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(0, 6);
      header.writeUInt16LE(8, 8);
      header.writeUInt32LE(0, 10);
      header.writeUInt32LE(0, 14);
      header.writeUInt32LE(compressed.length, 18);
      header.writeUInt32LE(content.length, 22);
      header.writeUInt16LE(name.length, 26);
      header.writeUInt16LE(0, 28);
      return Buffer.concat([header, name, compressed]);
    }),
  );
}

describe('artifact OOXML text extraction', () => {
  it('extracts Word document text from docx XML entries', () => {
    const document = zip([
      {
        name: 'word/document.xml',
        content: '<w:document><w:body><w:t>OpenClaw</w:t><w:t> knowledge base</w:t></w:body></w:document>',
      },
    ]);

    const result = extractOoxmlTextFromBuffer(document, { format: 'word', maxTextChars: 200 });

    expect(result.text).toBe('OpenClaw knowledge base');
    expect(result.bytesRead).toBe(document.length);
    expect(result.truncated).toBe(false);
  });

  it('extracts slide text from pptx slide XML entries', () => {
    const presentation = zip([
      {
        name: 'ppt/slides/slide1.xml',
        content: '<p:sld><a:t>Quarterly Roadmap</a:t><a:t>Delivery risks</a:t></p:sld>',
      },
    ]);

    const result = extractOoxmlTextFromBuffer(presentation, { format: 'powerpoint', maxTextChars: 200 });

    expect(result.text).toBe('Quarterly Roadmap Delivery risks');
  });

  it('extracts spreadsheet text from shared strings and worksheets', () => {
    const workbook = zip([
      {
        name: 'xl/sharedStrings.xml',
        content: '<sst><si><t>Budget</t></si><si><t>Forecast</t></si></sst>',
      },
      {
        name: 'xl/worksheets/sheet1.xml',
        content: '<worksheet><sheetData><c t="inlineStr"><is><t>Q1</t></is></c><v>1200</v></sheetData></worksheet>',
      },
    ]);

    const result = extractOoxmlTextFromBuffer(workbook, { format: 'excel', maxTextChars: 200 });

    expect(result.text).toBe('Budget Forecast Q1 1200');
  });

  it('keeps extraction best-effort when XML entities are invalid', () => {
    const document = zip([
      {
        name: 'word/document.xml',
        content: '<w:document><w:body><w:t>Before</w:t><w:t>&#x110000;</w:t><w:t>After</w:t></w:body></w:document>',
      },
    ]);

    const result = extractOoxmlTextFromBuffer(document, { format: 'word', maxTextChars: 200 });

    expect(result.text).toBe('Before After');
  });
});
