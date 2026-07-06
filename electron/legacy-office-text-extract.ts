import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_LEGACY_BINARY_TEXT_CHARS = 200_000;
const MIN_LEGACY_BINARY_RUN_LENGTH = 4;
const BIFF8_FORMULA_RECORD_ID = 0x0006;
const BIFF8_EOF_RECORD_ID = 0x000a;
const BIFF8_DATE1904_RECORD_ID = 0x0022;
const BIFF8_CONTINUE_RECORD_ID = 0x003c;
const BIFF8_BOUNDSHEET_RECORD_ID = 0x0085;
const BIFF8_FORMAT_RECORD_ID = 0x041e;
const BIFF8_STRING_RECORD_ID = 0x0207;
const BIFF8_MULRK_RECORD_ID = 0x00bd;
const BIFF8_MULBLANK_RECORD_ID = 0x00be;
const BIFF8_SST_RECORD_ID = 0x00fc;
const BIFF8_RSTRING_RECORD_ID = 0x00d6;
const BIFF8_BLANK_RECORD_ID = 0x0201;
const BIFF8_MERGEDCELLS_RECORD_ID = 0x00e5;
const BIFF8_LABEL_RECORD_ID = 0x0204;
const BIFF8_BOOLERR_RECORD_ID = 0x0205;
const BIFF8_LABELSST_RECORD_ID = 0x00fd;
const BIFF8_RK_RECORD_ID = 0x027e;
const BIFF8_XF_RECORD_ID = 0x00e0;
const BIFF8_NUMBER_RECORD_ID = 0x0203;
const BIFF8_BOF_RECORD_ID = 0x0809;
const BIFF8_WORKSHEET_TYPE = 0x00;
const BIFF8_WORKSHEET_BOF_TYPE = 0x0010;
const BIFF8_BUILT_IN_DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 22]);
const BIFF8_BUILT_IN_TIME_FORMAT_IDS = new Set([18, 19, 20, 21]);
const BIFF8_BUILT_IN_MINUTE_SECOND_TIME_FORMAT_IDS = new Set([45]);
const BIFF8_BUILT_IN_FRACTIONAL_SECOND_TIME_FORMAT_IDS = new Set([47]);
const BIFF8_BUILT_IN_ELAPSED_HOUR_FORMAT_IDS = new Set([46]);
const BIFF8_BUILT_IN_PERCENT_FORMAT_DECIMALS = new Map([
  [9, 0],
  [10, 2],
]);
const BIFF8_BUILT_IN_SCIENTIFIC_FORMAT_DECIMALS = new Map([[11, 2]]);
const BIFF8_BUILT_IN_FRACTION_FORMAT_MAX_DENOMINATOR = new Map([
  [12, 9],
  [13, 99],
]);
const BIFF8_BUILT_IN_NUMBER_FORMATS = new Map([
  [1, { decimals: 0, grouping: false, negativeParentheses: false }],
  [2, { decimals: 2, grouping: false, negativeParentheses: false }],
  [3, { decimals: 0, grouping: true, negativeParentheses: false }],
  [4, { decimals: 2, grouping: true, negativeParentheses: false }],
  [37, { decimals: 0, grouping: true, negativeParentheses: true }],
  [38, { decimals: 0, grouping: true, negativeParentheses: true }],
  [39, { decimals: 2, grouping: true, negativeParentheses: true }],
  [40, { decimals: 2, grouping: true, negativeParentheses: true }],
  [41, { decimals: 0, grouping: true, negativeParentheses: true, zeroText: '-' }],
  [43, { decimals: 2, grouping: true, negativeParentheses: true, zeroText: '-' }],
]);
const BIFF8_BUILT_IN_CURRENCY_FORMAT_DECIMALS = new Map([
  [5, 0],
  [6, 0],
  [7, 2],
  [8, 2],
  [42, 0],
  [44, 2],
]);
const BIFF8_BUILT_IN_CURRENCY_PARENTHESES_NEGATIVE_FORMAT_IDS = new Set([5, 6, 7, 8, 42, 44]);
const BIFF8_BUILT_IN_CURRENCY_ACCOUNTING_ZERO_FORMAT_IDS = new Set([42, 44]);
const EXCEL_1900_EPOCH_UTC_MS = Date.UTC(1899, 11, 31);
const EXCEL_1904_EPOCH_UTC_MS = Date.UTC(1904, 0, 1);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SECONDS_PER_DAY = 24 * 60 * 60;
type Biff8DateTimePrecision =
  | 'date'
  | 'minute'
  | 'second'
  | 'second-fractional'
  | 'second-fractional-2'
  | 'second-fractional-3'
  | 'date-ap-minute'
  | 'date-ap-second'
  | 'date-ap-second-fractional'
  | 'date-ap-second-fractional-2'
  | 'date-ap-second-fractional-3'
  | 'date-ampm-minute'
  | 'date-ampm-second'
  | 'date-ampm-second-fractional'
  | 'date-ampm-second-fractional-2'
  | 'date-ampm-second-fractional-3'
  | 'time-minute'
  | 'time-ap-minute'
  | 'time-ap-second'
  | 'time-ap-second-fractional'
  | 'time-ap-second-fractional-2'
  | 'time-ap-second-fractional-3'
  | 'time-ampm-minute'
  | 'time-ampm-second'
  | 'time-ampm-second-fractional'
  | 'time-ampm-second-fractional-2'
  | 'time-ampm-second-fractional-3'
  | 'time-second'
  | 'time-minute-second'
  | 'time-fractional-second'
  | 'time-fractional-second-2'
  | 'time-fractional-second-3'
  | 'time-hour-fractional-second'
  | 'time-hour-fractional-second-2'
  | 'time-hour-fractional-second-3'
  | 'elapsed-minute'
  | 'elapsed-second'
  | 'elapsed-second-fractional'
  | 'elapsed-second-fractional-2'
  | 'elapsed-second-fractional-3'
  | 'elapsed-total-minute'
  | 'elapsed-total-minute-fractional'
  | 'elapsed-total-minute-fractional-2'
  | 'elapsed-total-minute-fractional-3'
  | 'elapsed-total-second'
  | 'elapsed-total-second-fractional'
  | 'elapsed-total-second-fractional-2'
  | 'elapsed-total-second-fractional-3';
const PPT_RECORD_HEADER_SIZE = 8;
const PPT_SLIDE_CONTAINER_RECORD_TYPE = 0x03ee;
const PPT_NOTES_CONTAINER_RECORD_TYPE = 0x03f0;
const PPT_TEXT_HEADER_ATOM_RECORD_TYPE = 0x0f9f;
const PPT_TEXT_CHARS_ATOM_RECORD_TYPE = 0x0fa0;
const PPT_TEXT_BYTES_ATOM_RECORD_TYPE = 0x0fa8;
const PPT_MAX_SUPPORTED_TEXT_HEADER_INSTANCE = 8;
const WINDOWS_1252_CONTROL_CHARACTERS: Record<number, string> = {
  0x80: '\u20ac',
  0x82: '\u201a',
  0x83: '\u0192',
  0x84: '\u201e',
  0x85: '\u2026',
  0x86: '\u2020',
  0x87: '\u2021',
  0x88: '\u02c6',
  0x89: '\u2030',
  0x8a: '\u0160',
  0x8b: '\u2039',
  0x8c: '\u0152',
  0x8e: '\u017d',
  0x91: '\u2018',
  0x92: '\u2019',
  0x93: '\u201c',
  0x94: '\u201d',
  0x95: '\u2022',
  0x96: '\u2013',
  0x97: '\u2014',
  0x98: '\u02dc',
  0x99: '\u2122',
  0x9a: '\u0161',
  0x9b: '\u203a',
  0x9c: '\u0153',
  0x9e: '\u017e',
  0x9f: '\u0178',
};

export interface LegacyOfficeTextExtractResult {
  text: string;
  bytesRead: number;
  truncated: boolean;
}

export interface LegacyWordTextExtractOptions {
  platform?: NodeJS.Platform;
  runTextutil?: (filePath: string) => Promise<string>;
}

export async function extractLegacyWordTextFromBuffer(
  bytes: Uint8Array,
  options: LegacyWordTextExtractOptions = {},
): Promise<LegacyOfficeTextExtractResult> {
  const platform = options.platform ?? process.platform;
  if (platform !== 'darwin') {
    return { text: '', bytesRead: bytes.byteLength, truncated: false };
  }

  let filePath: string | undefined;
  try {
    filePath = await writeTemporaryLegacyWord(bytes);
    const text = await (options.runTextutil ?? runTextutilOnMac)(filePath);
    return {
      text: normalizeExtractedLegacyOfficeText(text),
      bytesRead: bytes.byteLength,
      truncated: false,
    };
  } catch {
    return { text: '', bytesRead: bytes.byteLength, truncated: false };
  } finally {
    if (filePath) await rm(path.dirname(filePath), { recursive: true, force: true });
  }
}

export function extractLegacyBinaryOfficeTextFromBuffer(bytes: Uint8Array): LegacyOfficeTextExtractResult {
  const structuredText = extractBiff8TabularRows(bytes);
  const powerpointText = extractPowerPointTextAtoms(bytes);
  const textParts = [
    ...(structuredText ? [structuredText.text] : []),
    ...(powerpointText ? [powerpointText.text] : []),
    ...extractUtf16LePrintableRuns(bytes),
    ...extractAsciiPrintableRuns(bytes),
  ];
  const seen = new Set<string>();
  let text = '';
  let truncated = false;

  for (const part of textParts) {
    const normalized = normalizeExtractedLegacyOfficeText(part, { preserveTabEdges: part === structuredText?.text });
    if (!normalized || seen.has(normalized)) continue;
    if (structuredText?.cellTexts.has(normalized)) continue;
    if (
      structuredText &&
      part !== structuredText.text &&
      isStructuredBiffFallbackNoise(normalized, structuredText.cellTexts)
    ) {
      continue;
    }
    if (
      powerpointText &&
      part !== powerpointText.text &&
      isStructuredPowerPointFallbackNoise(normalized, powerpointText.textBodies)
    ) {
      continue;
    }
    seen.add(normalized);
    const separator = text ? '\n' : '';
    const next = `${text}${separator}${normalized}`;
    if (next.length > MAX_LEGACY_BINARY_TEXT_CHARS) {
      text = next.slice(0, MAX_LEGACY_BINARY_TEXT_CHARS).trim();
      truncated = true;
      break;
    }
    text = next;
  }

  return {
    text,
    bytesRead: bytes.byteLength,
    truncated,
  };
}

interface Biff8TabularText {
  text: string;
  cellTexts: Set<string>;
}

interface PowerPointText {
  text: string;
  textBodies: Set<string>;
}

interface Biff8Record {
  id: number;
  data: Uint8Array;
  offset: number;
}

function extractBiff8TabularRows(bytes: Uint8Array): Biff8TabularText | null {
  const records = parseBiff8Records(bytes);
  const customNumberFormats = parseBiff8CustomNumberFormats(records);
  const customNumberFormatFallbackTexts = parseBiff8CustomNumberFormatFallbackTexts(records);
  const inlineStringFallbackTexts = parseBiff8InlineStringFallbackTexts(records);
  const sharedStringFallbackTexts = parseBiff8SharedStringFallbackTexts(records);
  const boundSheetFallbackTexts = parseBiff8BoundSheetFallbackTexts(records);
  const cellFormats = parseBiff8CellFormats(records, customNumberFormats);
  const uses1904DateSystem = parseBiff8Uses1904DateSystem(records);
  const sharedStrings = parseBiff8SharedStrings(records);
  const parsedWorksheetSections = parseBiff8WorksheetSections(records);
  const worksheetSections = parsedWorksheetSections
    .map((section) => ({
      name: section.name,
      rows: extractBiff8RowsFromRecords(
        records.filter((record) => record.offset >= section.startOffset && record.offset < section.endOffset),
        sharedStrings,
        cellFormats,
        uses1904DateSystem,
      ),
    }))
    .filter((section): section is { name: string; rows: Biff8TabularText } => section.rows !== null);

  if (parsedWorksheetSections.length > 0 && worksheetSections.length > 0) {
    const cellTexts = new Set<string>();
    addBiff8StructuredFallbackTexts(
      cellTexts,
      customNumberFormats,
      customNumberFormatFallbackTexts,
      inlineStringFallbackTexts,
      sharedStringFallbackTexts,
      boundSheetFallbackTexts,
    );
    const text = worksheetSections
      .map((section) => {
        cellTexts.add(section.name);
        for (const cellText of section.rows.cellTexts) cellTexts.add(cellText);
        return `# ${section.name}\n${section.rows.text}`;
      })
      .join('\n');
    return { text, cellTexts };
  }

  const rows = extractBiff8RowsFromRecords(records, sharedStrings, cellFormats, uses1904DateSystem);
  if (!rows) return null;
  addBiff8StructuredFallbackTexts(
    rows.cellTexts,
    customNumberFormats,
    customNumberFormatFallbackTexts,
    inlineStringFallbackTexts,
    sharedStringFallbackTexts,
    boundSheetFallbackTexts,
  );
  if (parsedWorksheetSections.length === 1) {
    const sheetName = parsedWorksheetSections[0].name;
    rows.cellTexts.add(sheetName);
    return { text: `# ${sheetName}\n${rows.text}`, cellTexts: rows.cellTexts };
  }
  return rows;
}

function addBiff8StructuredFallbackTexts(
  cellTexts: Set<string>,
  customNumberFormats: Map<number, string>,
  customNumberFormatFallbackTexts: Set<string>,
  inlineStringFallbackTexts: Set<string>,
  sharedStringFallbackTexts: Set<string>,
  boundSheetFallbackTexts: Set<string>,
): void {
  for (const formatCode of customNumberFormats.values()) cellTexts.add(formatCode);
  for (const formatText of customNumberFormatFallbackTexts) cellTexts.add(formatText);
  for (const inlineStringText of inlineStringFallbackTexts) cellTexts.add(inlineStringText);
  for (const sharedStringText of sharedStringFallbackTexts) cellTexts.add(sharedStringText);
  for (const boundSheetText of boundSheetFallbackTexts) cellTexts.add(boundSheetText);
}

