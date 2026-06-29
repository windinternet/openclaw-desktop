import { inflateSync } from 'node:zlib';

export interface PdfTextExtractOptions {
  maxTextChars?: number;
  sourceTruncated?: boolean;
}

export interface PdfTextExtractResult {
  text: string;
  bytesRead: number;
  truncated: boolean;
}

const DEFAULT_MAX_TEXT_CHARS = 12_000;
const STREAM_MARKER = Buffer.from('stream', 'latin1');
const END_STREAM_MARKER = Buffer.from('endstream', 'latin1');

export function extractPdfTextFromBuffer(bytes: Uint8Array, options: PdfTextExtractOptions = {}): PdfTextExtractResult {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!isPdfBuffer(buffer)) {
    return { text: '', bytesRead: buffer.length, truncated: Boolean(options.sourceTruncated) };
  }

  const text = normalizeExtractedText(
    extractPdfStreams(buffer)
      .map((stream) => extractTextFromContentStream(stream))
      .filter(Boolean)
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

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function extractPdfStreams(buffer: Buffer): Buffer[] {
  const streams: Buffer[] = [];
  let searchFrom = 0;

  while (searchFrom < buffer.length) {
    const streamIndex = buffer.indexOf(STREAM_MARKER, searchFrom);
    if (streamIndex < 0) break;

    const dataStart = skipPdfLineBreak(buffer, streamIndex + STREAM_MARKER.length);
    const endIndex = buffer.indexOf(END_STREAM_MARKER, dataStart);
    if (endIndex < 0) break;

    const dataEnd = trimPdfLineBreakBefore(buffer, endIndex);
    const dictionary = buffer.subarray(Math.max(0, streamIndex - 2048), streamIndex).toString('latin1');
    const streamBytes = buffer.subarray(dataStart, dataEnd);
    const decoded = decodePdfStream(streamBytes, dictionary);
    if (decoded) streams.push(decoded);

    searchFrom = endIndex + END_STREAM_MARKER.length;
  }

  return streams;
}

function skipPdfLineBreak(buffer: Buffer, index: number): number {
  if (buffer[index] === 0x0d && buffer[index + 1] === 0x0a) return index + 2;
  if (buffer[index] === 0x0a || buffer[index] === 0x0d) return index + 1;
  return index;
}

function trimPdfLineBreakBefore(buffer: Buffer, index: number): number {
  if (index >= 2 && buffer[index - 2] === 0x0d && buffer[index - 1] === 0x0a) return index - 2;
  if (index >= 1 && (buffer[index - 1] === 0x0a || buffer[index - 1] === 0x0d)) return index - 1;
  return index;
}

function decodePdfStream(streamBytes: Buffer, dictionary: string): Buffer | null {
  if (!/\/FlateDecode\b/u.test(dictionary)) return streamBytes;
  try {
    return inflateSync(streamBytes);
  } catch {
    return null;
  }
}

function extractTextFromContentStream(stream: Buffer): string {
  const content = stream.toString('latin1');
  const blocks = content.match(/BT[\s\S]*?ET/gu) ?? [];
  return normalizeExtractedText(blocks.flatMap(extractPdfStrings).join(' '));
}

function extractPdfStrings(block: string): string[] {
  const values: string[] = [];
  let index = 0;

  while (index < block.length) {
    const char = block[index];
    if (char === '(') {
      const parsed = readLiteralString(block, index + 1);
      values.push(parsed.value);
      index = parsed.nextIndex;
      continue;
    }
    if (char === '<' && block[index + 1] !== '<') {
      const parsed = readHexString(block, index + 1);
      if (parsed.value) values.push(parsed.value);
      index = parsed.nextIndex;
      continue;
    }
    index += 1;
  }

  return values.filter(Boolean);
}

function readLiteralString(value: string, startIndex: number): { value: string; nextIndex: number } {
  const bytes: number[] = [];
  let depth = 1;
  let index = startIndex;

  while (index < value.length && depth > 0) {
    const char = value[index];
    if (char === '\\') {
      const escaped = readEscapedByte(value, index + 1);
      if (escaped.byte !== null) bytes.push(escaped.byte);
      index = escaped.nextIndex;
      continue;
    }
    if (char === '(') {
      depth += 1;
      bytes.push(char.charCodeAt(0));
      index += 1;
      continue;
    }
    if (char === ')') {
      depth -= 1;
      if (depth > 0) bytes.push(char.charCodeAt(0));
      index += 1;
      continue;
    }

    bytes.push(char.charCodeAt(0) & 0xff);
    index += 1;
  }

  return { value: decodePdfBytes(bytes), nextIndex: index };
}

function readEscapedByte(value: string, index: number): { byte: number | null; nextIndex: number } {
  const char = value[index];
  if (char === undefined) return { byte: null, nextIndex: index };

  const simpleEscapes: Record<string, number> = {
    n: 0x0a,
    r: 0x0d,
    t: 0x09,
    b: 0x08,
    f: 0x0c,
    '(': 0x28,
    ')': 0x29,
    '\\': 0x5c,
  };
  if (simpleEscapes[char] !== undefined) return { byte: simpleEscapes[char], nextIndex: index + 1 };

  if (char === '\r' || char === '\n') {
    if (char === '\r' && value[index + 1] === '\n') return { byte: null, nextIndex: index + 2 };
    return { byte: null, nextIndex: index + 1 };
  }

  if (/[0-7]/u.test(char)) {
    const octal = value.slice(index, index + 3).match(/^[0-7]{1,3}/u)?.[0] ?? char;
    return { byte: parseInt(octal, 8) & 0xff, nextIndex: index + octal.length };
  }

  return { byte: char.charCodeAt(0) & 0xff, nextIndex: index + 1 };
}

function readHexString(value: string, startIndex: number): { value: string; nextIndex: number } {
  const endIndex = value.indexOf('>', startIndex);
  if (endIndex < 0) return { value: '', nextIndex: value.length };

  let hex = value
    .slice(startIndex, endIndex)
    .replace(/\s+/gu, '')
    .replace(/[^a-fA-F0-9]/gu, '');
  if (hex.length % 2 === 1) hex += '0';

  const bytes: number[] = [];
  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(parseInt(hex.slice(index, index + 2), 16));
  }

  return { value: decodePdfBytes(bytes), nextIndex: endIndex + 1 };
}

function decodePdfBytes(bytes: number[]): string {
  if (bytes.length === 0) return '';
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16Be(bytes.slice(2));
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe)
    return Buffer.from(bytes.slice(2)).toString('utf16le');
  if (looksLikeUtf16Be(bytes)) return decodeUtf16Be(bytes);
  return Buffer.from(bytes).toString('latin1');
}

function looksLikeUtf16Be(bytes: number[]): boolean {
  if (bytes.length < 4 || bytes.length % 2 !== 0) return false;
  let zeroHighBytes = 0;
  for (let index = 0; index < bytes.length; index += 2) {
    if (bytes[index] === 0x00 && bytes[index + 1] >= 0x20) zeroHighBytes += 1;
  }
  return zeroHighBytes >= Math.ceil(bytes.length / 4);
}

function decodeUtf16Be(bytes: number[]): string {
  let result = '';
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    result += String.fromCharCode((bytes[index] << 8) + bytes[index + 1]);
  }
  return result;
}

function normalizeExtractedText(value: string): string {
  return value.split(String.fromCharCode(0)).join('').replace(/\s+/gu, ' ').trim();
}

function normalizeMaxTextChars(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return DEFAULT_MAX_TEXT_CHARS;
  return Math.trunc(value);
}
