import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { extractPdfTextFromBuffer } from '../../electron/artifact-pdf-text-extract';

function pdfWithStream(stream: Buffer | string, dictionary = ''): Buffer {
  const body = Buffer.isBuffer(stream) ? stream : Buffer.from(stream, 'latin1');
  return Buffer.concat([
    Buffer.from(`%PDF-1.7\n1 0 obj\n<< ${dictionary} /Length ${body.length} >>\nstream\n`, 'latin1'),
    body,
    Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1'),
  ]);
}

describe('artifact PDF text extraction', () => {
  it('extracts best-effort text from uncompressed PDF text streams', () => {
    const pdf = pdfWithStream('BT /F1 12 Tf 72 720 Td (Hello\\040OpenClaw) Tj [<0057006f0072006c0064> ( PDF)] TJ ET');

    const result = extractPdfTextFromBuffer(pdf, { maxTextChars: 200 });

    expect(result.text).toBe('Hello OpenClaw World PDF');
    expect(result.bytesRead).toBe(pdf.length);
    expect(result.truncated).toBe(false);
  });

  it('inflates FlateDecode streams before extracting text', () => {
    const compressed = deflateSync(Buffer.from('BT (Compressed roadmap text) Tj ET', 'latin1'));
    const pdf = pdfWithStream(compressed, '/Filter /FlateDecode');

    const result = extractPdfTextFromBuffer(pdf, { maxTextChars: 200 });

    expect(result.text).toBe('Compressed roadmap text');
    expect(result.truncated).toBe(false);
  });
});