function extractBiff8RowsFromRecords(
  records: Biff8Record[],
  sharedStrings: string[],
  cellFormats: Biff8CellFormat[],
  uses1904DateSystem: boolean,
): Biff8TabularText | null {
  const cells = new Map<number, Map<number, string>>();
  const cellTexts = new Set<string>();
  const mergedCellRanges = parseBiff8MergedCellRanges(records);
  for (const [index, record] of records.entries()) {
    const recordCells = readBiff8CellTexts(record, sharedStrings, cellFormats, uses1904DateSystem, records, index);
    for (const cell of recordCells) {
      const rowCells = cells.get(cell.row) ?? new Map<number, string>();
      rowCells.set(cell.column, cell.text);
      cells.set(cell.row, rowCells);
      cellTexts.add(cell.text);
    }
  }
  for (const range of mergedCellRanges) {
    if (range.firstColumn > range.lastColumn) continue;
    const anchorRowCells = cells.get(range.firstRow);
    if (!anchorRowCells?.has(range.firstColumn)) continue;
    for (let row = range.firstRow; row <= range.lastRow; row += 1) {
      const rowCells = cells.get(row) ?? new Map<number, string>();
      for (let column = range.firstColumn; column <= range.lastColumn; column += 1) {
        if (row === range.firstRow && column === range.firstColumn) continue;
        if (!rowCells.has(column)) rowCells.set(column, '');
      }
      cells.set(row, rowCells);
    }
  }

  if (!cells.size) return null;

  const text = Array.from(cells.entries())
    .sort(([left], [right]) => left - right)
    .map(([, rowCells]) => {
      const columns = Array.from(rowCells.keys()).sort((left, right) => left - right);
      const maxColumn = columns[columns.length - 1] ?? -1;
      const rowValues = Array.from({ length: maxColumn + 1 }, (_value, index) => rowCells.get(index) ?? '');
      return rowValues.join('\t');
    })
    .join('\n');

  return text ? { text, cellTexts } : null;
}

function parseBiff8Records(bytes: Uint8Array): Biff8Record[] {
  const records: Biff8Record[] = [];
  for (let offset = 0; offset + 4 <= bytes.byteLength; ) {
    const id = readUInt16Le(bytes, offset);
    const length = readUInt16Le(bytes, offset + 2);
    const dataStart = offset + 4;
    const declaredDataEnd = dataStart + length;
    const dataEnd = Math.min(declaredDataEnd, bytes.byteLength);
    if (
      id === BIFF8_FORMULA_RECORD_ID ||
      id === BIFF8_EOF_RECORD_ID ||
      id === BIFF8_DATE1904_RECORD_ID ||
      id === BIFF8_CONTINUE_RECORD_ID ||
      id === BIFF8_BOUNDSHEET_RECORD_ID ||
      id === BIFF8_FORMAT_RECORD_ID ||
      id === BIFF8_STRING_RECORD_ID ||
      id === BIFF8_SST_RECORD_ID ||
      id === BIFF8_MULRK_RECORD_ID ||
      id === BIFF8_MULBLANK_RECORD_ID ||
      id === BIFF8_RSTRING_RECORD_ID ||
      id === BIFF8_BLANK_RECORD_ID ||
      id === BIFF8_MERGEDCELLS_RECORD_ID ||
      id === BIFF8_LABEL_RECORD_ID ||
      id === BIFF8_BOOLERR_RECORD_ID ||
      id === BIFF8_LABELSST_RECORD_ID ||
      id === BIFF8_RK_RECORD_ID ||
      id === BIFF8_XF_RECORD_ID ||
      id === BIFF8_NUMBER_RECORD_ID ||
      id === BIFF8_BOF_RECORD_ID
    ) {
      records.push({ id, data: bytes.subarray(dataStart, dataEnd), offset });
    }
    if (declaredDataEnd > bytes.byteLength) break;
    offset = dataEnd;
  }
  return records;
}

interface Biff8WorksheetSection {
  name: string;
  startOffset: number;
  endOffset: number;
}

function parseBiff8WorksheetSections(records: Biff8Record[]): Biff8WorksheetSection[] {
  const sheets = records
    .filter((record) => record.id === BIFF8_BOUNDSHEET_RECORD_ID)
    .map(readBiff8BoundSheet)
    .filter((sheet): sheet is { name: string; startOffset: number } => sheet !== null);
  const worksheetBofOffsets = parseBiff8WorksheetBofOffsets(records);
  const reconciledSheets = reconcileBiff8WorksheetStartOffsets(sheets, worksheetBofOffsets);
  const sortedStartOffsets = reconciledSheets.map((sheet) => sheet.startOffset).sort((left, right) => left - right);

  return reconciledSheets.map((sheet) => ({
    name: sheet.name,
    startOffset: sheet.startOffset,
    endOffset:
      sortedStartOffsets.find((startOffset) => startOffset > sheet.startOffset) ?? Number.POSITIVE_INFINITY,
  }));
}

function parseBiff8WorksheetBofOffsets(records: Biff8Record[]): number[] {
  return records
    .filter(
      (record) =>
        record.id === BIFF8_BOF_RECORD_ID &&
        record.data.byteLength >= 4 &&
        readUInt16Le(record.data, 2) === BIFF8_WORKSHEET_BOF_TYPE,
    )
    .map((record) => record.offset);
}

function reconcileBiff8WorksheetStartOffsets(
  sheets: Array<{ name: string; startOffset: number }>,
  worksheetBofOffsets: number[],
): Array<{ name: string; startOffset: number }> {
  if (sheets.length === 0 || worksheetBofOffsets.length !== sheets.length) return sheets;
  const worksheetBofOffsetSet = new Set(worksheetBofOffsets);
  const sheetOffsetCounts = new Map<number, number>();
  for (const sheet of sheets) {
    sheetOffsetCounts.set(sheet.startOffset, (sheetOffsetCounts.get(sheet.startOffset) ?? 0) + 1);
  }
  const invalidSheetIndexes = new Set<number>();
  const usedOffsets = new Set<number>();
  for (const [index, sheet] of sheets.entries()) {
    const offsetIsUnique = sheetOffsetCounts.get(sheet.startOffset) === 1;
    if (worksheetBofOffsetSet.has(sheet.startOffset) && offsetIsUnique) {
      usedOffsets.add(sheet.startOffset);
      continue;
    }
    invalidSheetIndexes.add(index);
  }
  if (invalidSheetIndexes.size === 0) return sheets;
  const remainingOffsets = worksheetBofOffsets.filter((offset) => !usedOffsets.has(offset));
  let remainingOffsetIndex = 0;
  return sheets.map((sheet, index) => {
    if (!invalidSheetIndexes.has(index)) return sheet;
    const startOffset = remainingOffsets[remainingOffsetIndex];
    remainingOffsetIndex += 1;
    return startOffset === undefined ? sheet : { ...sheet, startOffset };
  });
}

function readBiff8BoundSheet(record: Biff8Record): { name: string; startOffset: number } | null {
  if (record.data.byteLength < 8) return null;
  const sheetType = record.data[5];
  if (sheetType !== BIFF8_WORKSHEET_TYPE) return null;
  const parsedName = readBiff8ShortUnicodeString(record.data, 6);
  const name = parsedName ? normalizeExtractedBiff8Text(parsedName.value) : '';
  return name ? { name, startOffset: readUInt32Le(record.data, 0) } : null;
}

interface Biff8CellText {
  row: number;
  column: number;
  text: string;
}

interface Biff8CellFormat {
  ifmt: number;
  formatCode?: string;
}

interface Biff8MergedCellRange {
  firstRow: number;
  lastRow: number;
  firstColumn: number;
  lastColumn: number;
}

function readBiff8CellTexts(
  record: Biff8Record,
  sharedStrings: string[],
  cellFormats: Biff8CellFormat[],
  uses1904DateSystem: boolean,
  records: Biff8Record[],
  recordIndex: number,
): Biff8CellText[] {
  const cell = readBiff8CellText(record, sharedStrings, cellFormats, uses1904DateSystem, records, recordIndex);
  if (cell) return [cell];
  if (record.id === BIFF8_MULBLANK_RECORD_ID) return readBiff8MulBlankCellTexts(record);
  if (record.id === BIFF8_MULRK_RECORD_ID) return readBiff8MulRkCellTexts(record, cellFormats, uses1904DateSystem);
  return [];
}

function readBiff8CellText(
  record: Biff8Record,
  sharedStrings: string[],
  cellFormats: Biff8CellFormat[],
  uses1904DateSystem: boolean,
  records: Biff8Record[],
  recordIndex: number,
): Biff8CellText | null {
  const nextRecord = records[recordIndex + 1];
  if (record.id === BIFF8_BLANK_RECORD_ID && record.data.byteLength >= 6) {
    const row = readUInt16Le(record.data, 0);
    const column = readUInt16Le(record.data, 2);
    if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
    return { row, column, text: '' };
  }

  if (record.id === BIFF8_LABELSST_RECORD_ID && record.data.byteLength >= 6) {
    const row = readUInt16Le(record.data, 0);
    const column = readUInt16Le(record.data, 2);
    if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
    if (record.data.byteLength < 10) return { row, column, text: '' };
    const sharedStringIndex = readUInt32Le(record.data, 6);
    const value = sharedStrings[sharedStringIndex];
    if (value === undefined) return { row, column, text: '' };
    const text = normalizeExtractedBiff8Text(value);
    return { row, column, text };
  }

  if ((record.id === BIFF8_LABEL_RECORD_ID || record.id === BIFF8_RSTRING_RECORD_ID) && record.data.byteLength >= 6) {
    const row = readUInt16Le(record.data, 0);
    const column = readUInt16Le(record.data, 2);
    if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
    if (record.data.byteLength < 9) return { row, column, text: '' };
    const value = readBiff8ContinuedUnicodeStringAt(records, recordIndex, 6);
    if (value === null) return { row, column, text: '' };
    const text = normalizeExtractedBiff8Text(value);
    return { row, column, text };
  }

  if (record.id === BIFF8_BOOLERR_RECORD_ID && record.data.byteLength >= 6) {
    const row = readUInt16Le(record.data, 0);
    const column = readUInt16Le(record.data, 2);
    if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
    if (record.data.byteLength < 8) return { row, column, text: '' };
    const value = record.data[6];
    const isError = Boolean(record.data[7]);
    if (isError) {
      const text = formatBiff8ErrorValue(value);
      return { row, column, text: text ?? '' };
    }
    return { row, column, text: value ? 'TRUE' : 'FALSE' };
  }

  if (record.id === BIFF8_NUMBER_RECORD_ID && record.data.byteLength >= 6) {
    const row = readUInt16Le(record.data, 0);
    const column = readUInt16Le(record.data, 2);
    const cellFormatIndex = readUInt16Le(record.data, 4);
    if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
    if (record.data.byteLength < 14) return { row, column, text: '' };
    const value = readFloat64Le(record.data, 6);
    if (!Number.isFinite(value)) return { row, column, text: '' };
    return { row, column, text: formatBiff8NumberCell(value, cellFormats[cellFormatIndex], uses1904DateSystem) };
  }

  if (record.id === BIFF8_FORMULA_RECORD_ID && record.data.byteLength >= 6) {
    const row = readUInt16Le(record.data, 0);
    const column = readUInt16Le(record.data, 2);
    const cellFormatIndex = readUInt16Le(record.data, 4);
    if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
    if (record.data.byteLength < 14) return { row, column, text: '' };
    const specialValue = readBiff8FormulaSpecialCachedValue(record.data);
    const value = readFloat64Le(record.data, 6);
    if (specialValue?.type === 'boolean') {
      return { row, column, text: specialValue.value ? 'TRUE' : 'FALSE' };
    }
    if (specialValue?.type === 'error') {
      return { row, column, text: specialValue.text };
    }
    if (specialValue?.type === 'empty') {
      return { row, column, text: '' };
    }
    if (specialValue?.type === 'string') {
      if (nextRecord?.id === BIFF8_STRING_RECORD_ID) {
        const text = readBiff8StringRecordText(records, recordIndex + 1);
        return text === null ? { row, column, text: '' } : { row, column, text };
      }
      return { row, column, text: '' };
    }
    if (!Number.isFinite(value) && nextRecord?.id === BIFF8_STRING_RECORD_ID) {
      const text = readBiff8StringRecordText(records, recordIndex + 1);
      return text === null ? { row, column, text: '' } : { row, column, text };
    }
    if (!Number.isFinite(value)) return { row, column, text: '' };
    return { row, column, text: formatBiff8NumberCell(value, cellFormats[cellFormatIndex], uses1904DateSystem) };
  }

  if (record.id === BIFF8_RK_RECORD_ID && record.data.byteLength >= 6) {
    const row = readUInt16Le(record.data, 0);
    const column = readUInt16Le(record.data, 2);
    const cellFormatIndex = readUInt16Le(record.data, 4);
    if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
    if (record.data.byteLength < 10) return { row, column, text: '' };
    const value = decodeBiff8RkNumber(readUInt32Le(record.data, 6));
    if (value === null) return { row, column, text: '' };
    return { row, column, text: formatBiff8NumberCell(value, cellFormats[cellFormatIndex], uses1904DateSystem) };
  }

  return null;
}

function parseBiff8CustomNumberFormats(records: Biff8Record[]): Map<number, string> {
  const formats = new Map<number, string>();
  for (const [index, record] of records.entries()) {
    if (record.id !== BIFF8_FORMAT_RECORD_ID || record.data.byteLength < 5) continue;
    const value = readBiff8ContinuedUnicodeStringAt(records, index, 2);
    if (value === null) continue;
    const formatCode = normalizeExtractedBiff8Text(value);
    if (formatCode) formats.set(readUInt16Le(record.data, 0), formatCode);
  }
  return formats;
}

