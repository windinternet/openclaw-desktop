import { inflateRawSync } from 'node:zlib';

export type OoxmlTextExtractFormat = 'word' | 'excel' | 'powerpoint';

export interface OoxmlTextExtractOptions {
  format: OoxmlTextExtractFormat;
  maxTextChars?: number;
  sourceTruncated?: boolean;
}

export interface OoxmlTextExtractResult {
  text: string;
  bytesRead: number;
  truncated: boolean;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

const DEFAULT_MAX_TEXT_CHARS = 12_000;
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;

export function extractOoxmlTextFromBuffer(
  bytes: Uint8Array,
  options: OoxmlTextExtractOptions,
): OoxmlTextExtractResult {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const entries = readZipEntries(buffer);
  const text = normalizeText(
    entries
      .filter((entry) => isRelevantOoxmlEntry(entry.name, options.format))
      .flatMap((entry) => extractXmlText(entry.data.toString('utf8')))
      .join(' '),
  );
  const maxTextChars = normalizeMaxTextChars(options.maxTextChars);
  const clipped = text.length > maxTextChars ? text.slice(0, maxTextChars).trimEnd() : text;

  return {
    text: clipped,
    bytesRead: buffer.length,
    truncated: Boolean(options.sourceTruncated) || clipped.length < text.length,
  };
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= buffer.length) {
    const signatureOffset = findLocalFileHeader(buffer, offset);
    if (signatureOffset < 0 || signatureOffset + 30 > buffer.length) break;

    const flags = buffer.readUInt16LE(signatureOffset + 6);
    const method = buffer.readUInt16LE(signatureOffset + 8);
    const compressedSize = buffer.readUInt32LE(signatureOffset + 18);
    const fileNameLength = buffer.readUInt16LE(signatureOffset + 26);
    const extraLength = buffer.readUInt16LE(signatureOffset + 28);
    const nameStart = signatureOffset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataStart > buffer.length || dataEnd > buffer.length) break;

    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString('utf8');
    const data = decodeZipEntry(buffer.subarray(dataStart, dataEnd), method, flags);
    if (data && name) entries.push({ name, data });

    offset = dataEnd;
  }

  return entries;
}

function findLocalFileHeader(buffer: Buffer, offset: number): number {
  let cursor = offset;
  while (cursor + 4 <= buffer.length) {
    if (buffer.readUInt32LE(cursor) === ZIP_LOCAL_FILE_HEADER) return cursor;
    cursor += 1;
  }
  return -1;
}

function decodeZipEntry(data: Buffer, method: number, flags: number): Buffer | null {
  // General purpose bit 3 means sizes may live in a data descriptor; this minimal reader deliberately skips it.
  if ((flags & 0x08) !== 0) return null;
  if (method === 0) return data;
  if (method === 8) {
    try {
      return inflateRawSync(data);
    } catch {
      return null;
    }
  }
  return null;
}

function isRelevantOoxmlEntry(name: string, format: OoxmlTextExtractFormat): boolean {
  if (format === 'word') {
    return /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/u.test(name);
  }
  if (format === 'powerpoint') {
    return /^ppt\/(?:slides\/slide|notesSlides\/notesSlide)\d+\.xml$/u.test(name);
  }
  return name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/u.test(name);
}

function extractXmlText(xml: string): string[] {
  const values: string[] = [];
  const pattern = /<(?:[A-Za-z0-9_]+:)?(?:t|v)\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?(?:t|v)>/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const text = decodeXmlEntities(match[1].replace(/<[^>]+>/gu, ''));
    if (text.trim()) values.push(text);
  }
  return values;
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/gu, (_match, entity: string) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    if (entity.startsWith('#x')) return decodeNumericXmlEntity(entity.slice(2), 16);
    if (entity.startsWith('#')) return decodeNumericXmlEntity(entity.slice(1), 10);
    return '';
  });
}

function decodeNumericXmlEntity(value: string, radix: 10 | 16): string {
  const codePoint = parseInt(value, radix);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return '';
  return String.fromCodePoint(codePoint);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function normalizeMaxTextChars(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return DEFAULT_MAX_TEXT_CHARS;
  return Math.trunc(value);
}