function parseBiff8CustomNumberFormatFallbackTexts(records: Biff8Record[]): Set<string> {
  const texts = new Set<string>();
  for (const [index, record] of records.entries()) {
    if (record.id !== BIFF8_FORMAT_RECORD_ID) continue;
    addBiff8PrintableFallbackTexts(texts, record.data);
    for (let continueIndex = index + 1; continueIndex < records.length; continueIndex += 1) {
      const continueRecord = records[continueIndex];
      if (continueRecord.id !== BIFF8_CONTINUE_RECORD_ID) break;
      addBiff8PrintableFallbackTexts(texts, continueRecord.data);
    }
  }
  return texts;
}

function parseBiff8InlineStringFallbackTexts(records: Biff8Record[]): Set<string> {
  const texts = new Set<string>();
  for (const [index, record] of records.entries()) {
    if (record.id !== BIFF8_LABEL_RECORD_ID && record.id !== BIFF8_RSTRING_RECORD_ID) continue;
    addBiff8PrintableFallbackTexts(texts, record.data);
    for (let continueIndex = index + 1; continueIndex < records.length; continueIndex += 1) {
      const continueRecord = records[continueIndex];
      if (continueRecord.id !== BIFF8_CONTINUE_RECORD_ID) break;
      addBiff8PrintableFallbackTexts(texts, continueRecord.data);
    }
  }
  return texts;
}

function parseBiff8SharedStringFallbackTexts(records: Biff8Record[]): Set<string> {
  const texts = new Set<string>();
  for (const [index, record] of records.entries()) {
    if (record.id !== BIFF8_SST_RECORD_ID) continue;
    addBiff8PrintableFallbackTexts(texts, record.data);
    for (let continueIndex = index + 1; continueIndex < records.length; continueIndex += 1) {
      const continueRecord = records[continueIndex];
      if (continueRecord.id !== BIFF8_CONTINUE_RECORD_ID) break;
      addBiff8PrintableFallbackTexts(texts, continueRecord.data);
    }
  }
  return texts;
}

function parseBiff8BoundSheetFallbackTexts(records: Biff8Record[]): Set<string> {
  const texts = new Set<string>();
  for (const record of records) {
    if (record.id !== BIFF8_BOUNDSHEET_RECORD_ID) continue;
    addBiff8PrintableFallbackTexts(texts, record.data);
  }
  return texts;
}

function addBiff8PrintableFallbackTexts(texts: Set<string>, bytes: Uint8Array): void {
  for (const text of extractAsciiPrintableRuns(bytes)) texts.add(text);
  for (const text of extractUtf16LePrintableRuns(bytes)) texts.add(text);
}

function parseBiff8CellFormats(records: Biff8Record[], customNumberFormats: Map<number, string>): Biff8CellFormat[] {
  const formats: Biff8CellFormat[] = [];
  for (const record of records) {
    if (record.id !== BIFF8_XF_RECORD_ID || record.data.byteLength < 4) continue;
    const ifmt = readUInt16Le(record.data, 2);
    formats.push({ ifmt, formatCode: customNumberFormats.get(ifmt) });
  }
  return formats;
}

function parseBiff8Uses1904DateSystem(records: Biff8Record[]): boolean {
  return records.some(
    (record) =>
      record.id === BIFF8_DATE1904_RECORD_ID && record.data.byteLength >= 2 && readUInt16Le(record.data, 0) !== 0,
  );
}

function readBiff8FormulaSpecialCachedValue(
  bytes: Uint8Array,
):
  | { type: 'string' }
  | { type: 'boolean'; value: boolean }
  | { type: 'error'; text: string }
  | { type: 'empty' }
  | null {
  if (bytes.byteLength < 14 || bytes[12] !== 0xff || bytes[13] !== 0xff) return null;
  if (bytes[6] === 0x00) return { type: 'string' };
  if (bytes[6] === 0x01) return { type: 'boolean', value: Boolean(bytes[8]) };
  if (bytes[6] === 0x02) {
    const text = formatBiff8ErrorValue(bytes[8]);
    return { type: 'error', text: text ?? '' };
  }
  if (bytes[6] === 0x03) return { type: 'empty' };
  return null;
}

function formatBiff8ErrorValue(value: number): string | null {
  if (value === 0x00) return '#NULL!';
  if (value === 0x07) return '#DIV/0!';
  if (value === 0x0f) return '#VALUE!';
  if (value === 0x17) return '#REF!';
  if (value === 0x1d) return '#NAME?';
  if (value === 0x24) return '#NUM!';
  if (value === 0x2a) return '#N/A';
  return null;
}

function readBiff8StringRecordText(records: Biff8Record[], recordIndex: number): string | null {
  const stringRecord = records[recordIndex];
  if (!stringRecord || stringRecord.id !== BIFF8_STRING_RECORD_ID) return null;
  const stringData = concatenateBiff8ContinuedRecordData(records, recordIndex);
  const cursor: Biff8ContinuedRecordCursor = { parts: stringData.parts, partIndex: 0, offset: 0 };
  const value = readBiff8ContinuedUnicodeString(cursor);
  if (value === null) return null;
  const text = normalizeExtractedBiff8Text(value);
  return text;
}

function readBiff8MulRkCellTexts(
  record: Biff8Record,
  cellFormats: Biff8CellFormat[],
  uses1904DateSystem: boolean,
): Biff8CellText[] {
  if (record.data.byteLength < 6) return [];
  const row = readUInt16Le(record.data, 0);
  const firstColumn = readUInt16Le(record.data, 2);
  const inferredCellCountWithoutLastColumn =
    record.data.byteLength >= 10 && (record.data.byteLength - 4) % 6 === 0
      ? (record.data.byteLength - 4) / 6
      : 0;
  const lastColumn = inferredCellCountWithoutLastColumn
    ? null
    : readUInt16Le(record.data, record.data.byteLength - 2);
  const cellCount = lastColumn === null ? inferredCellCountWithoutLastColumn : lastColumn - firstColumn + 1;
  if (!Number.isInteger(row) || !Number.isInteger(firstColumn) || cellCount <= 0 || cellCount > 256) {
    return [];
  }

  const cells: Biff8CellText[] = [];
  const availableCellCount =
    lastColumn === null
      ? inferredCellCountWithoutLastColumn
      : Math.min(cellCount, Math.floor((record.data.byteLength - 6) / 6));
  let offset = 4;
  for (let index = 0; index < cellCount; index += 1) {
    if (index >= availableCellCount) {
      cells.push({ row, column: firstColumn + index, text: '' });
      continue;
    }
    const cellFormatIndex = readUInt16Le(record.data, offset);
    offset += 2;
    const value = decodeBiff8RkNumber(readUInt32Le(record.data, offset));
    offset += 4;
    cells.push({
      row,
      column: firstColumn + index,
      text: value === null ? '' : formatBiff8NumberCell(value, cellFormats[cellFormatIndex], uses1904DateSystem),
    });
  }
  return cells;
}

function readBiff8MulBlankCellTexts(record: Biff8Record): Biff8CellText[] {
  if (record.data.byteLength < 6) return [];
  const row = readUInt16Le(record.data, 0);
  const firstColumn = readUInt16Le(record.data, 2);
  if (record.data.byteLength < 8) {
    return Number.isInteger(row) && Number.isInteger(firstColumn) ? [{ row, column: firstColumn, text: '' }] : [];
  }
  const lastColumn = readUInt16Le(record.data, record.data.byteLength - 2);
  const inferredCellCountWithoutLastColumn =
    Number.isInteger(lastColumn) && lastColumn < firstColumn && (record.data.byteLength - 4) % 2 === 0
      ? (record.data.byteLength - 4) / 2
      : 0;
  const cellCount = inferredCellCountWithoutLastColumn || lastColumn - firstColumn + 1;
  if (!Number.isInteger(row) || !Number.isInteger(firstColumn) || cellCount <= 0) return [];

  return Array.from({ length: cellCount }, (_, index) => ({
    row,
    column: firstColumn + index,
    text: '',
  }));
}

function parseBiff8MergedCellRanges(records: Biff8Record[]): Biff8MergedCellRange[] {
  const ranges: Biff8MergedCellRange[] = [];
  for (const record of records) {
    if (record.id !== BIFF8_MERGEDCELLS_RECORD_ID || record.data.byteLength < 10) continue;
    const rangeCount = readUInt16Le(record.data, 0);
    const readableRangeCount = Math.min(rangeCount, Math.floor((record.data.byteLength - 2) / 8));
    for (let index = 0; index < readableRangeCount; index += 1) {
      const offset = 2 + index * 8;
      const firstRow = readUInt16Le(record.data, offset);
      const lastRow = readUInt16Le(record.data, offset + 2);
      const firstColumn = readUInt16Le(record.data, offset + 4);
      const lastColumn = readUInt16Le(record.data, offset + 6);
      if (firstRow > lastRow || firstColumn > lastColumn) continue;
      ranges.push({ firstRow, lastRow, firstColumn, lastColumn });
    }
  }
  return ranges;
}

function parseBiff8SharedStrings(records: Biff8Record[]): string[] {
  const sstIndex = records.findIndex((record) => record.id === BIFF8_SST_RECORD_ID);
  const sst = records[sstIndex];
  if (!sst || sst.data.byteLength < 8) return [];

  const uniqueCount = readUInt32Le(sst.data, 4);
  const sstData = concatenateBiff8ContinuedRecordData(records, sstIndex);
  const strings: string[] = [];
  const cursor: Biff8ContinuedRecordCursor = { parts: sstData.parts, partIndex: 0, offset: 8 };
  while (strings.length < uniqueCount && hasBiff8ContinuedRecordBytes(cursor)) {
    const parsed = readBiff8ContinuedUnicodeString(cursor);
    if (parsed === null) break;
    strings.push(parsed);
  }
  return strings;
}

function readBiff8ContinuedUnicodeStringAt(records: Biff8Record[], recordIndex: number, offset: number): string | null {
  const continuedData = concatenateBiff8ContinuedRecordData(records, recordIndex);
  const cursor: Biff8ContinuedRecordCursor = { parts: continuedData.parts, partIndex: 0, offset };
  return readBiff8ContinuedUnicodeString(cursor);
}

interface Biff8ContinuedRecordData {
  parts: Uint8Array[];
  byteLength: number;
}

interface Biff8ContinuedRecordCursor {
  parts: Uint8Array[];
  partIndex: number;
  offset: number;
}

function concatenateBiff8ContinuedRecordData(records: Biff8Record[], recordIndex: number): Biff8ContinuedRecordData {
  const parts = [records[recordIndex].data];
  for (let index = recordIndex + 1; index < records.length; index += 1) {
    if (records[index].id !== BIFF8_CONTINUE_RECORD_ID) break;
    parts.push(records[index].data);
  }
  return { parts, byteLength: parts.reduce((total, part) => total + part.byteLength, 0) };
}

function hasBiff8ContinuedRecordBytes(cursor: Biff8ContinuedRecordCursor): boolean {
  for (let index = cursor.partIndex; index < cursor.parts.length; index += 1) {
    const offset = index === cursor.partIndex ? cursor.offset : 0;
    if (offset < cursor.parts[index].byteLength) return true;
  }
  return false;
}

function readBiff8ContinuedUnicodeString(cursor: Biff8ContinuedRecordCursor): string | null {
  const charCount = readBiff8ContinuedUInt16(cursor);
  const flags = readBiff8ContinuedByte(cursor);
  if (charCount === null || flags === null) return null;

  let isUtf16 = Boolean(flags & 0x01);
  const hasRichText = Boolean(flags & 0x08);
  const hasExtRst = Boolean(flags & 0x04);
  const richTextRuns = hasRichText ? readBiff8ContinuedUInt16(cursor) : 0;
  if (richTextRuns === null) return null;
  const extRstSize = hasExtRst ? readBiff8ContinuedUInt32(cursor) : 0;
  if (extRstSize === null) return null;

  let value = '';
  for (let index = 0; index < charCount; index += 1) {
    const bytesPerChar = isUtf16 ? 2 : 1;
    if (!hasBiff8ContinuedBytesInCurrentPart(cursor, bytesPerChar)) {
      const splitUtf16LowByte = isUtf16 ? readBiff8SplitUtf16LowByte(cursor) : null;
      if (!advanceBiff8ContinuedRecordPart(cursor)) return value || null;
      const continuationFlags = readBiff8ContinuedByte(cursor);
      if (continuationFlags === null) return value || null;
      isUtf16 = Boolean(continuationFlags & 0x01);
      if (splitUtf16LowByte !== null && isUtf16) {
        const highByte = readBiff8ContinuedByteFromCurrentPart(cursor);
        if (highByte === null) return value || null;
        value += String.fromCharCode(splitUtf16LowByte | (highByte << 8));
        continue;
      }
    }
    if (isUtf16) {
      const code = readBiff8ContinuedUInt16FromCurrentPart(cursor);
      if (code === null) return value || null;
      value += String.fromCharCode(code);
    } else {
      const byte = readBiff8ContinuedByteFromCurrentPart(cursor);
      if (byte === null) return value || null;
      value += String.fromCharCode(byte);
    }
  }

  if (!skipBiff8ContinuedStringTailBytes(cursor, richTextRuns * 4 + extRstSize)) return value;
  return value;
}

function readBiff8SplitUtf16LowByte(cursor: Biff8ContinuedRecordCursor): number | null {
  const part = cursor.parts[cursor.partIndex];
  if (!part || cursor.offset + 1 !== part.byteLength) return null;
  const byte = part[cursor.offset];
  cursor.offset += 1;
  return byte;
}

function readBiff8ContinuedUInt16(cursor: Biff8ContinuedRecordCursor): number | null {
  const bytes = readBiff8ContinuedBytes(cursor, 2);
  return bytes ? readUInt16Le(bytes, 0) : null;
}

function readBiff8ContinuedUInt32(cursor: Biff8ContinuedRecordCursor): number | null {
  const bytes = readBiff8ContinuedBytes(cursor, 4);
  return bytes ? readUInt32Le(bytes, 0) : null;
}

function readBiff8ContinuedByte(cursor: Biff8ContinuedRecordCursor): number | null {
  const bytes = readBiff8ContinuedBytes(cursor, 1);
  return bytes?.[0] ?? null;
}

function readBiff8ContinuedBytes(cursor: Biff8ContinuedRecordCursor, length: number): Uint8Array | null {
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    const byte = readBiff8ContinuedByteFromCurrentOrNextPart(cursor);
    if (byte === null) return null;
    bytes[index] = byte;
  }
  return bytes;
}

function readBiff8ContinuedByteFromCurrentOrNextPart(cursor: Biff8ContinuedRecordCursor): number | null {
  while (cursor.partIndex < cursor.parts.length) {
    const part = cursor.parts[cursor.partIndex];
    if (cursor.offset < part.byteLength) {
      const byte = part[cursor.offset];
      cursor.offset += 1;
      return byte;
    }
    cursor.partIndex += 1;
    cursor.offset = 0;
  }
  return null;
}

function readBiff8ContinuedUInt16FromCurrentPart(cursor: Biff8ContinuedRecordCursor): number | null {
  if (!hasBiff8ContinuedBytesInCurrentPart(cursor, 2)) return null;
  const part = cursor.parts[cursor.partIndex];
  const value = readUInt16Le(part, cursor.offset);
  cursor.offset += 2;
  return value;
}

function readBiff8ContinuedByteFromCurrentPart(cursor: Biff8ContinuedRecordCursor): number | null {
  if (!hasBiff8ContinuedBytesInCurrentPart(cursor, 1)) return null;
  const part = cursor.parts[cursor.partIndex];
  const value = part[cursor.offset];
  cursor.offset += 1;
  return value;
}

function hasBiff8ContinuedBytesInCurrentPart(cursor: Biff8ContinuedRecordCursor, length: number): boolean {
  const part = cursor.parts[cursor.partIndex];
  return Boolean(part && cursor.offset + length <= part.byteLength);
}

function advanceBiff8ContinuedRecordPart(cursor: Biff8ContinuedRecordCursor): boolean {
  cursor.partIndex += 1;
  cursor.offset = 0;
  return cursor.partIndex < cursor.parts.length;
}

function skipBiff8ContinuedStringTailBytes(cursor: Biff8ContinuedRecordCursor, length: number): boolean {
  for (let index = 0; index < length; ) {
    const part = cursor.parts[cursor.partIndex];
    if (part && cursor.offset < part.byteLength) {
      cursor.offset += 1;
      index += 1;
      continue;
    }
    if (!advanceBiff8ContinuedRecordPart(cursor)) return false;
    if (readBiff8ContinuedByteFromCurrentPart(cursor) === null) return false;
  }
  return true;
}

function readBiff8ShortUnicodeString(bytes: Uint8Array, offset: number): { value: string; nextOffset: number } | null {
  if (offset + 2 > bytes.byteLength) return null;
  const charCount = bytes[offset];
  const flags = bytes[offset + 1];
  const isUtf16 = Boolean(flags & 0x01);
  const textStart = offset + 2;
  const declaredTextEnd = textStart + charCount * (isUtf16 ? 2 : 1);
  const textEnd = Math.min(declaredTextEnd, bytes.byteLength);
  if (textEnd <= textStart) return null;
  const readableTextEnd = isUtf16 ? textStart + Math.floor((textEnd - textStart) / 2) * 2 : textEnd;
  if (readableTextEnd <= textStart) return null;
  const value = isUtf16
    ? decodeUtf16Le(bytes.subarray(textStart, readableTextEnd))
    : new TextDecoder('latin1').decode(bytes.subarray(textStart, readableTextEnd));
  return { value, nextOffset: readableTextEnd };
}

function extractPowerPointTextAtoms(bytes: Uint8Array): PowerPointText | null {
  const sectionText = extractPowerPointSlideAndNotesTextSections(bytes);
  if (sectionText) return sectionText;

  return extractPowerPointTextBodiesInRange(bytes, 0, bytes.byteLength);
}

function extractPowerPointSlideAndNotesTextSections(bytes: Uint8Array): PowerPointText | null {
  const sections: string[] = [];
  const textBodies = new Set<string>();
  let slideNumber = 1;
  let notesNumber = 1;

  for (let offset = 0; offset + PPT_RECORD_HEADER_SIZE <= bytes.byteLength; offset += 1) {
    const header = readPowerPointRecordHeader(bytes, offset);
    if (!header || header.recVer !== 0x0f) continue;
    const sectionKind =
      header.recType === PPT_SLIDE_CONTAINER_RECORD_TYPE
        ? 'Slide'
        : header.recType === PPT_NOTES_CONTAINER_RECORD_TYPE
          ? 'Notes'
          : null;
    if (!sectionKind) continue;

    const currentSectionNumber = sectionKind === 'Slide' ? slideNumber : notesNumber;
    if (sectionKind === 'Slide') slideNumber += 1;
    else notesNumber += 1;
    const slideText = extractPowerPointTextBodiesInRange(bytes, header.dataStart, header.dataEnd);
    if (slideText) {
      sections.push(`# ${sectionKind} ${currentSectionNumber}\n${slideText.text}`);
      for (const textBody of slideText.textBodies) textBodies.add(textBody);
    }
    offset = Math.max(offset, header.dataEnd - 1);
  }

  const text = sections.join('\n');
  return text ? { text, textBodies } : null;
}

function extractPowerPointTextBodiesInRange(
  bytes: Uint8Array,
  startOffset: number,
  endOffset: number,
): PowerPointText | null {
  const parts: string[] = [];
  const textBodies = new Set<string>();
  for (let offset = startOffset; offset + PPT_RECORD_HEADER_SIZE <= endOffset; offset += 1) {
    const textBody = readPowerPointTextBodyAt(bytes, offset, endOffset);
    if (!textBody) continue;
    parts.push(textBody.text);
    textBodies.add(textBody.text);
    for (const textPart of textBody.text.split('\n')) {
      if (textPart) textBodies.add(textPart);
    }
    offset = Math.max(offset, textBody.nextOffset - 1);
  }

  const text = parts.join('\n');
  return text ? { text, textBodies } : null;
}

function readPowerPointTextBodyAt(
  bytes: Uint8Array,
  offset: number,
  endOffset = bytes.byteLength,
): { text: string; nextOffset: number } | null {
  const header = readPowerPointRecordHeader(bytes, offset);
  const textHeaderDataEnd = header ? Math.min(header.dataStart + 4, endOffset) : 0;
  if (
    !header ||
    textHeaderDataEnd - header.dataStart < 4 ||
    header.recVer !== 0 ||
    header.recInstance > PPT_MAX_SUPPORTED_TEXT_HEADER_INSTANCE ||
    header.recType !== PPT_TEXT_HEADER_ATOM_RECORD_TYPE ||
    header.recLen < 4
  ) {
    return null;
  }

  let cursor = textHeaderDataEnd;
  const parts: string[] = [];
  const seenParts = new Set<string>();
  while (cursor + PPT_RECORD_HEADER_SIZE <= endOffset) {
    const textRecord = readPowerPointRecordHeader(bytes, cursor);
    if (!textRecord || textRecord.dataStart > endOffset) break;
    if (textRecord.recType === PPT_TEXT_HEADER_ATOM_RECORD_TYPE) break;
    const textRecordDataEnd = Math.min(textRecord.dataEnd, endOffset);
    const isTextAtom =
      textRecord.recVer === 0 &&
      textRecord.recInstance === 0 &&
      (textRecord.recType === PPT_TEXT_BYTES_ATOM_RECORD_TYPE ||
        textRecord.recType === PPT_TEXT_CHARS_ATOM_RECORD_TYPE);
    const isOverrunningRecord =
      textRecord.dataEnd >= endOffset && textRecord.recLen > textRecordDataEnd - textRecord.dataStart;
    const resyncOffset =
      isTextAtom && isOverrunningRecord
        ? findNextPowerPointTextBodyRecordOffset(bytes, textRecord.dataStart + 1, textRecordDataEnd, endOffset)
        : null;
    const textPayloadEnd = resyncOffset ?? textRecordDataEnd;
    if (textRecord.recVer === 0 && textRecord.recInstance === 0) {
      if (textRecord.recType === PPT_TEXT_BYTES_ATOM_RECORD_TYPE) {
        const text = normalizeExtractedLegacyPowerPointText(
          decodePowerPointTextBytes(
            stripEmbeddedPowerPointTextBodyControlHeaders(bytes.subarray(textRecord.dataStart, textPayloadEnd)),
          ),
        );
        if (text && !seenParts.has(text)) {
          parts.push(text);
          seenParts.add(text);
        }
      }
      if (
        textRecord.recType === PPT_TEXT_CHARS_ATOM_RECORD_TYPE &&
        textPayloadEnd - textRecord.dataStart >= 2
      ) {
        const textCharsBytes = stripEmbeddedPowerPointTextBodyControlHeaders(
          bytes.subarray(textRecord.dataStart, textPayloadEnd),
        );
        const textCharsDataEnd = textCharsBytes.byteLength - (textCharsBytes.byteLength % 2);
        const text = normalizeExtractedLegacyPowerPointText(
          stripIsolatedUtf16Surrogates(decodeUtf16Le(textCharsBytes.subarray(0, textCharsDataEnd))),
        );
        if (text && !seenParts.has(text)) {
          parts.push(text);
          seenParts.add(text);
        }
      }
    }
    if (resyncOffset !== null) {
      cursor = resyncOffset;
      continue;
    }
    if (!isTextAtom && isOverrunningRecord) {
      cursor += 1;
      continue;
    }
    cursor = textRecordDataEnd;
  }

  const text = parts.join('\n');
  return text ? { text, nextOffset: cursor } : null;
}

function findNextPowerPointTextBodyRecordOffset(
  bytes: Uint8Array,
  startOffset: number,
  endOffset: number,
  bodyEndOffset: number,
): number | null {
  for (let offset = startOffset; offset + PPT_RECORD_HEADER_SIZE <= endOffset; offset += 1) {
    const header = readPowerPointRecordHeader(bytes, offset);
    if (!header || header.dataStart > bodyEndOffset || header.dataEnd > bodyEndOffset) continue;
    if (header.recType === PPT_TEXT_HEADER_ATOM_RECORD_TYPE) {
      if (
        header.recVer === 0 &&
        header.recInstance <= PPT_MAX_SUPPORTED_TEXT_HEADER_INSTANCE &&
        header.recLen >= 4 &&
        hasLaterPowerPointTextBodyTextRecord(bytes, header.dataEnd, endOffset, bodyEndOffset)
      ) {
        return offset;
      }
      continue;
    }
    if (
      header.recVer === 0 &&
      header.recInstance === 0 &&
      (header.recType === PPT_TEXT_BYTES_ATOM_RECORD_TYPE || header.recType === PPT_TEXT_CHARS_ATOM_RECORD_TYPE)
    ) {
      if (header.recLen > 0 || hasLaterPowerPointTextBodyTextRecord(bytes, header.dataEnd, endOffset, bodyEndOffset)) {
        return offset;
      }
      continue;
    }
    if (
      header.recVer === 0 &&
      header.recInstance === 0 &&
      hasLaterPowerPointTextBodyTextRecord(bytes, header.dataEnd, endOffset, bodyEndOffset)
    ) {
      return offset;
    }
  }
  return null;
}

function hasLaterPowerPointTextBodyTextRecord(
  bytes: Uint8Array,
  startOffset: number,
  endOffset: number,
  bodyEndOffset: number,
): boolean {
  for (let offset = startOffset; offset + PPT_RECORD_HEADER_SIZE <= endOffset; offset += 1) {
    const header = readPowerPointRecordHeader(bytes, offset);
    if (!header || header.dataStart > bodyEndOffset || header.dataEnd > bodyEndOffset) continue;
    if (
      header.recType === PPT_TEXT_HEADER_ATOM_RECORD_TYPE &&
      header.recVer === 0 &&
      header.recInstance <= PPT_MAX_SUPPORTED_TEXT_HEADER_INSTANCE &&
      header.recLen >= 4
    ) {
      return true;
    }
    if (
      header.recVer === 0 &&
      header.recInstance === 0 &&
      (header.recType === PPT_TEXT_BYTES_ATOM_RECORD_TYPE || header.recType === PPT_TEXT_CHARS_ATOM_RECORD_TYPE)
    ) {
      return true;
    }
  }
  return false;
}

function stripEmbeddedPowerPointTextBodyControlHeaders(bytes: Uint8Array): Uint8Array {
  const stripped: number[] = [];
  for (let offset = 0; offset < bytes.byteLength; ) {
    const controlHeaderLength = getEmbeddedPowerPointTextBodyControlHeaderLength(bytes, offset);
    if (controlHeaderLength > 0) {
      offset += controlHeaderLength;
      continue;
    }
    stripped.push(bytes[offset]);
    offset += 1;
  }
  return new Uint8Array(stripped);
}

function getEmbeddedPowerPointTextBodyControlHeaderLength(bytes: Uint8Array, offset: number): number {
  const header = readPowerPointRecordHeader(bytes, offset);
  if (
    header &&
      header.recVer === 0 &&
      header.recInstance === 0 &&
      header.recLen === 0 &&
      (header.recType === PPT_TEXT_BYTES_ATOM_RECORD_TYPE || header.recType === PPT_TEXT_CHARS_ATOM_RECORD_TYPE)
  ) {
    return PPT_RECORD_HEADER_SIZE;
  }
  if (
    header &&
    header.recType === PPT_TEXT_HEADER_ATOM_RECORD_TYPE &&
    header.recVer === 0 &&
    header.recInstance <= PPT_MAX_SUPPORTED_TEXT_HEADER_INSTANCE &&
    header.recLen >= 4 &&
    header.dataEnd <= bytes.byteLength
  ) {
    return header.dataEnd - offset;
  }
  return 0;
}

function readPowerPointRecordHeader(
  bytes: Uint8Array,
  offset: number,
): { recVer: number; recInstance: number; recType: number; recLen: number; dataStart: number; dataEnd: number } | null {
  if (offset + PPT_RECORD_HEADER_SIZE > bytes.byteLength) return null;
  const instanceAndVersion = readUInt16Le(bytes, offset);
  const recLen = readUInt32Le(bytes, offset + 4);
  const dataStart = offset + PPT_RECORD_HEADER_SIZE;
  const dataEnd = Math.min(dataStart + recLen, bytes.byteLength);
  return {
    recVer: instanceAndVersion & 0x000f,
    recInstance: instanceAndVersion >> 4,
    recType: readUInt16Le(bytes, offset + 2),
    recLen,
    dataStart,
    dataEnd,
  };
}

function decodePowerPointTextBytes(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) {
    const mappedCharacter = WINDOWS_1252_CONTROL_CHARACTERS[byte];
    if (mappedCharacter) {
      text += mappedCharacter;
    } else if (byte === 0x09 || byte === 0x0a || byte === 0x0b || byte === 0x0d || (byte >= 0x20 && byte <= 0x7e) || byte > 0x9f) {
      text += String.fromCharCode(byte);
    }
  }
  return text;
}

function stripIsolatedUtf16Surrogates(text: string): string {
  if (!text) return text;
  let sanitized = '';
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        sanitized += text[index] + text[index + 1];
        index += 1;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue;
    sanitized += text[index];
  }
  return sanitized;
}

function normalizeExtractedLegacyPowerPointText(text: string): string {
  return normalizeExtractedLegacyOfficeText(
    stripPowerPointTextControlCharacters(text.split(String.fromCharCode(0x0b)).join('\n')),
  );
}

function stripPowerPointTextControlCharacters(text: string): string {
  let stripped = '';
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f) continue;
    stripped += text[index];
  }
  return stripped;
}

function normalizeExtractedBiff8Text(text: string): string {
  return normalizeExtractedLegacyOfficeText(stripBiff8TextControlCharacters(stripIsolatedUtf16Surrogates(text)));
}

function stripBiff8TextControlCharacters(text: string): string {
  let stripped = '';
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f) continue;
    stripped += text[index];
  }
  return stripped;
}

async function writeTemporaryLegacyWord(bytes: Uint8Array): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'openclaw-legacy-word-'));
  const filePath = path.join(directory, 'document.doc');
  await writeFile(filePath, bytes);
  return filePath;
}

async function runTextutilOnMac(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync('textutil', ['-convert', 'txt', '-stdout', filePath], {
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout;
}

function normalizeExtractedLegacyOfficeText(text: string, options: { preserveTabEdges?: boolean } = {}): string {
  const trimText = options.preserveTabEdges
    ? (value: string) => value.replace(/^[^\S\t]+|[^\S\t]+$/g, '')
    : (value: string) => value.trim();
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .split('\t')
        .map((cell) => cell.replace(/[^\S\t]+/g, ' ').trim())
        .join('\t'),
    )
    .map(trimText)
    .filter((line) => options.preserveTabEdges || Boolean(line))
    .join('\n');
  return trimText(normalized);
}

function extractUtf16LePrintableRuns(bytes: Uint8Array): string[] {
  const runs: string[] = [];
  for (const offset of [0, 1]) {
    let current = '';
    for (let index = offset; index + 1 < bytes.byteLength; index += 2) {
      const code = bytes[index] | (bytes[index + 1] << 8);
      if (isPrintableLegacyOfficeCodePoint(code)) {
        current += String.fromCharCode(code);
        continue;
      }
      pushLegacyBinaryRun(runs, current, { requireAsciiSignal: true });
      current = '';
    }
    pushLegacyBinaryRun(runs, current, { requireAsciiSignal: true });
  }
  return runs;
}

function extractAsciiPrintableRuns(bytes: Uint8Array): string[] {
  const runs: string[] = [];
  let current = '';
  for (const byte of bytes) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) {
      current += String.fromCharCode(byte);
      continue;
    }
    pushLegacyBinaryRun(runs, current);
    current = '';
  }
  pushLegacyBinaryRun(runs, current);
  return runs;
}

function pushLegacyBinaryRun(runs: string[], value: string, options: { requireAsciiSignal?: boolean } = {}): void {
  const normalized = normalizeExtractedLegacyOfficeText(value);
  if (normalized.length < MIN_LEGACY_BINARY_RUN_LENGTH || !/[A-Za-z0-9\u4e00-\u9fff]/.test(normalized)) return;
  if (options.requireAsciiSignal && getAsciiSignalRatio(normalized) < 0.6) return;
  runs.push(normalized);
}

function isStructuredBiffFallbackNoise(value: string, cellTexts: Set<string>): boolean {
  let stripped = value;
  let matched = false;
  for (const cellText of Array.from(cellTexts).sort((left, right) => right.length - left.length)) {
    if (!cellText || !stripped.includes(cellText)) continue;
    matched = true;
    stripped = stripped.split(cellText).join('');
  }
  if (!matched) return false;
  const compact = stripped.replace(/\s+/g, '');
  if (!compact) return true;
  if (/[\u4e00-\u9fff]/.test(compact)) return false;
  const asciiSignal = compact.match(/[A-Za-z0-9]/g)?.length ?? 0;
  return asciiSignal < 2 || asciiSignal / compact.length < 0.6;
}

function isStructuredPowerPointFallbackNoise(value: string, textBodies: Set<string>): boolean {
  return isStructuredBiffFallbackNoise(value, textBodies);
}

function isPrintableLegacyOfficeCodePoint(code: number): boolean {
  return (
    code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd)
  );
}

function getAsciiSignalRatio(value: string): number {
  const compact = value.replace(/\s+/g, '');
  if (!compact) return 0;
  const asciiSignal = compact.match(/[A-Za-z0-9.,:;!?()[\]{}'"`/_+-]/g)?.length ?? 0;
  return asciiSignal / compact.length;
}

function readUInt16Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32Le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readFloat64Le(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getFloat64(0, true);
}

function decodeBiff8RkNumber(raw: number): number | null {
  const divideBy100 = Boolean(raw & 0x01);
  const isInteger = Boolean(raw & 0x02);
  let value: number;

  if (isInteger) {
    value = raw >> 2;
  } else {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setUint32(4, raw & 0xfffffffc, true);
    value = new DataView(bytes.buffer).getFloat64(0, true);
  }

  if (divideBy100) value /= 100;
  return Number.isFinite(value) ? value : null;
}

function formatBiff8NumberCell(
  value: number,
  cellFormat: Biff8CellFormat | undefined,
  uses1904DateSystem: boolean,
): string {
  const dateCellFormat = cellFormat ? getBiff8DateCellFormatForValue(value, cellFormat) : undefined;
  if (dateCellFormat && isBiff8DateFormat(dateCellFormat)) {
    const date = formatBiff8ExcelSerialDate(value, uses1904DateSystem, getBiff8DateTimePrecision(dateCellFormat));
    if (date) return date;
  }
  if (cellFormat && isBiff8PercentageFormat(cellFormat)) {
    return formatBiff8PercentageCell(value, cellFormat);
  }
  if (cellFormat && isBiff8ScientificFormat(cellFormat)) {
    return formatBiff8ScientificCell(value, cellFormat);
  }
  if (cellFormat && isBiff8FractionFormat(cellFormat)) {
    return formatBiff8FractionCell(value, cellFormat);
  }
  if (cellFormat && isBiff8CurrencyFormat(cellFormat)) {
    return formatBiff8CurrencyCell(value, cellFormat);
  }
  if (cellFormat && isBiff8DecimalNumberFormat(cellFormat)) {
    return formatBiff8DecimalNumberCell(value, cellFormat);
  }
  return Number.isInteger(value) ? String(value) : String(value);
}

function getBiff8DateCellFormatForValue(value: number, cellFormat: Biff8CellFormat): Biff8CellFormat {
  if (!cellFormat.formatCode) return cellFormat;
  return {
    ...cellFormat,
    formatCode: getBiff8RawFormatSectionForValue(value, cellFormat.formatCode),
  };
}

function isBiff8DateFormat(cellFormat: Biff8CellFormat): boolean {
  return (
    isBiff8BuiltInDateFormat(cellFormat.ifmt) ||
    isBiff8BuiltInTimeFormat(cellFormat.ifmt) ||
    isBiff8BuiltInMinuteSecondTimeFormat(cellFormat.ifmt) ||
    isBiff8BuiltInFractionalSecondTimeFormat(cellFormat.ifmt) ||
    isBiff8BuiltInElapsedHourFormat(cellFormat.ifmt) ||
    isBiff8CustomDateFormat(cellFormat.formatCode) ||
    isBiff8CustomTimeFormat(cellFormat.formatCode)
  );
}

function isBiff8BuiltInDateFormat(formatIndex: number): boolean {
  return BIFF8_BUILT_IN_DATE_FORMAT_IDS.has(formatIndex);
}

function isBiff8BuiltInTimeFormat(formatIndex: number): boolean {
  return BIFF8_BUILT_IN_TIME_FORMAT_IDS.has(formatIndex);
}

function isBiff8BuiltInMinuteSecondTimeFormat(formatIndex: number): boolean {
  return BIFF8_BUILT_IN_MINUTE_SECOND_TIME_FORMAT_IDS.has(formatIndex);
}

function isBiff8BuiltInFractionalSecondTimeFormat(formatIndex: number): boolean {
  return BIFF8_BUILT_IN_FRACTIONAL_SECOND_TIME_FORMAT_IDS.has(formatIndex);
}

function isBiff8BuiltInElapsedHourFormat(formatIndex: number): boolean {
  return BIFF8_BUILT_IN_ELAPSED_HOUR_FORMAT_IDS.has(formatIndex);
}

function isBiff8PercentageFormat(cellFormat: Biff8CellFormat): boolean {
  return (
    BIFF8_BUILT_IN_PERCENT_FORMAT_DECIMALS.has(cellFormat.ifmt) ||
    splitBiff8FormatSections(cellFormat.formatCode).some(isBiff8PercentageFormatSection)
  );
}

function formatBiff8PercentageCell(value: number, cellFormat: Biff8CellFormat): string {
  const section = getBiff8NumberFormatSection(value, cellFormat.formatCode);
  const literalText = getBiff8LiteralNumberFormatSectionText(section);
  if (literalText !== null) return literalText;
  if (!BIFF8_BUILT_IN_PERCENT_FORMAT_DECIMALS.has(cellFormat.ifmt) && !isBiff8PercentageFormatSection(section)) {
    return formatBiff8DecimalNumberCell(value, cellFormat);
  }
  const scaleFactor = getBiff8NumberScaleFactor(section);
  const displaySection = removeBiff8NumberScaleCommas(section);
  const decimals = getBiff8PercentageDecimalPlaces(cellFormat, displaySection);
  const rounded = Number(((value / scaleFactor) * 100).toFixed(decimals));
  const absoluteText = Math.abs(Object.is(rounded, -0) ? 0 : rounded).toFixed(decimals);
  const affixes = getBiff8NumberFormatAffixes(displaySection);
  const suffix = affixes.suffix || '%';
  if (value < 0 && isBiff8ParenthesizedPercentageSection(displaySection)) {
    return `${affixes.prefix || '('}${absoluteText}${suffix}`;
  }
  const sign = value < 0 && !hasBiff8ExplicitNegativePrefix(affixes.prefix) ? '-' : '';
  return `${sign}${affixes.prefix}${absoluteText}${suffix}`;
}

function isBiff8PercentageFormatSection(formatSection: string): boolean {
  return normalizeBiff8FormatCode(formatSection).includes('%');
}

function getBiff8PercentageDecimalPlaces(cellFormat: Biff8CellFormat, selectedSection?: string): number {
  const builtInDecimals = BIFF8_BUILT_IN_PERCENT_FORMAT_DECIMALS.get(cellFormat.ifmt);
  if (builtInDecimals !== undefined) return builtInDecimals;
  const formatSection = selectedSection ?? normalizeBiff8FormatCode(cellFormat.formatCode).split(';')[0] ?? '';
  const percentIndex = formatSection.indexOf('%');
  const decimalIndex = formatSection.lastIndexOf('.', percentIndex);
  if (decimalIndex === -1) return 0;
  return formatSection
    .slice(decimalIndex + 1, percentIndex)
    .split('')
    .filter((character) => character === '0' || character === '#' || character === '?').length;
}

function isBiff8ParenthesizedPercentageSection(formatSection: string): boolean {
  const trimmed = formatSection.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')') && trimmed.includes('%') && /[0#?]/.test(trimmed);
}

function isBiff8ScientificFormat(cellFormat: Biff8CellFormat): boolean {
  return (
    BIFF8_BUILT_IN_SCIENTIFIC_FORMAT_DECIMALS.has(cellFormat.ifmt) ||
    splitBiff8FormatSections(cellFormat.formatCode).some(isBiff8ScientificFormatSection)
  );
}

function formatBiff8ScientificCell(value: number, cellFormat: Biff8CellFormat): string {
  const builtInDecimals = BIFF8_BUILT_IN_SCIENTIFIC_FORMAT_DECIMALS.get(cellFormat.ifmt);
  const rawSection = getBiff8RawNumberFormatSection(value, cellFormat.formatCode);
  const literalText = getBiff8LiteralNumberFormatSectionText(rawSection);
  if (literalText !== null) return literalText;
  if (builtInDecimals === undefined && !isBiff8ScientificFormatSection(rawSection)) {
    return formatBiff8DecimalNumberCell(value, cellFormat);
  }
  const section = normalizeBiff8FormatCode(rawSection);
  const decimals = getBiff8ScientificDecimalPlaces(cellFormat, section);
  const exponentDigits = getBiff8ScientificExponentDigits(cellFormat, section);
  const match = Math.abs(value)
    .toExponential(decimals)
    .match(/^(\d(?:\.\d+)?)e([+-]?)(\d+)$/i);
  if (!match) return Number.isInteger(value) ? String(value) : String(value);
  const [, mantissa, exponentSign, exponentText] = match;
  const sign = exponentSign === '-' ? '-' : '+';
  const scientificText = `${mantissa}E${sign}${exponentText.padStart(exponentDigits, '0')}`;
  const affixes = getBiff8NumberFormatAffixes(rawSection);
  if (value < 0 && isBiff8ParenthesizedNumberSection(rawSection)) {
    return `${affixes.prefix || '('}${scientificText}${affixes.suffix || ')'}`;
  }
  const valueSign = value < 0 && !hasBiff8ExplicitNegativePrefix(affixes.prefix) ? '-' : '';
  return `${valueSign}${affixes.prefix}${scientificText}${affixes.suffix}`;
}

function isBiff8ScientificFormatSection(formatSection: string): boolean {
  return /[0#?](?:\.[0#?]+)?e[+-]?[0#?]+/i.test(normalizeBiff8FormatCode(formatSection));
}

function getBiff8ScientificDecimalPlaces(cellFormat: Biff8CellFormat, selectedSection?: string): number {
  const builtInDecimals = BIFF8_BUILT_IN_SCIENTIFIC_FORMAT_DECIMALS.get(cellFormat.ifmt);
  if (builtInDecimals !== undefined) return builtInDecimals;
  const section = selectedSection ?? getBiff8PositiveFormatSection(cellFormat.formatCode);
  const exponentIndex = section.toLowerCase().indexOf('e');
  if (exponentIndex === -1) return 0;
  return getBiff8NumericDecimalPlaces(section.slice(0, exponentIndex));
}

function getBiff8ScientificExponentDigits(cellFormat: Biff8CellFormat, selectedSection?: string): number {
  const section = selectedSection ?? getBiff8PositiveFormatSection(cellFormat.formatCode);
  const exponentDigits = section.match(/e[+-]?([0#?]+)/i)?.[1]?.length;
  return exponentDigits && exponentDigits > 0 ? exponentDigits : 2;
}

function isBiff8FractionFormat(cellFormat: Biff8CellFormat): boolean {
  return (
    BIFF8_BUILT_IN_FRACTION_FORMAT_MAX_DENOMINATOR.has(cellFormat.ifmt) ||
    splitBiff8FormatSections(cellFormat.formatCode).some(
      (section) => getBiff8CustomFractionDenominatorPlacesFromSection(section) > 0,
    )
  );
}

function formatBiff8FractionCell(value: number, cellFormat: Biff8CellFormat): string {
  const builtInMaxDenominator = BIFF8_BUILT_IN_FRACTION_FORMAT_MAX_DENOMINATOR.get(cellFormat.ifmt);
  const section = getBiff8NumberFormatSection(value, cellFormat.formatCode);
  const literalText = getBiff8LiteralNumberFormatSectionText(section);
  if (literalText !== null) return literalText;
  const customDenominatorPlaces = getBiff8CustomFractionDenominatorPlacesFromSection(section);
  if (builtInMaxDenominator === undefined && customDenominatorPlaces <= 0) {
    return formatBiff8DecimalNumberCell(value, cellFormat);
  }
  const maxDenominator = builtInMaxDenominator ?? 10 ** customDenominatorPlaces - 1;
  const absoluteText = formatBiff8FractionAbsoluteText(Math.abs(value), maxDenominator);
  const affixes = getBiff8NumberFormatAffixes(section);
  if (value < 0 && isBiff8ParenthesizedNumberSection(section)) {
    return `${affixes.prefix || '('}${absoluteText}${affixes.suffix || ')'}`;
  }
  const sign = value < 0 && !hasBiff8ExplicitNegativePrefix(affixes.prefix) ? '-' : '';
  return `${sign}${affixes.prefix}${absoluteText}${affixes.suffix}`;
}

function formatBiff8FractionAbsoluteText(value: number, maxDenominator: number): string {
  const absoluteValue = Math.abs(value);
  const whole = Math.trunc(absoluteValue);
  const fraction = approximateBiff8Fraction(absoluteValue - whole, maxDenominator);
  if (!fraction) return `${whole}`;
  if (fraction.numerator >= fraction.denominator) {
    const carriedWhole = whole + Math.floor(fraction.numerator / fraction.denominator);
    const carriedNumerator = fraction.numerator % fraction.denominator;
    if (carriedNumerator === 0) return `${carriedWhole}`;
    return `${carriedWhole} ${carriedNumerator}/${fraction.denominator}`;
  }
  if (whole === 0) return `${fraction.numerator}/${fraction.denominator}`;
  return `${whole} ${fraction.numerator}/${fraction.denominator}`;
}

function getBiff8CustomFractionDenominatorPlacesFromSection(formatSection: string): number {
  const section = stripBiff8FormatDirectives(formatSection);
  return section.match(/\/([?#0]+)/)?.[1]?.length ?? 0;
}

function approximateBiff8Fraction(
  value: number,
  maxDenominator: number,
): { numerator: number; denominator: number } | null {
  let bestNumerator = 0;
  let bestDenominator = 1;
  let bestError = Number.POSITIVE_INFINITY;
  for (let denominator = 1; denominator <= maxDenominator; denominator += 1) {
    const numerator = Math.round(value * denominator);
    const error = Math.abs(value - numerator / denominator);
    if (error < bestError) {
      bestNumerator = numerator;
      bestDenominator = denominator;
      bestError = error;
    }
  }
  if (bestNumerator === 0) return null;
  const divisor = greatestCommonDivisor(bestNumerator, bestDenominator);
  return { numerator: bestNumerator / divisor, denominator: bestDenominator / divisor };
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function isBiff8CurrencyFormat(cellFormat: Biff8CellFormat): boolean {
  return (
    BIFF8_BUILT_IN_CURRENCY_FORMAT_DECIMALS.has(cellFormat.ifmt) ||
    splitBiff8FormatSections(cellFormat.formatCode).some(isBiff8CurrencyFormatSection)
  );
}

function formatBiff8CurrencyCell(value: number, cellFormat: Biff8CellFormat): string {
  const rawSection = getBiff8RawNumberFormatSection(value, cellFormat.formatCode);
  const section = normalizeBiff8CurrencyFormatSection(rawSection);
  const literalText = getBiff8LiteralNumberFormatSectionText(section);
  if (literalText !== null) return literalText;
  const builtInDecimals = BIFF8_BUILT_IN_CURRENCY_FORMAT_DECIMALS.get(cellFormat.ifmt);
  if (builtInDecimals === undefined && !isBiff8CurrencyFormatSection(rawSection)) {
    return formatBiff8DecimalNumberCell(value, cellFormat);
  }
  const scaleFactor = builtInDecimals === undefined ? getBiff8NumberScaleFactor(section) : 1;
  const displaySection = builtInDecimals === undefined ? removeBiff8NumberScaleCommas(section) : section;
  const decimals = builtInDecimals ?? getBiff8NumericDecimalPlaces(displaySection);
  if (Object.is(value, 0) && BIFF8_BUILT_IN_CURRENCY_ACCOUNTING_ZERO_FORMAT_IDS.has(cellFormat.ifmt)) {
    return '$-';
  }
  const absoluteText = Math.abs(value / scaleFactor).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: builtInDecimals !== undefined || hasBiff8GroupingComma(displaySection),
  });
  if (value < 0 && BIFF8_BUILT_IN_CURRENCY_PARENTHESES_NEGATIVE_FORMAT_IDS.has(cellFormat.ifmt)) {
    return `($${absoluteText})`;
  }
  const affixes =
    builtInDecimals === undefined ? getBiff8NumberFormatAffixes(displaySection) : { prefix: '$', suffix: '' };
  if (value < 0 && isBiff8ParenthesizedCurrencySection(displaySection)) {
    return `${affixes.prefix || '($'}${absoluteText}${affixes.suffix || ')'}`;
  }
  const sign = value < 0 && !hasBiff8ExplicitNegativePrefix(affixes.prefix) ? '-' : '';
  return `${sign}${getBiff8CurrencyPrefixText(affixes)}${absoluteText}${affixes.suffix}`;
}

function getBiff8CurrencyPrefixText(affixes: { prefix: string; suffix: string }): string {
  return affixes.prefix || (affixes.suffix ? '' : '$');
}

function isBiff8CurrencyFormatSection(formatSection: string): boolean {
  const section = normalizeBiff8CurrencyFormatSection(formatSection);
  return (section.includes('$') || getBiff8LocaleCurrencySymbol(formatSection) !== null) && /[0#?]/.test(section);
}

function getBiff8RawNumberFormatSection(value: number, formatCode?: string): string {
  const sections = splitBiff8FormatSections(formatCode);
  const conditionalSection = getBiff8ConditionalNumberFormatSection(value, sections);
  if (conditionalSection !== null) return conditionalSection;
  if (Object.is(value, 0) && sections[2]) return sections[2];
  if (value < 0 && sections[1]) return sections[1];
  return sections[0] ?? '';
}

function normalizeBiff8CurrencyFormatSection(formatSection: string): string {
  return stripBiff8FormatDirectives(replaceBiff8LocaleCurrencyDirectives(formatSection));
}

function replaceBiff8LocaleCurrencyDirectives(formatSection: string): string {
  return formatSection.replace(/\[\$([^\]-]+)(?:-[^\]]+)?\]/g, '$1');
}

function getBiff8LocaleCurrencySymbol(formatSection: string): string | null {
  return formatSection.match(/\[\$([^\]-]+)(?:-[^\]]+)?\]/)?.[1] ?? null;
}

function stripBiff8FormatDirectives(formatSection: string): string {
  let stripped = '';
  let inQuotedLiteral = false;

  for (let index = 0; index < formatSection.length; index += 1) {
    const character = formatSection[index];
    if (character === '\\') {
      stripped += character;
      if (index + 1 < formatSection.length) {
        index += 1;
        stripped += formatSection[index];
      }
      continue;
    }
    if (character === '"') {
      inQuotedLiteral = !inQuotedLiteral;
      stripped += character;
      continue;
    }
    if (!inQuotedLiteral && character === '[') {
      const directiveEnd = formatSection.indexOf(']', index + 1);
      if (directiveEnd !== -1) {
        index = directiveEnd;
        continue;
      }
    }
    stripped += character;
  }

  return stripped;
}

function isBiff8ParenthesizedCurrencySection(formatSection: string): boolean {
  const trimmed = formatSection.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')') && /[$£€¥¢]/.test(trimmed) && /[0#?]/.test(trimmed);
}

function getBiff8NumberFormatSection(value: number, formatCode?: string): string {
  const sections = splitBiff8FormatSections(formatCode);
  const conditionalSection = getBiff8ConditionalNumberFormatSection(value, sections);
  if (conditionalSection !== null) return stripBiff8FormatDirectives(conditionalSection);
  if (Object.is(value, 0) && sections[2]) return stripBiff8FormatDirectives(sections[2]);
  if (value < 0 && sections[1]) return stripBiff8FormatDirectives(sections[1]);
  return stripBiff8FormatDirectives(sections[0] ?? '');
}

function getBiff8RawFormatSectionForValue(value: number, formatCode?: string): string {
  const sections = splitBiff8FormatSections(formatCode);
  const conditionalSection = getBiff8ConditionalNumberFormatSection(value, sections);
  if (conditionalSection !== null) return conditionalSection;
  if (Object.is(value, 0) && sections[2]) return sections[2];
  if (value < 0 && sections[1]) return sections[1];
  return sections[0] ?? '';
}

function getBiff8ConditionalNumberFormatSection(value: number, sections: string[]): string | null {
  let fallbackSection: string | null = null;
  let hasCondition = false;

  for (const section of sections) {
    const condition = getBiff8NumberFormatCondition(section);
    if (condition === null) {
      if (fallbackSection === null) fallbackSection = section;
      continue;
    }
    hasCondition = true;
    if (matchesBiff8NumberFormatCondition(value, condition)) return section;
  }

  return hasCondition ? fallbackSection : null;
}

function getBiff8NumberFormatCondition(formatSection: string): { operator: string; threshold: number } | null {
  let inQuotedLiteral = false;

  for (let index = 0; index < formatSection.length; index += 1) {
    const character = formatSection[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (character === '"') {
      inQuotedLiteral = !inQuotedLiteral;
      continue;
    }
    if (!inQuotedLiteral && character === '[') {
      const directiveEnd = formatSection.indexOf(']', index + 1);
      if (directiveEnd === -1) continue;
      const directive = formatSection.slice(index + 1, directiveEnd).trim();
      const match = directive.match(/^(<=|>=|<>|=|<|>)\s*([+-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)$/i);
      if (match) {
        return { operator: match[1], threshold: Number(match[2].replace(/,/g, '')) };
      }
      index = directiveEnd;
    }
  }

  return null;
}

function matchesBiff8NumberFormatCondition(value: number, condition: { operator: string; threshold: number }): boolean {
  switch (condition.operator) {
    case '<':
      return value < condition.threshold;
    case '<=':
      return value <= condition.threshold;
    case '>':
      return value > condition.threshold;
    case '>=':
      return value >= condition.threshold;
    case '=':
      return value === condition.threshold;
    case '<>':
      return value !== condition.threshold;
    default:
      return false;
  }
}

function splitBiff8FormatSections(formatCode?: string): string[] {
  const sections: string[] = [];
  let current = '';
  let inQuotedLiteral = false;
  const code = formatCode ?? '';
  for (let index = 0; index < code.length; index += 1) {
    const character = code[index];
    if (character === '\\') {
      current += character;
      if (index + 1 < code.length) {
        index += 1;
        current += code[index];
      }
      continue;
    }
    if (character === '"') {
      inQuotedLiteral = !inQuotedLiteral;
      current += character;
      continue;
    }
    if (character === ';' && !inQuotedLiteral) {
      sections.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  sections.push(current);
  return sections;
}

function isBiff8ParenthesizedNumberSection(formatSection: string): boolean {
  const trimmed = formatSection.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')') && /[0#?]/.test(trimmed);
}

function getBiff8LiteralNumberFormatSectionText(formatSection: string): string | null {
  const trimmed = formatSection.trim();
  const placeholderProbe = trimmed.replace(/"[^"]*"/g, '').replace(/\\./g, '');
  if (/[0#?]/.test(placeholderProbe)) return null;
  const text = decodeBiff8FormatLiteral(trimmed);
  if (!text) return null;
  return text;
}

function getBiff8NumberFormatAffixes(formatSection: string): { prefix: string; suffix: string } {
  const firstPlaceholder = getFirstBiff8NumberPlaceholderIndex(formatSection);
  const lastPlaceholder = getLastBiff8NumberPlaceholderIndex(formatSection);

  if (firstPlaceholder === -1 || lastPlaceholder === -1) return { prefix: '', suffix: '' };
  return {
    prefix: decodeBiff8FormatLiteral(formatSection.slice(0, firstPlaceholder)),
    suffix: decodeBiff8FormatLiteral(formatSection.slice(lastPlaceholder + 1)),
  };
}

function getFirstBiff8NumberPlaceholderIndex(formatSection: string): number {
  let inQuotedLiteral = false;

  for (let index = 0; index < formatSection.length; index += 1) {
    const character = formatSection[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (character === '"') {
      inQuotedLiteral = !inQuotedLiteral;
      continue;
    }
    if (!inQuotedLiteral && (character === '0' || character === '#' || character === '?')) {
      return index;
    }
  }

  return -1;
}

function getLastBiff8NumberPlaceholderIndex(formatSection: string): number {
  let lastPlaceholder = -1;
  let inQuotedLiteral = false;

  for (let index = 0; index < formatSection.length; index += 1) {
    const character = formatSection[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (character === '"') {
      inQuotedLiteral = !inQuotedLiteral;
      continue;
    }
    if (!inQuotedLiteral && (character === '0' || character === '#' || character === '?')) {
      lastPlaceholder = index;
    }
  }

  return lastPlaceholder;
}

function decodeBiff8FormatLiteral(text: string): string {
  let literal = '';
  let inQuotedLiteral = false;
  const stripped = stripBiff8FormatDirectives(text);

  for (let index = 0; index < stripped.length; index += 1) {
    const character = stripped[index];
    if (character === '"') {
      inQuotedLiteral = !inQuotedLiteral;
      continue;
    }
    if (character === '\\' && index + 1 < stripped.length) {
      index += 1;
      literal += stripped[index];
      continue;
    }
    if (!inQuotedLiteral && (character === '_' || character === '*') && index + 1 < stripped.length) {
      index += 1;
      continue;
    }
    literal += character;
  }

  return literal;
}

function hasBiff8ExplicitNegativePrefix(prefix: string): boolean {
  return prefix.trimStart().startsWith('-');
}

function getBiff8PositiveFormatSection(formatCode?: string): string {
  return normalizeBiff8FormatCode(splitBiff8FormatSections(formatCode)[0]);
}

function getBiff8NumericDecimalPlaces(formatCode: string): number {
  const decimalIndex = formatCode.indexOf('.');
  if (decimalIndex === -1) return 0;
  const numericTail = formatCode.slice(decimalIndex + 1).match(/^[0#?]+/)?.[0] ?? '';
  return numericTail.length;
}

function getBiff8NumberScaleFactor(formatSection: string): number {
  const lastPlaceholder = getLastBiff8NumberPlaceholderIndex(formatSection);
  if (lastPlaceholder === -1) return 1;
  let scaleFactor = 1;
  for (let index = lastPlaceholder + 1; index < formatSection.length; index += 1) {
    if (formatSection[index] !== ',') break;
    scaleFactor *= 1000;
  }
  return scaleFactor;
}

function removeBiff8NumberScaleCommas(formatSection: string): string {
  const lastPlaceholder = getLastBiff8NumberPlaceholderIndex(formatSection);
  if (lastPlaceholder === -1 || formatSection[lastPlaceholder + 1] !== ',') return formatSection;
  let suffixStart = lastPlaceholder + 1;
  while (formatSection[suffixStart] === ',') suffixStart += 1;
  return `${formatSection.slice(0, lastPlaceholder + 1)}${formatSection.slice(suffixStart)}`;
}

function hasBiff8GroupingComma(formatSection: string): boolean {
  const lastPlaceholder = getLastBiff8NumberPlaceholderIndex(formatSection);
  if (lastPlaceholder <= 0) return false;
  return formatSection
    .slice(0, lastPlaceholder)
    .replace(/"[^"]*"/g, '')
    .includes(',');
}

function isBiff8DecimalNumberFormat(cellFormat: Biff8CellFormat): boolean {
  if (BIFF8_BUILT_IN_NUMBER_FORMATS.has(cellFormat.ifmt)) return true;
  return splitBiff8FormatSections(cellFormat.formatCode).some((formatSection) => {
    const section = stripBiff8FormatDirectives(formatSection);
    return section !== '' && /[0#?]/.test(section);
  });
}

function formatBiff8DecimalNumberCell(value: number, cellFormat: Biff8CellFormat): string {
  const builtInFormat = BIFF8_BUILT_IN_NUMBER_FORMATS.get(cellFormat.ifmt);
  if (builtInFormat) {
    if (Object.is(value, 0) && builtInFormat.zeroText) return builtInFormat.zeroText;
    const absoluteText = Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: builtInFormat.decimals,
      maximumFractionDigits: builtInFormat.decimals,
      useGrouping: builtInFormat.grouping,
    });
    if (value < 0 && builtInFormat.negativeParentheses) return `(${absoluteText})`;
    const sign = value < 0 ? '-' : '';
    return `${sign}${absoluteText}`;
  }
  const section = getBiff8NumberFormatSection(value, cellFormat.formatCode);
  const literalText = getBiff8LiteralNumberFormatSectionText(section);
  if (literalText !== null) return literalText;
  const scaleFactor = getBiff8NumberScaleFactor(section);
  const displaySection = removeBiff8NumberScaleCommas(section);
  const decimals = getBiff8NumericDecimalPlaces(displaySection);
  const absoluteText = Math.abs(value / scaleFactor).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: hasBiff8GroupingComma(displaySection),
  });
  const affixes = getBiff8NumberFormatAffixes(displaySection);
  if (value < 0 && isBiff8ParenthesizedNumberSection(displaySection)) {
    return `${affixes.prefix || '('}${absoluteText}${affixes.suffix || ')'}`;
  }
  const sign = value < 0 && !hasBiff8ExplicitNegativePrefix(affixes.prefix) ? '-' : '';
  return `${sign}${affixes.prefix}${absoluteText}${affixes.suffix}`;
}

function getBiff8DateTimePrecision(cellFormat: Biff8CellFormat): Biff8DateTimePrecision {
  if (isBiff8BuiltInElapsedHourFormat(cellFormat.ifmt)) return 'elapsed-second';
  if (isBiff8BuiltInFractionalSecondTimeFormat(cellFormat.ifmt)) return 'time-fractional-second';
  if (isBiff8BuiltInMinuteSecondTimeFormat(cellFormat.ifmt)) return 'time-minute-second';
  if (cellFormat.ifmt === 19) return 'time-ampm-second';
  if (cellFormat.ifmt === 21) return 'time-second';
  if (cellFormat.ifmt === 18) return 'time-ampm-minute';
  if (cellFormat.ifmt === 20) return 'time-minute';
  if (cellFormat.ifmt === 22) return 'minute';
  const normalized = normalizeBiff8FormatCode(cellFormat.formatCode);
  const isCustomDateFormat = isBiff8CustomDateFormat(cellFormat.formatCode);
  if (isBiff8ElapsedSecondFormat(cellFormat.formatCode)) {
    if (isBiff8ThreeDigitFractionalElapsedSecondFormat(cellFormat.formatCode)) {
      return 'elapsed-total-second-fractional-3';
    }
    if (isBiff8TwoDigitFractionalElapsedSecondFormat(cellFormat.formatCode)) {
      return 'elapsed-total-second-fractional-2';
    }
    if (isBiff8FractionalElapsedSecondFormat(cellFormat.formatCode)) {
      return 'elapsed-total-second-fractional';
    }
    return 'elapsed-total-second';
  }
  if (isBiff8ElapsedMinuteFormat(cellFormat.formatCode)) {
    if (isBiff8ThreeDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
      return 'elapsed-total-minute-fractional-3';
    }
    if (isBiff8TwoDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
      return 'elapsed-total-minute-fractional-2';
    }
    if (isBiff8FractionalSecondTimeFormat(cellFormat.formatCode)) {
      return 'elapsed-total-minute-fractional';
    }
    return 'elapsed-total-minute';
  }
  if (isBiff8ElapsedHourFormat(cellFormat.formatCode)) {
    if (isBiff8ThreeDigitFractionalSecondTimeFormat(cellFormat.formatCode)) return 'elapsed-second-fractional-3';
    if (isBiff8TwoDigitFractionalSecondTimeFormat(cellFormat.formatCode)) return 'elapsed-second-fractional-2';
    if (isBiff8FractionalSecondTimeFormat(cellFormat.formatCode)) return 'elapsed-second-fractional';
    return normalized.includes('s') ? 'elapsed-second' : 'elapsed-minute';
  }
  if (!isCustomDateFormat && isBiff8AmPmTimeFormat(cellFormat.formatCode) && normalized.includes('h')) {
    const isShortAmPm = isBiff8ShortAmPmTimeFormat(cellFormat.formatCode);
    if (isShortAmPm) {
      if (isBiff8ThreeDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
        return 'time-ap-second-fractional-3';
      }
      if (isBiff8TwoDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
        return 'time-ap-second-fractional-2';
      }
      if (isBiff8FractionalSecondTimeFormat(cellFormat.formatCode)) {
        return 'time-ap-second-fractional';
      }
      return normalized.includes('s') ? 'time-ap-second' : 'time-ap-minute';
    }
    if (isBiff8ThreeDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
      return 'time-ampm-second-fractional-3';
    }
    if (isBiff8TwoDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
      return 'time-ampm-second-fractional-2';
    }
    if (isBiff8FractionalSecondTimeFormat(cellFormat.formatCode)) {
      return 'time-ampm-second-fractional';
    }
    return normalized.includes('s') ? 'time-ampm-second' : 'time-ampm-minute';
  }
  if (!isCustomDateFormat && isBiff8FractionalSecondTimeFormat(cellFormat.formatCode)) {
    if (isBiff8ThreeDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
      return normalized.includes('h') ? 'time-hour-fractional-second-3' : 'time-fractional-second-3';
    }
    if (isBiff8TwoDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
      return normalized.includes('h') ? 'time-hour-fractional-second-2' : 'time-fractional-second-2';
    }
    if (normalized.includes('h')) return 'time-hour-fractional-second';
    return 'time-fractional-second';
  }
  if (isCustomDateFormat) {
    if (isBiff8AmPmTimeFormat(cellFormat.formatCode) && normalized.includes('h')) {
      if (isBiff8ShortAmPmTimeFormat(cellFormat.formatCode)) {
        if (isBiff8ThreeDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
          return 'date-ap-second-fractional-3';
        }
        if (isBiff8TwoDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
          return 'date-ap-second-fractional-2';
        }
        if (isBiff8FractionalSecondTimeFormat(cellFormat.formatCode)) {
          return 'date-ap-second-fractional';
        }
        return normalized.includes('s') ? 'date-ap-second' : 'date-ap-minute';
      }
      if (isBiff8ThreeDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
        return 'date-ampm-second-fractional-3';
      }
      if (isBiff8TwoDigitFractionalSecondTimeFormat(cellFormat.formatCode)) {
        return 'date-ampm-second-fractional-2';
      }
      if (isBiff8FractionalSecondTimeFormat(cellFormat.formatCode)) {
        return 'date-ampm-second-fractional';
      }
      return normalized.includes('s') ? 'date-ampm-second' : 'date-ampm-minute';
    }
    if (isBiff8FractionalSecondTimeFormat(cellFormat.formatCode)) {
      if (isBiff8ThreeDigitFractionalSecondTimeFormat(cellFormat.formatCode)) return 'second-fractional-3';
      if (isBiff8TwoDigitFractionalSecondTimeFormat(cellFormat.formatCode)) return 'second-fractional-2';
      return 'second-fractional';
    }
    if (normalized.includes('s')) return 'second';
    if (normalized.includes('h')) return 'minute';
  }
  if (normalized.includes('s')) return 'time-second';
  if (normalized.includes('h')) return 'time-minute';
  return 'date';
}

function isBiff8CustomDateFormat(formatCode?: string): boolean {
  const normalized = normalizeBiff8FormatCode(formatCode);
  return (
    (normalized.includes('y') && (normalized.includes('m') || normalized.includes('d'))) ||
    isBiff8YearOnlyDateFormat(formatCode) ||
    isBiff8MonthDayDateFormat(formatCode)
  );
}

function isBiff8YearOnlyDateFormat(formatCode?: string): boolean {
  const section = decodeBiff8FormatLiteral(splitBiff8FormatSections(formatCode)[0] ?? '').trim();
  return /^y{2,4}$/i.test(section);
}

function isBiff8MonthDayDateFormat(formatCode?: string): boolean {
  const section = decodeBiff8FormatLiteral(splitBiff8FormatSections(formatCode)[0] ?? '').trim();
  return /^(?:m{1,4}[-/\s.]+d{1,4}|d{1,4}[-/\s.]+m{1,4}|m{1,4}\u6708d{1,4}\u65e5|d{1,4}\u65e5m{1,4}\u6708)$/i.test(
    section,
  );
}

function isBiff8CustomTimeFormat(formatCode?: string): boolean {
  const normalized = normalizeBiff8FormatCode(formatCode);
  return (
    !isBiff8CustomDateFormat(formatCode) &&
    (isBiff8ElapsedTimeFormat(formatCode) || normalized.includes('h') || normalized.includes('s'))
  );
}

function isBiff8AmPmTimeFormat(formatCode?: string): boolean {
  return /\b(?:am\/pm|a\/p)\b/i.test(stripBiff8FormatDirectives(formatCode ?? ''));
}

function isBiff8ShortAmPmTimeFormat(formatCode?: string): boolean {
  return /\ba\/p\b/i.test(stripBiff8FormatDirectives(formatCode ?? ''));
}

function isBiff8FractionalSecondTimeFormat(formatCode?: string): boolean {
  return /s+\.\d/i.test(stripBiff8FormatDirectives(formatCode ?? ''));
}

function isBiff8TwoDigitFractionalSecondTimeFormat(formatCode?: string): boolean {
  return /s+\.00/i.test(stripBiff8FormatDirectives(formatCode ?? ''));
}

function isBiff8ThreeDigitFractionalSecondTimeFormat(formatCode?: string): boolean {
  return /s+\.000/i.test(stripBiff8FormatDirectives(formatCode ?? ''));
}

function isBiff8ThreeDigitFractionalElapsedSecondFormat(formatCode?: string): boolean {
  return isBiff8ThreeDigitFractionalSecondTimeFormat(formatCode) || /\[[sS]\]\.000/.test(formatCode ?? '');
}

function isBiff8TwoDigitFractionalElapsedSecondFormat(formatCode?: string): boolean {
  return isBiff8TwoDigitFractionalSecondTimeFormat(formatCode) || /\[[sS]\]\.00(?!0)/.test(formatCode ?? '');
}

function isBiff8FractionalElapsedSecondFormat(formatCode?: string): boolean {
  return isBiff8FractionalSecondTimeFormat(formatCode) || /\[[sS]\]\.0(?!0)/.test(formatCode ?? '');
}

function isBiff8ElapsedTimeFormat(formatCode?: string): boolean {
  return (
    isBiff8ElapsedHourFormat(formatCode) ||
    isBiff8ElapsedMinuteFormat(formatCode) ||
    isBiff8ElapsedSecondFormat(formatCode)
  );
}

function isBiff8ElapsedHourFormat(formatCode?: string): boolean {
  return /\[[hH]+\]/.test(formatCode ?? '');
}

function isBiff8ElapsedMinuteFormat(formatCode?: string): boolean {
  return /\[[mM]+\]/.test(formatCode ?? '');
}

function isBiff8ElapsedSecondFormat(formatCode?: string): boolean {
  return /\[[sS]+\]/.test(formatCode ?? '');
}

function normalizeBiff8FormatCode(formatCode?: string): string {
  if (!formatCode) return '';
  return formatCode
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '')
    .replace(/_.|\*./g, '')
    .toLowerCase();
}

function formatBiff8ExcelSerialDate(
  value: number,
  uses1904DateSystem: boolean,
  precision: Biff8DateTimePrecision,
): string | null {
  if (isBiff8ElapsedTimePrecision(precision)) {
    return formatBiff8ElapsedTime(value, precision);
  }
  if (uses1904DateSystem) {
    if (!isSupportedBiff8DateSerial(value, true)) return null;
    const serialValue = precision === 'date' ? Math.floor(value) : value;
    return formatBiff8UtcDate(EXCEL_1904_EPOCH_UTC_MS + Math.round(serialValue * MILLISECONDS_PER_DAY), precision);
  }
  if (!isSupportedBiff8DateSerial(value, isBiff8TimeOnlyPrecision(precision)) || Math.trunc(value) === 60) {
    return null;
  }
  const serialValue = precision === 'date' ? Math.floor(value) : value;
  const days = serialValue > 60 ? serialValue - 1 : serialValue;
  return formatBiff8UtcDate(EXCEL_1900_EPOCH_UTC_MS + Math.round(days * MILLISECONDS_PER_DAY), precision);
}

function isSupportedBiff8DateSerial(value: number, allowZero: boolean): boolean {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) return false;
  return true;
}

function isBiff8TimeOnlyPrecision(precision: Biff8DateTimePrecision): boolean {
  return (
    precision === 'time-minute' ||
    precision === 'time-ap-minute' ||
    precision === 'time-ap-second' ||
    precision === 'time-ap-second-fractional' ||
    precision === 'time-ap-second-fractional-2' ||
    precision === 'time-ap-second-fractional-3' ||
    precision === 'time-ampm-minute' ||
    precision === 'time-ampm-second' ||
    precision === 'time-ampm-second-fractional' ||
    precision === 'time-ampm-second-fractional-2' ||
    precision === 'time-ampm-second-fractional-3' ||
    precision === 'time-second' ||
    precision === 'time-minute-second' ||
    precision === 'time-fractional-second' ||
    precision === 'time-fractional-second-2' ||
    precision === 'time-fractional-second-3' ||
    precision === 'time-hour-fractional-second' ||
    precision === 'time-hour-fractional-second-2' ||
    precision === 'time-hour-fractional-second-3'
  );
}

function isBiff8ElapsedTimePrecision(precision: Biff8DateTimePrecision): boolean {
  return (
    precision === 'elapsed-minute' ||
    precision === 'elapsed-second' ||
    precision === 'elapsed-second-fractional' ||
    precision === 'elapsed-second-fractional-2' ||
    precision === 'elapsed-second-fractional-3' ||
    precision === 'elapsed-total-minute' ||
    precision === 'elapsed-total-minute-fractional' ||
    precision === 'elapsed-total-minute-fractional-2' ||
    precision === 'elapsed-total-minute-fractional-3' ||
    precision === 'elapsed-total-second' ||
    precision === 'elapsed-total-second-fractional' ||
    precision === 'elapsed-total-second-fractional-2' ||
    precision === 'elapsed-total-second-fractional-3'
  );
}

function formatBiff8ElapsedTime(value: number, precision: Biff8DateTimePrecision): string | null {
  if (!Number.isFinite(value) || value < 0) return null;
  if (precision === 'elapsed-second-fractional-2') {
    const totalMilliseconds = Math.round(value * MILLISECONDS_PER_DAY);
    const hours = Math.floor(totalMilliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((totalMilliseconds % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((totalMilliseconds % (60 * 1000)) / 1000);
    const milliseconds = Math.floor((totalMilliseconds % 1000) / 10);
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(
      milliseconds,
    ).padStart(2, '0')}`;
  }
  if (precision === 'elapsed-second-fractional') {
    const totalMilliseconds = Math.round(value * MILLISECONDS_PER_DAY);
    const hours = Math.floor(totalMilliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((totalMilliseconds % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((totalMilliseconds % (60 * 1000)) / 1000);
    const milliseconds = Math.floor((totalMilliseconds % 1000) / 100);
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${milliseconds}`;
  }
  if (precision === 'elapsed-second-fractional-3') {
    const totalMilliseconds = Math.round(value * MILLISECONDS_PER_DAY);
    const hours = Math.floor(totalMilliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((totalMilliseconds % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((totalMilliseconds % (60 * 1000)) / 1000);
    const milliseconds = totalMilliseconds % 1000;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(
      milliseconds,
    ).padStart(3, '0')}`;
  }
  if (precision === 'elapsed-total-minute-fractional-3') {
    const totalMilliseconds = Math.round(value * MILLISECONDS_PER_DAY);
    const totalMinutes = Math.floor(totalMilliseconds / (60 * 1000));
    const seconds = Math.floor((totalMilliseconds % (60 * 1000)) / 1000);
    const milliseconds = totalMilliseconds % 1000;
    return `${totalMinutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }
  if (precision === 'elapsed-total-minute-fractional-2') {
    const totalMilliseconds = Math.round(value * MILLISECONDS_PER_DAY);
    const totalMinutes = Math.floor(totalMilliseconds / (60 * 1000));
    const seconds = Math.floor((totalMilliseconds % (60 * 1000)) / 1000);
    const milliseconds = Math.floor((totalMilliseconds % 1000) / 10);
    return `${totalMinutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
  }
  if (precision === 'elapsed-total-minute-fractional') {
    const totalMilliseconds = Math.round(value * MILLISECONDS_PER_DAY);
    const totalMinutes = Math.floor(totalMilliseconds / (60 * 1000));
    const seconds = Math.floor((totalMilliseconds % (60 * 1000)) / 1000);
    const milliseconds = Math.floor((totalMilliseconds % 1000) / 100);
    return `${totalMinutes}:${String(seconds).padStart(2, '0')}.${milliseconds}`;
  }
  if (precision === 'elapsed-total-second-fractional-3') {
    const totalMilliseconds = Math.round(value * MILLISECONDS_PER_DAY);
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const milliseconds = totalMilliseconds % 1000;
    return `${totalSeconds}.${String(milliseconds).padStart(3, '0')}`;
  }
  if (precision === 'elapsed-total-second-fractional-2') {
    const totalMilliseconds = Math.round(value * MILLISECONDS_PER_DAY);
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const milliseconds = Math.floor((totalMilliseconds % 1000) / 10);
    return `${totalSeconds}.${String(milliseconds).padStart(2, '0')}`;
  }
  if (precision === 'elapsed-total-second-fractional') {
    const totalMilliseconds = Math.round(value * MILLISECONDS_PER_DAY);
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const milliseconds = Math.floor((totalMilliseconds % 1000) / 100);
    return `${totalSeconds}.${milliseconds}`;
  }
  const totalSeconds = Math.round(value * SECONDS_PER_DAY);
  if (precision === 'elapsed-total-second') {
    return String(totalSeconds);
  }
  if (precision === 'elapsed-total-minute') {
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hourText = String(hours);
  const minuteText = String(minutes).padStart(2, '0');
  if (precision === 'elapsed-minute') return `${hourText}:${minuteText}`;
  return `${hourText}:${minuteText}:${String(seconds).padStart(2, '0')}`;
}

function formatBiff8UtcDate(timestamp: number, precision: Biff8DateTimePrecision): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  if (precision === 'time-ap-second-fractional-3') return formatBiff8AmPmTime(date, true, true, 3);
  if (precision === 'time-ap-second-fractional-2') return formatBiff8AmPmTime(date, true, true, 2);
  if (precision === 'time-ap-second-fractional') return formatBiff8AmPmTime(date, true, true, 1);
  if (precision === 'time-ap-second') return formatBiff8AmPmTime(date, true, true);
  if (precision === 'time-ap-minute') return formatBiff8AmPmTime(date, false, true);
  if (precision === 'time-ampm-second') return formatBiff8AmPmTime(date, true);
  if (precision === 'time-ampm-minute') return formatBiff8AmPmTime(date, false);
  if (precision === 'time-ampm-second-fractional-3') return formatBiff8AmPmTime(date, true, false, 3);
  if (precision === 'time-ampm-second-fractional-2') return formatBiff8AmPmTime(date, true, false, 2);
  if (precision === 'time-ampm-second-fractional') return formatBiff8AmPmTime(date, true, false, 1);
  if (precision === 'time-hour-fractional-second-3') return `${iso.slice(11, 19)}.${iso.slice(20, 23)}`;
  if (precision === 'time-hour-fractional-second-2') return `${iso.slice(11, 19)}.${iso.slice(20, 22)}`;
  if (precision === 'time-hour-fractional-second') return `${iso.slice(11, 19)}.${iso.slice(20, 21)}`;
  if (precision === 'time-fractional-second-3') return `${iso.slice(14, 19)}.${iso.slice(20, 23)}`;
  if (precision === 'time-fractional-second-2') return `${iso.slice(14, 19)}.${iso.slice(20, 22)}`;
  if (precision === 'time-fractional-second') return `${iso.slice(14, 19)}.${iso.slice(20, 21)}`;
  if (precision === 'time-minute-second') return iso.slice(14, 19);
  if (precision === 'time-second') return iso.slice(11, 19);
  if (precision === 'time-minute') return iso.slice(11, 16);
  if (precision === 'second-fractional-3') return `${iso.slice(0, 19)}.${iso.slice(20, 23)}`;
  if (precision === 'second-fractional-2') return `${iso.slice(0, 19)}.${iso.slice(20, 22)}`;
  if (precision === 'second-fractional') return `${iso.slice(0, 19)}.${iso.slice(20, 21)}`;
  if (precision === 'date-ap-second-fractional-3') {
    return `${iso.slice(0, 10)} ${formatBiff8AmPmTime(date, true, true, 3)}`;
  }
  if (precision === 'date-ap-second-fractional-2') {
    return `${iso.slice(0, 10)} ${formatBiff8AmPmTime(date, true, true, 2)}`;
  }
  if (precision === 'date-ap-second-fractional') {
    return `${iso.slice(0, 10)} ${formatBiff8AmPmTime(date, true, true, 1)}`;
  }
  if (precision === 'date-ap-second') return `${iso.slice(0, 10)} ${formatBiff8AmPmTime(date, true, true)}`;
  if (precision === 'date-ap-minute') return `${iso.slice(0, 10)} ${formatBiff8AmPmTime(date, false, true)}`;
  if (precision === 'date-ampm-second-fractional-3') {
    return `${iso.slice(0, 10)} ${formatBiff8AmPmTime(date, true, false, 3)}`;
  }
  if (precision === 'date-ampm-second-fractional-2') {
    return `${iso.slice(0, 10)} ${formatBiff8AmPmTime(date, true, false, 2)}`;
  }
  if (precision === 'date-ampm-second-fractional') {
    return `${iso.slice(0, 10)} ${formatBiff8AmPmTime(date, true, false, 1)}`;
  }
  if (precision === 'date-ampm-second') return `${iso.slice(0, 10)} ${formatBiff8AmPmTime(date, true)}`;
  if (precision === 'date-ampm-minute') return `${iso.slice(0, 10)} ${formatBiff8AmPmTime(date, false)}`;
  if (precision === 'second') return iso.slice(0, 19);
  if (precision === 'minute') return iso.slice(0, 16);
  return iso.slice(0, 10);
}

function formatBiff8AmPmTime(
  date: Date,
  includeSeconds: boolean,
  shortSuffix = false,
  fractionalSecondDigits = 0,
): string {
  const hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const displayHours = hours % 12 || 12;
  const suffix = hours < 12 ? (shortSuffix ? 'A' : 'AM') : shortSuffix ? 'P' : 'PM';
  if (!includeSeconds) return `${displayHours}:${minutes} ${suffix}`;
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  if (fractionalSecondDigits <= 0) return `${displayHours}:${minutes}:${seconds} ${suffix}`;
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0').slice(0, fractionalSecondDigits);
  return `${displayHours}:${minutes}:${seconds}.${milliseconds} ${suffix}`;
}

function decodeUtf16Le(bytes: Uint8Array): string {
  let value = '';
  for (let index = 0; index + 1 < bytes.byteLength; index += 2) {
    value += String.fromCharCode(readUInt16Le(bytes, index));
  }
  return value;
}
