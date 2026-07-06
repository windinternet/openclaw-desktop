import { describe, expect, it, vi } from 'vitest';
import {
  extractLegacyBinaryOfficeTextFromBuffer,
  extractLegacyWordTextFromBuffer,
} from '../../electron/legacy-office-text-extract';

describe('legacy office text extract', () => {
  it('extracts legacy Word text with a textutil runner', async () => {
    const runTextutil = vi.fn(async (_filePath: string) => ' Legacy Word body \n\n');

    const extracted = await extractLegacyWordTextFromBuffer(new Uint8Array([1, 2, 3]), {
      platform: 'darwin',
      runTextutil,
    });

    expect(runTextutil).toHaveBeenCalledOnce();
    expect(extracted).toEqual({
      text: 'Legacy Word body',
      bytesRead: 3,
      truncated: false,
    });
  });

  it('returns empty text when textutil is unavailable or not on macOS', async () => {
    const runTextutil = vi.fn(async () => {
      throw new Error('missing textutil');
    });

    await expect(
      extractLegacyWordTextFromBuffer(new Uint8Array([1, 2, 3]), {
        platform: 'darwin',
        runTextutil,
      }),
    ).resolves.toEqual({
      text: '',
      bytesRead: 3,
      truncated: false,
    });

    await expect(
      extractLegacyWordTextFromBuffer(new Uint8Array([1, 2, 3]), {
        platform: 'linux',
        runTextutil,
      }),
    ).resolves.toEqual({
      text: '',
      bytesRead: 3,
      truncated: false,
    });
  });

  it('extracts printable text from legacy Excel UTF-16LE binary content', () => {
    const text = 'Budget Total 42';
    const bytes = new Uint8Array(text.length * 2);
    for (let index = 0; index < text.length; index += 1) {
      bytes[index * 2] = text.charCodeAt(index);
    }

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'Budget Total 42',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves tabular rows from legacy Excel printable text', () => {
    const text = ['Name\tAmount', 'Alpha\t42', 'Beta\t108'].join('\n');
    const bytes = new Uint8Array(text.length * 2);
    for (let index = 0; index < text.length; index += 1) {
      bytes[index * 2] = text.charCodeAt(index);
    }

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text,
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves empty cells from legacy Excel printable tabular text', () => {
    const text = ['Name\t\tAmount', 'Alpha\t\t42'].join('\n');
    const bytes = new Uint8Array(text.length * 2);
    for (let index = 0; index < text.length; index += 1) {
      bytes[index * 2] = text.charCodeAt(index);
    }

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text,
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 shared string table cells as tabular rows', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount'],
      ['Alpha', '42'],
      ['Beta', '108'],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t42', 'Beta\t108'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers BIFF8 shared string text around NUL padding bytes', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Status'],
      ['Alpha', 'O\0K'],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tOK'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 BLANK trailing cell positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { blank: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MULBLANK trailing cell positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes', 'Owner'],
      ['Alpha', 42, { mulblank: 2 }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes\tOwner', 'Alpha\t42\t\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 LABELSST empty shared string cell positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, ''],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 LABELSST missing shared string positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { missingSharedString: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 LABELSST truncated shared string index positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { malformedSharedString: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 LABEL empty inline string cell positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { label: '' }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 LABEL missing inline string positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { missingLabel: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 LABEL truncated inline string header positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { malformedLabelHeader: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 FORMULA empty string cached result positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { formulaStringResult: '' }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 FORMULA cached empty result positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { formulaEmptyResult: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 FORMULA missing string cached result positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { formulaMissingStringResult: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MULBLANK truncated XF ranges as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes', 'Owner'],
      ['Alpha', 42, { malformedMulblank: 2 }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes\tOwner', 'Alpha\t42\t\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MULBLANK first blank position when the last column endpoint is missing', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { malformedMulblankMissingLastColumn: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MULBLANK readable blank range when the last column endpoint is missing', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes', 'Owner'],
      ['Alpha', 42, { malformedMulblankMissingLastColumnCount: 2 }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes\tOwner', 'Alpha\t42\t\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MERGEDCELLS single-row column spans as tabular columns', () => {
    const bytes = buildBiff8Workbook([['Quarterly Report'], ['Name', 'Amount', 'Notes']], {
      mergedCells: [{ firstRow: 0, lastRow: 0, firstColumn: 0, lastColumn: 2 }],
    });

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Quarterly Report\t\t', 'Name\tAmount\tNotes'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MERGEDCELLS blank anchor column spans as tabular columns', () => {
    const bytes = buildBiff8Workbook([[{ blank: true }], ['Name', 'Amount', 'Notes']], {
      mergedCells: [{ firstRow: 0, lastRow: 0, firstColumn: 0, lastColumn: 2 }],
    });

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['\t\t', 'Name\tAmount\tNotes'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MERGEDCELLS multi-row column spans as tabular columns', () => {
    const bytes = buildBiff8Workbook([['Quarterly Report'], ['Name', 'Amount', 'Notes']], {
      mergedCells: [{ firstRow: 0, lastRow: 1, firstColumn: 0, lastColumn: 2 }],
    });

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Quarterly Report\t\t', 'Name\tAmount\tNotes'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MERGEDCELLS covered rows as tabular empty rows', () => {
    const bytes = buildBiff8Workbook([['Quarterly Report'], [], ['Name', 'Amount', 'Notes']], {
      mergedCells: [{ firstRow: 0, lastRow: 1, firstColumn: 0, lastColumn: 2 }],
    });

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Quarterly Report\t\t', '\t\t', 'Name\tAmount\tNotes'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MERGEDCELLS vertical-only covered rows as empty rows', () => {
    const bytes = buildBiff8Workbook([['Section'], [], ['Name', 'Amount']], {
      mergedCells: [{ firstRow: 0, lastRow: 1, firstColumn: 0, lastColumn: 0 }],
    });

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Section', '', 'Name\tAmount'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 shared strings continued across CONTINUE records', () => {
    const bytes = buildBiff8WorkbookWithContinuedSharedStrings();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tReady'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 shared strings split inside CONTINUE records', () => {
    const bytes = buildBiff8WorkbookWithSplitContinuedSharedString();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tReady'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers BIFF8 UTF-16 shared string code units split across CONTINUE records', () => {
    const bytes = buildBiff8WorkbookWithSplitUtf16SharedStringCodeUnit();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tOK'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 shared strings after rich formatting runs continue across records', () => {
    const bytes = buildBiff8WorkbookWithContinuedRichSharedStringFormatting();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tReady'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 single worksheet names when BoundSheet metadata is present', () => {
    const bytes = buildBiff8WorkbookWithSheets([
      {
        name: 'Report',
        rows: [
          ['Name', 'Amount'],
          ['Alpha', '42'],
        ],
      },
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Report', 'Name\tAmount', 'Alpha\t42'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 single worksheet names when BoundSheet offsets are invalid', () => {
    const bytes = buildBiff8WorkbookWithSheets([
      {
        name: 'Report',
        boundSheetOffset: 0xffff,
        rows: [
          ['Name', 'Amount'],
          ['Alpha', '42'],
        ],
      },
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Report', 'Name\tAmount', 'Alpha\t42'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 worksheet names and separates same-position rows across sheets', () => {
    const bytes = buildBiff8WorkbookWithSheets([
      {
        name: 'Q1',
        rows: [
          ['Name', 'Amount'],
          ['Alpha', '42'],
        ],
      },
      {
        name: 'Q2',
        rows: [
          ['Name', 'Amount'],
          ['Beta', '108'],
        ],
      },
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Q1', 'Name\tAmount', 'Alpha\t42', '# Q2', 'Name\tAmount', 'Beta\t108'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers BIFF8 worksheet names when a sibling BoundSheet offset is invalid', () => {
    const bytes = buildBiff8WorkbookWithSheets([
      {
        name: 'Q1',
        boundSheetOffset: 0xffff,
        rows: [
          ['Name', 'Amount'],
          ['Alpha', '42'],
        ],
      },
      {
        name: 'Q2',
        rows: [
          ['Name', 'Amount'],
          ['Beta', '108'],
        ],
      },
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Q1', 'Name\tAmount', 'Alpha\t42', '# Q2', 'Name\tAmount', 'Beta\t108'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 worksheet tab order when physical sheet streams differ', () => {
    const bytes = buildBiff8WorkbookWithSheets(
      [
        {
          name: 'Q1',
          rows: [
            ['Name', 'Amount'],
            ['Alpha', '42'],
          ],
        },
        {
          name: 'Q2',
          rows: [
            ['Name', 'Amount'],
            ['Beta', '108'],
          ],
        },
      ],
      { boundSheetOrder: [1, 0] },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Q2', 'Name\tAmount', 'Beta\t108', '# Q1', 'Name\tAmount', 'Alpha\t42'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('repairs invalid BIFF8 worksheet offsets without swapping reversed tab contents', () => {
    const bytes = buildBiff8WorkbookWithSheets(
      [
        {
          name: 'Q1',
          boundSheetOffset: 0xffff,
          rows: [
            ['Name', 'Amount'],
            ['Alpha', '42'],
          ],
        },
        {
          name: 'Q2',
          rows: [
            ['Name', 'Amount'],
            ['Beta', '108'],
          ],
        },
      ],
      { boundSheetOrder: [1, 0] },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Q2', 'Name\tAmount', 'Beta\t108', '# Q1', 'Name\tAmount', 'Alpha\t42'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves the remaining BIFF8 worksheet name when sibling sheets are empty', () => {
    const bytes = buildBiff8WorkbookWithSheets([
      {
        name: 'Q1',
        rows: [],
      },
      {
        name: 'Q2',
        rows: [
          ['Name', 'Amount'],
          ['Beta', '108'],
        ],
      },
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Q2', 'Name\tAmount', 'Beta\t108'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers BIFF8 UTF-16 worksheet names around isolated surrogate code units', () => {
    const bytes = buildBiff8WorkbookWithIsolatedSurrogateSheetName();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# OK', 'Name\tAmount', 'Alpha\t42', '# Q2', 'Name\tAmount', 'Beta\t108'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers readable BIFF8 worksheet name prefixes from truncated BoundSheet records', () => {
    const bytes = buildBiff8WorkbookWithTruncatedSheetName();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Q', 'Name\tAmount', 'Alpha\t42', '# Q2', 'Name\tAmount', 'Beta\t108'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 inline label cells alongside shared string table cells', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Status'],
      ['Alpha', { label: 'Manual' }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tManual'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers BIFF8 UTF-16 inline label text around isolated surrogate code units', () => {
    const bytes = buildBiff8WorkbookWithIsolatedSurrogateInlineLabel();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tOK'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 inline label cells split across CONTINUE records', () => {
    const bytes = buildBiff8WorkbookWithContinuedInlineLabel();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tManual'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 rich inline string cells as tabular rows', () => {
    const bytes = buildBiff8WorkbookWithRichInlineString();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tManual'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers BIFF8 RSTRING text when rich formatting runs are truncated', () => {
    const bytes = buildBiff8WorkbookWithTruncatedRichInlineStringFormatting();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tManual'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers partial BIFF8 RSTRING text when inline string bodies are truncated', () => {
    const bytes = buildBiff8WorkbookWithTruncatedRichInlineStringBody();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tMan'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 BOOLERR boolean cells alongside shared string table cells', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Active'],
      ['Alpha', { bool: true }],
      ['Beta', { bool: false }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tActive', 'Alpha\tTRUE', 'Beta\tFALSE'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 BOOLERR error cells alongside shared string table cells', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Status'],
      ['Alpha', { boolError: 0x07 }],
      ['Beta', { boolError: 0x2a }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\t#DIV/0!', 'Beta\t#N/A'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 number cells alongside shared string table cells', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount'],
      ['Alpha', 42],
      ['Beta', 108.5],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t42', 'Beta\t108.5'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 BOOLERR unknown error positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Status'],
      ['Alpha', 42, { boolError: 0xff }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tStatus', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 BOOLERR truncated payload positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Status'],
      ['Alpha', 42, { malformedBoolError: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tStatus', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER percentage cells from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Completion'],
        ['Alpha', { number: 0.1234, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 171, code: '0.0%' }],
        xfs: [{ ifmt: 0 }, { ifmt: 171 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tCompletion', 'Alpha\t12.3%'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER percentage cells with quoted suffix literals from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Completion'],
        ['Alpha', { number: 0.1234, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 229, code: '0.0%" done"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 229 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tCompletion', 'Alpha\t12.3% done'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER percentage cells with trailing comma scale from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Completion'],
        ['Alpha', { number: 12.34, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 231, code: '0.0,%' }],
        xfs: [{ ifmt: 0 }, { ifmt: 231 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tCompletion', 'Alpha\t1.2%'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative percentage cells from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Completion'],
        ['Alpha', { number: -0.1234, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 206, code: '0.0%;(0.0%)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 206 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tCompletion', 'Alpha\t(12.3%)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER positive cells as ordinary numbers when only the negative FORMAT section is percentage', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Completion'],
        ['Alpha', { number: 0.1234, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 228, code: '0;(0.0%)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 228 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tCompletion', 'Alpha\t0'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER zero percentage cells from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Completion'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 207, code: '0.0%;(0.0%);-' }],
        xfs: [{ ifmt: 0 }, { ifmt: 207 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tCompletion', 'Alpha\t-'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER quoted zero percentage literals from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Completion'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 208, code: '0.0%;(0.0%);"-"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 208 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tCompletion', 'Alpha\t-'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('keeps semicolons inside BIFF8 NUMBER quoted zero percentage literals', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Completion'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 209, code: '0.0%;(0.0%);"n/a;none"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 209 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tCompletion', 'Alpha\tn/a;none'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER scientific cells from built-in scientific formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Reading'],
        ['Alpha', { number: 1234, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 11 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tReading', 'Alpha\t1.23E+03'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER scientific cells with quoted suffix literals from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Reading'],
        ['Alpha', { number: 1234, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 221, code: '0.00E+00" Hz"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 221 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tReading', 'Alpha\t1.23E+03 Hz'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative scientific cells from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Reading'],
        ['Alpha', { number: -1234, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 222, code: '0.00E+00;(0.00E+00)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 222 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tReading', 'Alpha\t(1.23E+03)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER zero scientific cells from custom FORMAT literal sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Reading'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 223, code: '0.00E+00;(0.00E+00);"-"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 223 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tReading', 'Alpha\t-'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative scientific cells when only the negative FORMAT section is scientific', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Reading'],
        ['Alpha', { number: -1234, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 226, code: '0;(0.00E+00)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 226 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tReading', 'Alpha\t(1.23E+03)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER fraction cells from built-in fraction formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Ratio'],
        ['Alpha', { number: 0.5, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 12 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tRatio', 'Alpha\t1/2'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('rounds BIFF8 NUMBER fraction cells to whole numbers when the nearest fraction carries', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Ratio'],
        ['Alpha', { number: 0.99, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 12 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tRatio', 'Alpha\t1'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER two-digit fraction cells from built-in fraction formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Ratio'],
        ['Alpha', { number: 0.1, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 13 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tRatio', 'Alpha\t1/10'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER fraction cells from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Ratio'],
        ['Alpha', { number: 0.25, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 174, code: '# ?/?' }],
        xfs: [{ ifmt: 0 }, { ifmt: 174 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tRatio', 'Alpha\t1/4'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative fraction cells from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Ratio'],
        ['Alpha', { number: -0.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 224, code: '# ?/?;(# ?/?)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 224 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tRatio', 'Alpha\t(1/2)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative fraction cells when only the negative FORMAT section is fractional', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Ratio'],
        ['Alpha', { number: -0.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 225, code: '0;(# ?/?)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 225 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tRatio', 'Alpha\t(1/2)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 1234.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 174, code: '#,##0.00' }],
        xfs: [{ ifmt: 0 }, { ifmt: 174 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t1,234.50'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells with quoted unit literals from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Weight'],
        ['Alpha', { number: 12.3, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 210, code: '0.0" kg"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 210 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tWeight', 'Alpha\t12.3 kg'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative decimal cells with quoted unit literals from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Weight'],
        ['Alpha', { number: -12.3, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 211, code: '0.0" kg";(0.0" kg")' }],
        xfs: [{ ifmt: 0 }, { ifmt: 211 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tWeight', 'Alpha\t(12.3 kg)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative decimal cells with explicit minus unit FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Weight'],
        ['Alpha', { number: -12.3, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 212, code: '0.0" kg";-0.0" kg"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 212 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tWeight', 'Alpha\t-12.3 kg'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells from built-in number formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 1234.5, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 4 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t1,234.50'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative decimal cells from built-in accounting formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: -1234, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 38 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t(1,234)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER zero cells from built-in accounting formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 41 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t-'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative decimal cells from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: -1234.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 175, code: '#,##0.00;(#,##0.00)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 175 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t(1,234.50)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER zero decimal cells from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 176, code: '#,##0.00;(#,##0.00);-' }],
        xfs: [{ ifmt: 0 }, { ifmt: 176 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t-'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells with trailing comma scale from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 1234, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 230, code: '0,' }],
        xfs: [{ ifmt: 0 }, { ifmt: 230 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t1'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells with conditional custom FORMAT fallbacks', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 12, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 232, code: '[>=1000]0.0,"K";0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 232 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t12'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells with spaced conditional custom FORMAT fallbacks', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 12, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 235, code: '[>= 1000]0.0,"K";0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 235 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t12'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells with thousands-separated conditional FORMAT thresholds', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 12, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 236, code: '[>=1,000]0.0,"K";0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 236 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t12'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells with leading-dot conditional FORMAT thresholds', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 0.25, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 237, code: '[>=.5]0.0;0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 237 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t0'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells with plus-signed conditional FORMAT thresholds', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 0.25, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 238, code: '[>=+0.5]0.0;0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 238 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t0'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells with scientific conditional FORMAT thresholds', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 12, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 239, code: '[>=1E+3]0.0,"K";0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 239 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t12'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER decimal cells with numeric fallback after conditional literal sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Amount'],
        ['Alpha', { number: 12, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 234, code: '[>=1000]"large";0.0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 234 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount', 'Alpha\t12.0'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER currency cells from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 1234.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 172, code: '$#,##0.00' }],
        xfs: [{ ifmt: 0 }, { ifmt: 172 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t$1,234.50'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER currency cells with quoted suffix literals from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 12.3, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 213, code: '$0.0" USD"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 213 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t$12.3 USD'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER currency cells with trailing comma scale from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 1234, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 233, code: '$0.0,"K"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 233 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t$1.2K'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER currency cells with locale currency directives from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 1234.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 214, code: '[$£-809]#,##0.00' }],
        xfs: [{ ifmt: 0 }, { ifmt: 214 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t£1,234.50'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative currency cells with locale currency directives from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: -1234.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 215, code: '[$£-809]#,##0.00;([$£-809]#,##0.00)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 215 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t(£1,234.50)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative currency cells with locale currency directives using non-dollar symbols', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: -1234.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 216, code: '[$¢-409]#,##0.00;([$¢-409]#,##0.00)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 216 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t(¢1,234.50)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative locale currency cells when only the negative FORMAT section is currency', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: -1234.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 227, code: '0;([$£-809]#,##0.00)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 227 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t(£1,234.50)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER currency cells with locale currency suffix directives from custom FORMAT strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 1234.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 217, code: '#,##0.00[$£-809]' }],
        xfs: [{ ifmt: 0 }, { ifmt: 217 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t1,234.50£'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER currency cells from built-in currency formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 1234.5, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 7 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t$1,234.50'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative currency cells from built-in currency formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: -1234.5, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 7 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t($1,234.50)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER zero currency cells from built-in accounting formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 42 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t$-'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER negative currency cells from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: -1234.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 173, code: '$#,##0.00;($#,##0.00)' }],
        xfs: [{ ifmt: 0 }, { ifmt: 173 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t($1,234.50)'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER zero currency cells from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 177, code: '$#,##0.00;($#,##0.00);$-' }],
        xfs: [{ ifmt: 0 }, { ifmt: 177 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t$-'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER zero currency cells without fill control characters from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 218, code: '$#,##0.00;($#,##0.00);$* -' }],
        xfs: [{ ifmt: 0 }, { ifmt: 218 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t$-'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 NUMBER zero currency quoted literals that look like fill controls', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 219, code: '$#,##0.00;($#,##0.00);"$* -"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 219 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t$* -'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 NUMBER zero currency quoted bracket literals from custom FORMAT sections', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Budget'],
        ['Alpha', { number: 0, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 220, code: '$#,##0.00;($#,##0.00);"[zero]"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 220 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tBudget', 'Alpha\t[zero]'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date cells from XF built-in date formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: 45292, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 14 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-only cells with fractional day serials', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: 45292.5, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 14 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date cells from the 1904 date system', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: 1, xf: 1 }],
      ],
      {
        date1904: true,
        xfs: [{ ifmt: 0 }, { ifmt: 14 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t1904-01-02'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time cells with fractional day serials', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: 45292.5, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 22 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01T12:00'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time cells with seconds from custom formats', () => {
    const noonWithSeconds = 45292 + (12 * 60 * 60 + 34 * 60 + 56) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: noonWithSeconds, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 166, code: 'yyyy-mm-dd hh:mm:ss' }],
        xfs: [{ ifmt: 0 }, { ifmt: 166 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01T12:34:56'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time cells with milliseconds from custom formats', () => {
    const noonWithMilliseconds = 45292 + (12 * 60 * 60 + 34 * 60 + 56.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: noonWithMilliseconds, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 177, code: 'yyyy-mm-dd hh:mm:ss.000' }],
        xfs: [{ ifmt: 0 }, { ifmt: 177 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01T12:34:56.700'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time AM/PM minute cells from custom formats', () => {
    const afternoon = 45292 + (13 * 60 + 5) / (24 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: afternoon, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 190, code: 'yyyy-mm-dd h:mm AM/PM' }],
        xfs: [{ ifmt: 0 }, { ifmt: 190 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01 1:05 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time AM/PM second cells from custom formats', () => {
    const afternoon = 45292 + (13 * 60 * 60 + 5 * 60 + 7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: afternoon, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 191, code: 'yyyy-mm-dd h:mm:ss AM/PM' }],
        xfs: [{ ifmt: 0 }, { ifmt: 191 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01 1:05:07 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time A/P minute cells from custom formats', () => {
    const afternoon = 45292 + (13 * 60 + 5) / (24 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: afternoon, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 192, code: 'yyyy-mm-dd h:mm A/P' }],
        xfs: [{ ifmt: 0 }, { ifmt: 192 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01 1:05 P'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time A/P second cells from custom formats', () => {
    const afternoon = 45292 + (13 * 60 * 60 + 5 * 60 + 7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: afternoon, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 193, code: 'yyyy-mm-dd h:mm:ss A/P' }],
        xfs: [{ ifmt: 0 }, { ifmt: 193 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01 1:05:07 P'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time A/P millisecond cells from custom formats', () => {
    const afternoon = 45292 + (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: afternoon, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 197, code: 'yyyy-mm-dd h:mm:ss.000 A/P' }],
        xfs: [{ ifmt: 0 }, { ifmt: 197 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01 1:05:07.700 P'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time A/P one-decimal fractional second cells from custom formats', () => {
    const afternoon = 45292 + (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: afternoon, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 198, code: 'yyyy-mm-dd h:mm:ss.0 A/P' }],
        xfs: [{ ifmt: 0 }, { ifmt: 198 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01 1:05:07.7 P'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time A/P two-decimal fractional second cells from custom formats', () => {
    const afternoon = 45292 + (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: afternoon, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 199, code: 'yyyy-mm-dd h:mm:ss.00 A/P' }],
        xfs: [{ ifmt: 0 }, { ifmt: 199 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01 1:05:07.70 P'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time AM/PM millisecond cells from custom formats', () => {
    const afternoon = 45292 + (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: afternoon, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 194, code: 'yyyy-mm-dd h:mm:ss.000 AM/PM' }],
        xfs: [{ ifmt: 0 }, { ifmt: 194 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01 1:05:07.700 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time AM/PM one-decimal fractional second cells from custom formats', () => {
    const afternoon = 45292 + (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: afternoon, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 195, code: 'yyyy-mm-dd h:mm:ss.0 AM/PM' }],
        xfs: [{ ifmt: 0 }, { ifmt: 195 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01 1:05:07.7 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date-time AM/PM two-decimal fractional second cells from custom formats', () => {
    const afternoon = 45292 + (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: afternoon, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 196, code: 'yyyy-mm-dd h:mm:ss.00 AM/PM' }],
        xfs: [{ ifmt: 0 }, { ifmt: 196 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01 1:05:07.70 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER time-only cells from custom formats', () => {
    const timeOnly = (12 * 60 * 60 + 34 * 60 + 56) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 167, code: 'hh:mm:ss' }],
        xfs: [{ ifmt: 0 }, { ifmt: 167 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t12:34:56'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER AM/PM time-only cells from custom formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 168, code: 'h:mm AM/PM' }],
        xfs: [{ ifmt: 0 }, { ifmt: 168 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER AM/PM second time-only cells from custom formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60 + 7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 169, code: 'h:mm:ss AM/PM' }],
        xfs: [{ ifmt: 0 }, { ifmt: 169 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05:07 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER AM/PM one-decimal fractional second time-only cells from custom formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 200, code: 'h:mm:ss.0 AM/PM' }],
        xfs: [{ ifmt: 0 }, { ifmt: 200 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05:07.7 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER AM/PM two-decimal fractional second time-only cells from custom formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 201, code: 'h:mm:ss.00 AM/PM' }],
        xfs: [{ ifmt: 0 }, { ifmt: 201 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05:07.70 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER AM/PM millisecond time-only cells from custom formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 202, code: 'h:mm:ss.000 AM/PM' }],
        xfs: [{ ifmt: 0 }, { ifmt: 202 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05:07.700 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER A/P minute time-only cells from custom formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 170, code: 'h:mm A/P' }],
        xfs: [{ ifmt: 0 }, { ifmt: 170 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05 P'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER A/P one-decimal fractional second time-only cells from custom formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 203, code: 'h:mm:ss.0 A/P' }],
        xfs: [{ ifmt: 0 }, { ifmt: 203 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05:07.7 P'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER A/P two-decimal fractional second time-only cells from custom formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 204, code: 'h:mm:ss.00 A/P' }],
        xfs: [{ ifmt: 0 }, { ifmt: 204 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05:07.70 P'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER A/P millisecond time-only cells from custom formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60 + 7.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 205, code: 'h:mm:ss.000 A/P' }],
        xfs: [{ ifmt: 0 }, { ifmt: 205 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05:07.700 P'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER minute-second time cells from built-in formats', () => {
    const timeOnly = (34 * 60 + 56) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 45 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t34:56'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER fractional second time cells from built-in formats', () => {
    const timeOnly = (34 * 60 + 56.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 47 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t34:56.7'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER AM/PM time cells from built-in formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 18 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER AM/PM second time cells from built-in formats', () => {
    const timeOnly = (13 * 60 * 60 + 5 * 60 + 7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 19 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t1:05:07 PM'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER fractional second time cells from custom formats', () => {
    const timeOnly = (34 * 60 + 56.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 171, code: 'mm:ss.0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 171 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t34:56.7'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER hour fractional second time cells from custom formats', () => {
    const timeOnly = (12 * 60 * 60 + 34 * 60 + 56.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 172, code: 'h:mm:ss.0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 172 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t12:34:56.7'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER two-decimal fractional second time cells from custom formats', () => {
    const timeOnly = (34 * 60 + 56.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 173, code: 'mm:ss.00' }],
        xfs: [{ ifmt: 0 }, { ifmt: 173 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t34:56.70'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER hour two-decimal fractional second time cells from custom formats', () => {
    const timeOnly = (12 * 60 * 60 + 34 * 60 + 56.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 174, code: 'h:mm:ss.00' }],
        xfs: [{ ifmt: 0 }, { ifmt: 174 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t12:34:56.70'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER millisecond time cells from custom formats', () => {
    const timeOnly = (34 * 60 + 56.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 175, code: 'mm:ss.000' }],
        xfs: [{ ifmt: 0 }, { ifmt: 175 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t34:56.700'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER hour millisecond time cells from custom formats', () => {
    const timeOnly = (12 * 60 * 60 + 34 * 60 + 56.7) / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'At'],
        ['Alpha', { number: timeOnly, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 176, code: 'h:mm:ss.000' }],
        xfs: [{ ifmt: 0 }, { ifmt: 176 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAt', 'Alpha\t12:34:56.700'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed time cells from custom formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: 1.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 168, code: '[h]:mm:ss' }],
        xfs: [{ ifmt: 0 }, { ifmt: 168 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t36:00:00'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed time cells with repeated hour tokens from custom formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: 1.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 187, code: '[hh]:mm:ss' }],
        xfs: [{ ifmt: 0 }, { ifmt: 187 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t36:00:00'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed millisecond time cells from custom formats', () => {
    const elapsedWithMilliseconds = 1.5 + 0.7 / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: elapsedWithMilliseconds, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 178, code: '[h]:mm:ss.000' }],
        xfs: [{ ifmt: 0 }, { ifmt: 178 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t36:00:00.700'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed two-decimal time cells from custom formats', () => {
    const elapsedWithFractionalSecond = 1.5 + 0.7 / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: elapsedWithFractionalSecond, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 181, code: '[h]:mm:ss.00' }],
        xfs: [{ ifmt: 0 }, { ifmt: 181 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t36:00:00.70'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed one-decimal time cells from custom formats', () => {
    const elapsedWithFractionalSecond = 1.5 + 0.7 / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: elapsedWithFractionalSecond, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 186, code: '[h]:mm:ss.0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 186 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t36:00:00.7'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed time cells from built-in elapsed formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: 1.5, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 46 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t36:00:00'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed minute cells from custom formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: 1.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 169, code: '[m]:ss' }],
        xfs: [{ ifmt: 0 }, { ifmt: 169 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t2160:00'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed minute cells with repeated minute tokens from custom formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: 1.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 188, code: '[mm]:ss' }],
        xfs: [{ ifmt: 0 }, { ifmt: 188 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t2160:00'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed minute millisecond cells from custom formats', () => {
    const elapsedWithMilliseconds = 1.5 + 0.7 / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: elapsedWithMilliseconds, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 179, code: '[m]:ss.000' }],
        xfs: [{ ifmt: 0 }, { ifmt: 179 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t2160:00.700'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed minute two-decimal cells from custom formats', () => {
    const elapsedWithFractionalSecond = 1.5 + 0.7 / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: elapsedWithFractionalSecond, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 182, code: '[m]:ss.00' }],
        xfs: [{ ifmt: 0 }, { ifmt: 182 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t2160:00.70'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed minute one-decimal cells from custom formats', () => {
    const elapsedWithFractionalSecond = 1.5 + 0.7 / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: elapsedWithFractionalSecond, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 185, code: '[m]:ss.0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 185 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t2160:00.7'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed second cells from custom formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: 1.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 170, code: '[s]' }],
        xfs: [{ ifmt: 0 }, { ifmt: 170 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t129600'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed second cells with repeated second tokens from custom formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: 1.5, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 189, code: '[ss]' }],
        xfs: [{ ifmt: 0 }, { ifmt: 189 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t129600'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed second millisecond cells from custom formats', () => {
    const elapsedWithMilliseconds = 1.5 + 0.7 / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: elapsedWithMilliseconds, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 180, code: '[s].000' }],
        xfs: [{ ifmt: 0 }, { ifmt: 180 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t129600.700'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed second two-decimal cells from custom formats', () => {
    const elapsedWithFractionalSecond = 1.5 + 0.7 / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: elapsedWithFractionalSecond, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 183, code: '[s].00' }],
        xfs: [{ ifmt: 0 }, { ifmt: 183 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t129600.70'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER elapsed second one-decimal cells from custom formats', () => {
    const elapsedWithFractionalSecond = 1.5 + 0.7 / (24 * 60 * 60);
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Duration'],
        ['Alpha', { number: elapsedWithFractionalSecond, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 184, code: '[s].0' }],
        xfs: [{ ifmt: 0 }, { ifmt: 184 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDuration', 'Alpha\t129600.7'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date cells from custom FORMAT date strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: 45292, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 165, code: 'yyyy-mm-dd' }],
        xfs: [{ ifmt: 0 }, { ifmt: 165 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('keeps BIFF8 NUMBER cells on numeric custom FORMAT sections when later sections contain dates', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: 45292, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 188, code: '0;yyyy-mm-dd' }],
        xfs: [{ ifmt: 0 }, { ifmt: 188 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t45292'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date cells from custom FORMAT year-only strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: 45292, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 181, code: 'yyyy' }],
        xfs: [{ ifmt: 0 }, { ifmt: 181 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date cells from custom FORMAT month-day strings', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: 45292, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 185, code: 'm/d' }],
        xfs: [{ ifmt: 0 }, { ifmt: 185 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date cells from custom FORMAT month-day strings with escaped separators', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: 45292, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 186, code: 'm\\/d' }],
        xfs: [{ ifmt: 0 }, { ifmt: 186 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date cells from custom FORMAT month-day strings with CJK unit literals', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { number: 45292, xf: 1 }],
      ],
      {
        formats: [{ ifmt: 187, code: 'm"\u6708"d"\u65e5"' }],
        xfs: [{ ifmt: 0 }, { ifmt: 187 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 NUMBER date cells from custom FORMAT strings continued across CONTINUE records', () => {
    const bytes = buildBiff8WorkbookWithContinuedCustomDateFormat();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 NUMBER non-finite numeric positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { number: Infinity }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 NUMBER truncated numeric payload positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { malformedNumber: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 RK compressed number cells alongside shared string table cells', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Qty', 'Rate'],
      ['Alpha', { rk: 7 }, { rk: 12.34, divideBy100: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tQty\tRate', 'Alpha\t7\t12.34'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 RK date cells from XF date formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { rk: 45292, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 14 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 RK invalid compressed number positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { rawRk: 0x7ff00000 }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 RK truncated compressed number positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { malformedRk: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 MULRK adjacent compressed number cells as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Q1', 'Q2', 'Q3'],
      ['Alpha', { mulrk: [10, 20, { value: 30.5, divideBy100: true }] }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tQ1\tQ2\tQ3', 'Alpha\t10\t20\t30.5'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MULRK invalid trailing compressed number positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Q1', 'Q2', 'Q3'],
      ['Alpha', { mulrk: [10, 20, { rawRk: 0x7ff00000 }] }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tQ1\tQ2\tQ3', 'Alpha\t10\t20\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MULRK truncated compressed number ranges as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Q1', 'Q2'],
      ['Alpha', { malformedMulrk: [10], declaredCellCount: 2 }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tQ1\tQ2', 'Alpha\t10\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 MULRK first compressed number when the last column endpoint is missing', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Q1'],
      ['Alpha', { malformedMulrkMissingLastColumn: [10] }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tQ1', 'Alpha\t10'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 MULRK date cells from per-cell XF date formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Start', 'End'],
        [
          'Alpha',
          {
            mulrk: [
              { value: 45292, xf: 1 },
              { value: 45293, xf: 1 },
            ],
          },
        ],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 14 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStart\tEnd', 'Alpha\t2024-01-01\t2024-01-02'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 formula cached number cells as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Total'],
      ['Alpha', { formulaResult: 123.45 }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tTotal', 'Alpha\t123.45'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 FORMULA non-finite numeric cached result positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { formulaResult: Infinity }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 FORMULA truncated cached result positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { malformedFormula: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 FORMULA malformed string cached result positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Notes'],
      ['Alpha', 42, { formulaMalformedStringResult: true }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('formats BIFF8 formula cached number date cells from XF date formats', () => {
    const bytes = buildBiff8Workbook(
      [
        ['Name', 'Due'],
        ['Alpha', { formulaResult: 45292, xf: 1 }],
      ],
      {
        xfs: [{ ifmt: 0 }, { ifmt: 14 }],
      },
    );

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tDue', 'Alpha\t2024-01-01'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 formula cached string cells as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Status'],
      ['Alpha', { formulaStringResult: 'Ready' }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tReady'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 formula cached strings continued across CONTINUE records', () => {
    const bytes = buildBiff8WorkbookWithContinuedFormulaString();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\tReady'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 formula cached boolean cells as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Eligible'],
      ['Alpha', { formulaBooleanResult: true }],
      ['Beta', { formulaBooleanResult: false }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tEligible', 'Alpha\tTRUE', 'Beta\tFALSE'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('reconstructs BIFF8 formula cached error cells as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Status'],
      ['Alpha', { formulaErrorResult: 0x07 }],
      ['Beta', { formulaErrorResult: 0x2a }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tStatus', 'Alpha\t#DIV/0!', 'Beta\t#N/A'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 FORMULA unknown error cached result positions as tabular columns', () => {
    const bytes = buildBiff8Workbook([
      ['Name', 'Amount', 'Status'],
      ['Alpha', 42, { formulaErrorResult: 0xff }],
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tStatus', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('preserves BIFF8 BLANK record-level truncated payload positions as tabular columns', () => {
    const bytes = buildBiff8WorkbookWithTruncatedBlankRecord();

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Name\tAmount\tNotes', 'Alpha\t42\t'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('extracts printable text from legacy PowerPoint ASCII binary content', () => {
    const bytes = new TextEncoder().encode('\u0000\u0001Launch Plan\u0000Q3 Goals\u0000');

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Launch Plan', 'Q3 Goals'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('extracts legacy PowerPoint text atoms shorter than printable fallback runs', () => {
    const bytes = new Uint8Array([
      ...pptTextHeaderAtom(),
      ...pptTextBytesAtom('Q1'),
      ...pptTextHeaderAtom(),
      ...pptTextCharsAtom('OK'),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Q1', 'OK'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint TextBytesAtom text from truncated payloads', () => {
    const bytes = new Uint8Array([...pptTextHeaderAtom(), ...pptTruncatedTextBytesAtom('Go', 5)]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'Go',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint TextBytesAtom Windows-1252 smart quotes', () => {
    const bytes = new Uint8Array([...pptTextHeaderAtom(), ...pptTextBytesAtomBytes([0x93, ...ascii('Go'), 0x94])]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: '\u201cGo\u201d',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint TextBytesAtom text around undefined Windows-1252 controls', () => {
    const bytes = new Uint8Array([
      ...pptTextHeaderAtom(),
      ...pptTextBytesAtomBytes([...ascii('O'), 0x81, ...ascii('K')]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'OK',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint TextBytesAtom text around NUL padding bytes', () => {
    const bytes = new Uint8Array([
      ...pptTextHeaderAtom(),
      ...pptTextBytesAtomBytes([...ascii('Go'), 0x00, ...ascii('Now')]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'GoNow',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint TextBytesAtom text around C0 control bytes', () => {
    const bytes = new Uint8Array([
      ...pptTextHeaderAtom(),
      ...pptTextBytesAtomBytes([...ascii('O'), 0x07, ...ascii('K')]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'OK',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint TextCharsAtom text from truncated payloads', () => {
    const bytes = new Uint8Array([...pptTextHeaderAtom(), ...pptTruncatedTextCharsAtom('OK', 5)]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'OK',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers complete legacy PowerPoint TextCharsAtom characters before dangling truncated bytes', () => {
    const bytes = new Uint8Array([...pptTextHeaderAtom(), ...pptTextCharsAtomWithDanglingByte('OK')]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'OK',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint TextCharsAtom text before dangling high surrogates', () => {
    const bytes = new Uint8Array([...pptTextHeaderAtom(), ...pptTextCharsAtomWithDanglingHighSurrogate('OK')]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'OK',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint TextCharsAtom text before dangling low surrogates', () => {
    const bytes = new Uint8Array([...pptTextHeaderAtom(), ...pptTextCharsAtomWithDanglingLowSurrogate('OK')]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'OK',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint TextCharsAtom text around isolated surrogate code units', () => {
    const bytes = new Uint8Array([...pptTextHeaderAtom(), ...pptTextCharsAtomWithIsolatedSurrogate('O', 'K')]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'OK',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint TextCharsAtom text around C0 control code units', () => {
    const bytes = new Uint8Array([...pptTextHeaderAtom(), ...pptTextCharsAtomWithControlCodeUnit('O', 'K')]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: 'OK',
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('extracts adjacent legacy PowerPoint text atoms under the same text header', () => {
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [
          ...pptTextHeaderAtom(),
          ...pptTextBytesAtom('Launch'),
          ...pptTextCharsAtom('Plan'),
          ...pptTextHeaderAtom(),
          ...pptTextBytesAtom('Next'),
        ]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'Launch', 'Plan', 'Next'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('deduplicates repeated legacy PowerPoint text atoms under the same text header', () => {
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [...pptTextHeaderAtom(), ...pptTextBytesAtom('Launch'), ...pptTextCharsAtom('Launch')]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'Launch'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint text atoms truncated at slide container boundaries', () => {
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [...pptTextHeaderAtom(), ...pptTruncatedTextBytesAtom('Go', 12)]),
        ...pptContainer(0x03ee, [...pptTextHeaderAtom(), ...pptTextBytesAtom('Next')]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'Go', '# Slide 2', 'Next'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint text headers truncated at slide container boundaries', () => {
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [...pptTruncatedTextHeaderAtom(0, 32), ...pptTextBytesAtom('Go')]),
        ...pptContainer(0x03ee, [...pptTextHeaderAtom(), ...pptTextBytesAtom('Next')]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'Go', '# Slide 2', 'Next'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint text after truncated non-text atoms inside text bodies', () => {
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [
          ...pptTextHeaderAtom(),
          ...pptTruncatedUnsupportedAtom(0x0fb0, 'Pad', 32),
          ...pptTextBytesAtom('Go'),
        ]),
        ...pptContainer(0x03ee, [...pptTextHeaderAtom(), ...pptTextBytesAtom('Next')]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'Go', '# Slide 2', 'Next'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint text after truncated text atoms inside text bodies', () => {
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [
          ...pptTextHeaderAtom(),
          ...pptTruncatedTextBytesAtom('Go', 32),
          ...pptTextBytesAtom('Next'),
        ]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'Go', 'Next'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('recovers legacy PowerPoint text when truncated text atoms precede non-text atoms', () => {
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [
          ...pptTextHeaderAtom(),
          ...pptTruncatedTextBytesAtom('Go', 48),
          ...pptRecord(0x0fb0, ascii('Pad')),
          ...pptTextBytesAtom('Next'),
        ]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'Go', 'Next'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('keeps legacy PowerPoint truncated text payloads that resemble empty atoms', () => {
    const fakeEmptyAtomHeader = [...uint16(0), ...uint16(1), ...uint32(0)];
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [
          ...pptTextHeaderAtom(),
          ...pptTruncatedTextBytesAtomBytes([...ascii('Go'), ...fakeEmptyAtomHeader, ...ascii('Now')], 32),
        ]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'GoNow'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('keeps legacy PowerPoint truncated text payloads that resemble empty text atoms', () => {
    const fakeEmptyTextAtomHeader = [...uint16(0), ...uint16(0x0fa8), ...uint32(0)];
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [
          ...pptTextHeaderAtom(),
          ...pptTruncatedTextBytesAtomBytes([...ascii('Go'), ...fakeEmptyTextAtomHeader, ...ascii('Now')], 32),
        ]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'GoNow'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('keeps legacy PowerPoint truncated text payloads that resemble text headers', () => {
    const fakeTextHeaderAtom = [...pptTextHeaderAtom(), 0, 0, 0, 0];
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [
          ...pptTextHeaderAtom(),
          ...pptTruncatedTextBytesAtomBytes([...ascii('Go'), ...fakeTextHeaderAtom, ...ascii('Now')], 40),
        ]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'GoNow'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('deduplicates legacy PowerPoint text atoms from printable fallback runs', () => {
    const bytes = new Uint8Array([
      ...pptTextHeaderAtom(),
      ...pptTextBytesAtom('Launch Plan'),
      ...pptTextHeaderAtom(),
      ...pptTextCharsAtom('Q3 Goals'),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['Launch Plan', 'Q3 Goals'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('groups legacy PowerPoint text atoms by slide containers', () => {
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [
          ...pptTextHeaderAtom(),
          ...pptTextBytesAtom('Opening'),
          ...pptTextHeaderAtom(),
          ...pptTextCharsAtom('Agenda'),
        ]),
        ...pptContainer(0x03ee, [
          ...pptTextHeaderAtom(),
          ...pptTextBytesAtom('Decision'),
          ...pptTextHeaderAtom(),
          ...pptTextCharsAtom('Next'),
        ]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'Opening', 'Agenda', '# Slide 2', 'Decision', 'Next'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('groups legacy PowerPoint notes text by notes containers', () => {
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [...pptTextHeaderAtom(), ...pptTextBytesAtom('Opening')]),
        ...pptContainer(0x03f0, [
          ...pptTextHeaderAtom(),
          ...pptTextBytesAtom('Mention customer risk'),
          ...pptTextHeaderAtom(),
          ...pptTextCharsAtom('Ask for decision'),
        ]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'Opening', '# Notes 1', 'Mention customer risk', 'Ask for decision'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });

  it('extracts legacy PowerPoint center-title text header bodies', () => {
    const bytes = new Uint8Array([
      ...pptContainer(0x03e8, [
        ...pptContainer(0x03ee, [
          ...pptTextHeaderAtom(6),
          ...pptTextBytesAtom('Go'),
          ...pptTextHeaderAtom(7),
          ...pptTextCharsAtom('Win'),
        ]),
      ]),
    ]);

    expect(extractLegacyBinaryOfficeTextFromBuffer(bytes)).toEqual({
      text: ['# Slide 1', 'Go', 'Win'].join('\n'),
      bytesRead: bytes.byteLength,
      truncated: false,
    });
  });
});

interface Biff8RkCell {
  rk: number;
  divideBy100?: boolean;
  xf?: number;
}

interface Biff8RawRkCell {
  rawRk: number;
  xf?: number;
}

interface Biff8MalformedRkCell {
  malformedRk: true;
  xf?: number;
}

interface Biff8NumberCell {
  number: number;
  xf?: number;
}

interface Biff8MalformedNumberCell {
  malformedNumber: true;
  xf?: number;
}

interface Biff8MulRkValue {
  value: number;
  divideBy100?: boolean;
  xf?: number;
}

interface Biff8MulRkCell {
  mulrk: Array<number | Biff8MulRkValue | Biff8RawRkCell>;
}

interface Biff8MalformedMulRkCell {
  malformedMulrk: Array<number | Biff8MulRkValue | Biff8RawRkCell>;
  declaredCellCount: number;
}

interface Biff8MalformedMulRkMissingLastColumnCell {
  malformedMulrkMissingLastColumn: Array<number | Biff8MulRkValue | Biff8RawRkCell>;
}

interface Biff8FormulaCell {
  formulaResult: number;
  xf?: number;
}

interface Biff8MalformedFormulaCell {
  malformedFormula: true;
  xf?: number;
}

interface Biff8FormulaStringCell {
  formulaStringResult: string;
}

interface Biff8FormulaBooleanCell {
  formulaBooleanResult: boolean;
}

interface Biff8FormulaErrorCell {
  formulaErrorResult: number;
}

interface Biff8FormulaEmptyCell {
  formulaEmptyResult: true;
}

interface Biff8FormulaMissingStringCell {
  formulaMissingStringResult: true;
}

interface Biff8FormulaMalformedStringCell {
  formulaMalformedStringResult: true;
}

interface Biff8MissingSharedStringCell {
  missingSharedString: true;
}

interface Biff8MalformedSharedStringCell {
  malformedSharedString: true;
  xf?: number;
}

interface Biff8InlineLabelCell {
  label: string;
}

interface Biff8MissingInlineLabelCell {
  missingLabel: true;
}

interface Biff8MalformedInlineLabelHeaderCell {
  malformedLabelHeader: true;
  xf?: number;
}

interface Biff8BooleanCell {
  bool: boolean;
}

interface Biff8BoolErrorCell {
  boolError: number;
}

interface Biff8MalformedBoolErrorCell {
  malformedBoolError: true;
  xf?: number;
}

interface Biff8BlankCell {
  blank: true;
}

interface Biff8MulBlankCell {
  mulblank: number;
}

interface Biff8MalformedMulBlankCell {
  malformedMulblank: number;
}

interface Biff8MalformedMulBlankMissingLastColumnCell {
  malformedMulblankMissingLastColumn: true;
}

interface Biff8MalformedMulBlankMissingLastColumnRangeCell {
  malformedMulblankMissingLastColumnCount: number;
}

type Biff8Cell =
  | string
  | number
  | Biff8NumberCell
  | Biff8MalformedNumberCell
  | Biff8RkCell
  | Biff8RawRkCell
  | Biff8MalformedRkCell
  | Biff8MulRkCell
  | Biff8MalformedMulRkCell
  | Biff8MalformedMulRkMissingLastColumnCell
  | Biff8FormulaCell
  | Biff8MalformedFormulaCell
  | Biff8FormulaStringCell
  | Biff8FormulaBooleanCell
  | Biff8FormulaErrorCell
  | Biff8FormulaEmptyCell
  | Biff8FormulaMissingStringCell
  | Biff8FormulaMalformedStringCell
  | Biff8MissingSharedStringCell
  | Biff8MalformedSharedStringCell
  | Biff8InlineLabelCell
  | Biff8MissingInlineLabelCell
  | Biff8MalformedInlineLabelHeaderCell
  | Biff8BooleanCell
  | Biff8BoolErrorCell
  | Biff8MalformedBoolErrorCell
  | Biff8BlankCell
  | Biff8MulBlankCell
  | Biff8MalformedMulBlankCell
  | Biff8MalformedMulBlankMissingLastColumnCell
  | Biff8MalformedMulBlankMissingLastColumnRangeCell;

interface Biff8WorkbookOptions {
  formats?: Array<{ ifmt: number; code: string }>;
  xfs?: Array<{ ifmt: number }>;
  date1904?: boolean;
  mergedCells?: Biff8MergedCellRange[];
}

interface Biff8MergedCellRange {
  firstRow: number;
  lastRow: number;
  firstColumn: number;
  lastColumn: number;
}

function buildBiff8Workbook(rows: Biff8Cell[][], options: Biff8WorkbookOptions = {}): Uint8Array {
  const stringCells = rows
    .flatMap((row, rowIndex) =>
      row.map((value, columnIndex) => ({
        value,
        rowIndex,
        columnIndex,
      })),
    )
    .filter((cell): cell is { value: string; rowIndex: number; columnIndex: number } => typeof cell.value === 'string');
  const strings = stringCells.map((cell) => cell.value);
  const stringIndexes = new Map<string, number>();
  stringCells.forEach((cell, index) => {
    stringIndexes.set(`${cell.rowIndex}:${cell.columnIndex}`, index);
  });

  const sstPayload = [
    ...uint32(strings.length),
    ...uint32(strings.length),
    ...strings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ];

  const records = [
    ...(options.date1904 ? [record(0x0022, [...uint16(1)])] : []),
    ...(options.formats ?? []).map((format) =>
      record(0x041e, [...uint16(format.ifmt), ...biff8FixtureUnicodeString(format.code)]),
    ),
    ...(options.xfs ?? []).map((xf) =>
      record(0x00e0, [
        ...uint16(0),
        ...uint16(xf.ifmt),
        ...uint16(0),
        ...uint16(0),
        ...uint32(0),
        ...uint32(0),
        ...uint16(0),
      ]),
    ),
    record(0x00fc, sstPayload),
    ...rows.flatMap((row, rowIndex) =>
      row.map((value, columnIndex) => {
        if (isBiff8FormulaErrorCell(value)) {
          return record(0x0006, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(0),
            0x02,
            0,
            value.formulaErrorResult,
            0,
            0,
            0,
            0xff,
            0xff,
            ...uint16(0),
            ...uint32(0),
            ...uint16(0),
          ]);
        }
        if (isBiff8FormulaEmptyCell(value)) {
          return record(0x0006, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(0),
            0x03,
            0,
            0,
            0,
            0,
            0,
            0xff,
            0xff,
            ...uint16(0),
            ...uint32(0),
            ...uint16(0),
          ]);
        }
        if (isBiff8FormulaMissingStringCell(value)) {
          return record(0x0006, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(0),
            0,
            0,
            0,
            0,
            0,
            0,
            0xff,
            0xff,
            ...uint16(0),
            ...uint32(0),
            ...uint16(0),
          ]);
        }
        if (isBiff8FormulaMalformedStringCell(value)) {
          return [
            ...record(0x0006, [
              ...uint16(rowIndex),
              ...uint16(columnIndex),
              ...uint16(0),
              ...float64(Infinity),
              ...uint16(0),
              ...uint32(0),
              ...uint16(0),
            ]),
            ...record(0x0207, [...uint16(5), 0]),
          ];
        }
        if (isBiff8MalformedFormulaCell(value)) {
          return record(0x0006, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(value.xf ?? 0)]);
        }
        if (isBiff8FormulaBooleanCell(value)) {
          return record(0x0006, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(0),
            0x01,
            0,
            value.formulaBooleanResult ? 1 : 0,
            0,
            0,
            0,
            0xff,
            0xff,
            ...uint16(0),
            ...uint32(0),
            ...uint16(0),
          ]);
        }
        if (isBiff8BooleanCell(value)) {
          return record(0x0205, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(0), value.bool ? 1 : 0, 0]);
        }
        if (isBiff8BoolErrorCell(value)) {
          return record(0x0205, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(0), value.boolError, 1]);
        }
        if (isBiff8MalformedBoolErrorCell(value)) {
          return record(0x0205, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(value.xf ?? 0)]);
        }
        if (isBiff8BlankCell(value)) {
          return record(0x0201, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(0)]);
        }
        if (isBiff8MulBlankCell(value)) {
          return record(0x00be, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...Array.from({ length: value.mulblank }, () => uint16(0)).flat(),
            ...uint16(columnIndex + value.mulblank - 1),
          ]);
        }
        if (isBiff8MalformedMulBlankCell(value)) {
          return record(0x00be, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(0),
            ...uint16(columnIndex + value.malformedMulblank - 1),
          ]);
        }
        if (isBiff8MalformedMulBlankMissingLastColumnCell(value)) {
          return record(0x00be, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(0)]);
        }
        if (isBiff8MalformedMulBlankMissingLastColumnRangeCell(value)) {
          return record(0x00be, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...Array.from({ length: value.malformedMulblankMissingLastColumnCount }, () => uint16(0)).flat(),
          ]);
        }
        if (isBiff8InlineLabelCell(value)) {
          return record(0x0204, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(0),
            ...uint16(value.label.length),
            0,
            ...ascii(value.label),
          ]);
        }
        if (isBiff8MissingInlineLabelCell(value)) {
          return record(0x0204, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(0), ...uint16(5), 0]);
        }
        if (isBiff8MalformedInlineLabelHeaderCell(value)) {
          return record(0x0204, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(value.xf ?? 0)]);
        }
        if (isBiff8MissingSharedStringCell(value)) {
          return record(0x00fd, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(0),
            ...uint32(strings.length + 99),
          ]);
        }
        if (isBiff8MalformedSharedStringCell(value)) {
          return record(0x00fd, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(value.xf ?? 0)]);
        }
        if (isBiff8FormulaStringCell(value)) {
          return [
            ...record(0x0006, [
              ...uint16(rowIndex),
              ...uint16(columnIndex),
              ...uint16(0),
              0,
              0,
              0,
              0,
              0,
              0,
              0xff,
              0xff,
              ...uint16(0),
              ...uint32(0),
              ...uint16(0),
            ]),
            ...record(0x0207, [...uint16(value.formulaStringResult.length), 0, ...ascii(value.formulaStringResult)]),
          ];
        }
        if (isBiff8FormulaCell(value)) {
          return record(0x0006, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(value.xf ?? 0),
            ...float64(value.formulaResult),
            ...uint16(0),
            ...uint32(0),
            ...uint16(0),
          ]);
        }
        if (isBiff8MalformedMulRkCell(value)) {
          return record(0x00bd, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...value.malformedMulrk.flatMap((rkValue) => {
              if (isBiff8RawRkValue(rkValue)) return [...uint16(rkValue.xf ?? 0), ...uint32(rkValue.rawRk)];
              const rawValue = typeof rkValue === 'number' ? rkValue : rkValue.value;
              const divideBy100 = typeof rkValue === 'number' ? false : rkValue.divideBy100;
              const xf = typeof rkValue === 'number' ? 0 : (rkValue.xf ?? 0);
              return [...uint16(xf), ...rkNumber(rawValue, divideBy100)];
            }),
            ...uint16(columnIndex + value.declaredCellCount - 1),
          ]);
        }
        if (isBiff8MalformedMulRkMissingLastColumnCell(value)) {
          return record(0x00bd, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...value.malformedMulrkMissingLastColumn.flatMap((rkValue) => {
              if (isBiff8RawRkValue(rkValue)) return [...uint16(rkValue.xf ?? 0), ...uint32(rkValue.rawRk)];
              const rawValue = typeof rkValue === 'number' ? rkValue : rkValue.value;
              const divideBy100 = typeof rkValue === 'number' ? false : rkValue.divideBy100;
              const xf = typeof rkValue === 'number' ? 0 : (rkValue.xf ?? 0);
              return [...uint16(xf), ...rkNumber(rawValue, divideBy100)];
            }),
          ]);
        }
        if (isBiff8MulRkCell(value)) {
          return record(0x00bd, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...value.mulrk.flatMap((rkValue) => {
              if (isBiff8RawRkValue(rkValue)) return [...uint16(rkValue.xf ?? 0), ...uint32(rkValue.rawRk)];
              const rawValue = typeof rkValue === 'number' ? rkValue : rkValue.value;
              const divideBy100 = typeof rkValue === 'number' ? false : rkValue.divideBy100;
              const xf = typeof rkValue === 'number' ? 0 : (rkValue.xf ?? 0);
              return [...uint16(xf), ...rkNumber(rawValue, divideBy100)];
            }),
            ...uint16(columnIndex + value.mulrk.length - 1),
          ]);
        }
        if (isBiff8RawRkCell(value)) {
          return record(0x027e, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(value.xf ?? 0),
            ...uint32(value.rawRk),
          ]);
        }
        if (isBiff8MalformedRkCell(value)) {
          return record(0x027e, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(value.xf ?? 0)]);
        }
        if (isBiff8RkCell(value)) {
          return record(0x027e, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(value.xf ?? 0),
            ...rkNumber(value.rk, value.divideBy100),
          ]);
        }
        if (isBiff8MalformedNumberCell(value)) {
          return record(0x0203, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(value.xf ?? 0)]);
        }
        if (isBiff8NumberCell(value)) {
          return record(0x0203, [
            ...uint16(rowIndex),
            ...uint16(columnIndex),
            ...uint16(value.xf ?? 0),
            ...float64(value.number),
          ]);
        }
        if (typeof value === 'number') {
          return record(0x0203, [...uint16(rowIndex), ...uint16(columnIndex), ...uint16(0), ...float64(value)]);
        }
        return record(0x00fd, [
          ...uint16(rowIndex),
          ...uint16(columnIndex),
          ...uint16(0),
          ...uint32(stringIndexes.get(`${rowIndex}:${columnIndex}`) ?? 0),
        ]);
      }),
    ),
    ...((options.mergedCells?.length ?? 0) > 0
      ? [
          record(0x00e5, [
            ...uint16(options.mergedCells?.length ?? 0),
            ...(options.mergedCells ?? []).flatMap((range) => [
              ...uint16(range.firstRow),
              ...uint16(range.lastRow),
              ...uint16(range.firstColumn),
              ...uint16(range.lastColumn),
            ]),
          ]),
        ]
      : []),
  ];

  return new Uint8Array(records.flat());
}

function buildBiff8WorkbookWithContinuedSharedStrings(): Uint8Array {
  const firstStrings = ['Name', 'Status', 'Alpha'];
  const continuedStrings = ['Ready'];
  const sstPayload = [
    ...uint32(firstStrings.length + continuedStrings.length),
    ...uint32(firstStrings.length + continuedStrings.length),
    ...firstStrings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ];
  const continuePayload = continuedStrings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]);

  return new Uint8Array(
    [
      record(0x00fc, sstPayload),
      record(0x003c, continuePayload),
      record(0x00fd, [...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0)]),
      record(0x00fd, [...uint16(0), ...uint16(1), ...uint16(0), ...uint32(1)]),
      record(0x00fd, [...uint16(1), ...uint16(0), ...uint16(0), ...uint32(2)]),
      record(0x00fd, [...uint16(1), ...uint16(1), ...uint16(0), ...uint32(3)]),
    ].flat(),
  );
}

function buildBiff8WorkbookWithSplitContinuedSharedString(): Uint8Array {
  const firstStrings = ['Name', 'Status', 'Alpha'];
  const sstPayload = [
    ...uint32(firstStrings.length + 1),
    ...uint32(firstStrings.length + 1),
    ...firstStrings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
    ...uint16('Ready'.length),
    0,
    ...ascii('Re'),
  ];
  const continuePayload = [0, ...ascii('ady')];

  return new Uint8Array(
    [
      record(0x00fc, sstPayload),
      record(0x003c, continuePayload),
      record(0x00fd, [...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0)]),
      record(0x00fd, [...uint16(0), ...uint16(1), ...uint16(0), ...uint32(1)]),
      record(0x00fd, [...uint16(1), ...uint16(0), ...uint16(0), ...uint32(2)]),
      record(0x00fd, [...uint16(1), ...uint16(1), ...uint16(0), ...uint32(3)]),
    ].flat(),
  );
}

function buildBiff8WorkbookWithSplitUtf16SharedStringCodeUnit(): Uint8Array {
  const firstStrings = ['Name', 'Status', 'Alpha'];
  const sstPayload = [
    ...uint32(firstStrings.length + 1),
    ...uint32(firstStrings.length + 1),
    ...firstStrings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
    ...uint16(2),
    1,
    ...uint16(0x004f),
    0x4b,
  ];
  const continuePayload = [1, 0x00];

  return new Uint8Array(
    [
      record(0x00fc, sstPayload),
      record(0x003c, continuePayload),
      record(0x00fd, [...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0)]),
      record(0x00fd, [...uint16(0), ...uint16(1), ...uint16(0), ...uint32(1)]),
      record(0x00fd, [...uint16(1), ...uint16(0), ...uint16(0), ...uint32(2)]),
      record(0x00fd, [...uint16(1), ...uint16(1), ...uint16(0), ...uint32(3)]),
    ].flat(),
  );
}

function buildBiff8WorkbookWithContinuedRichSharedStringFormatting(): Uint8Array {
  const initialStrings = ['Name', 'Status'];
  const laterStrings = ['Alpha', 'Ready'];
  const sstPayload = [
    ...uint32(initialStrings.length + laterStrings.length + 1),
    ...uint32(initialStrings.length + laterStrings.length + 1),
    ...initialStrings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
    ...uint16('Rich'.length),
    0x08,
    ...uint16(1),
    ...ascii('Rich'),
    0,
    0,
  ];
  const continuePayload = [0, 0, 0, ...laterStrings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)])];

  return new Uint8Array(
    [
      record(0x00fc, sstPayload),
      record(0x003c, continuePayload),
      record(0x00fd, [...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0)]),
      record(0x00fd, [...uint16(0), ...uint16(1), ...uint16(0), ...uint32(1)]),
      record(0x00fd, [...uint16(1), ...uint16(0), ...uint16(0), ...uint32(3)]),
      record(0x00fd, [...uint16(1), ...uint16(1), ...uint16(0), ...uint32(4)]),
    ].flat(),
  );
}

function buildBiff8WorkbookWithContinuedFormulaString(): Uint8Array {
  const strings = ['Name', 'Status', 'Alpha'];
  const sstPayload = [
    ...uint32(strings.length),
    ...uint32(strings.length),
    ...strings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ];

  return new Uint8Array(
    [
      record(0x00fc, sstPayload),
      record(0x00fd, [...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0)]),
      record(0x00fd, [...uint16(0), ...uint16(1), ...uint16(0), ...uint32(1)]),
      record(0x00fd, [...uint16(1), ...uint16(0), ...uint16(0), ...uint32(2)]),
      record(0x0006, [
        ...uint16(1),
        ...uint16(1),
        ...uint16(0),
        0,
        0,
        0,
        0,
        0,
        0,
        0xff,
        0xff,
        ...uint16(0),
        ...uint32(0),
        ...uint16(0),
      ]),
      record(0x0207, [...uint16('Ready'.length), 0, ...ascii('Re')]),
      record(0x003c, [0, ...ascii('ady')]),
    ].flat(),
  );
}

function buildBiff8WorkbookWithContinuedInlineLabel(): Uint8Array {
  const strings = ['Name', 'Status', 'Alpha'];
  const sstPayload = [
    ...uint32(strings.length),
    ...uint32(strings.length),
    ...strings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ];

  return new Uint8Array(
    [
      record(0x00fc, sstPayload),
      record(0x00fd, [...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0)]),
      record(0x00fd, [...uint16(0), ...uint16(1), ...uint16(0), ...uint32(1)]),
      record(0x00fd, [...uint16(1), ...uint16(0), ...uint16(0), ...uint32(2)]),
      record(0x0204, [...uint16(1), ...uint16(1), ...uint16(0), ...uint16('Manual'.length), 0, ...ascii('Ma')]),
      record(0x003c, [0, ...ascii('nual')]),
    ].flat(),
  );
}

function buildBiff8WorkbookWithRichInlineString(): Uint8Array {
  const strings = ['Name', 'Status', 'Alpha'];
  const sstPayload = [
    ...uint32(strings.length),
    ...uint32(strings.length),
    ...strings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ];

  return new Uint8Array(
    [
      record(0x00fc, sstPayload),
      record(0x00fd, [...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0)]),
      record(0x00fd, [...uint16(0), ...uint16(1), ...uint16(0), ...uint32(1)]),
      record(0x00fd, [...uint16(1), ...uint16(0), ...uint16(0), ...uint32(2)]),
      record(0x00d6, [
        ...uint16(1),
        ...uint16(1),
        ...uint16(0),
        ...uint16('Manual'.length),
        0x08,
        ...uint16(1),
        ...ascii('Manual'),
        ...uint16(0),
        ...uint16(0),
      ]),
    ].flat(),
  );
}

function buildBiff8WorkbookWithTruncatedRichInlineStringFormatting(): Uint8Array {
  const strings = ['Name', 'Status', 'Alpha'];
  const sstPayload = [
    ...uint32(strings.length),
    ...uint32(strings.length),
    ...strings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ];

  return new Uint8Array(
    [
      record(0x00fc, sstPayload),
      record(0x00fd, [...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0)]),
      record(0x00fd, [...uint16(0), ...uint16(1), ...uint16(0), ...uint32(1)]),
      record(0x00fd, [...uint16(1), ...uint16(0), ...uint16(0), ...uint32(2)]),
      record(0x00d6, [
        ...uint16(1),
        ...uint16(1),
        ...uint16(0),
        ...uint16('Manual'.length),
        0x08,
        ...uint16(1),
        ...ascii('Manual'),
        ...uint16(0),
      ]),
    ].flat(),
  );
}

function buildBiff8WorkbookWithTruncatedRichInlineStringBody(): Uint8Array {
  const strings = ['Name', 'Status', 'Alpha'];
  const sstPayload = [
    ...uint32(strings.length),
    ...uint32(strings.length),
    ...strings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ];

  return new Uint8Array(
    [
      record(0x00fc, sstPayload),
      record(0x00fd, [...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0)]),
      record(0x00fd, [...uint16(0), ...uint16(1), ...uint16(0), ...uint32(1)]),
      record(0x00fd, [...uint16(1), ...uint16(0), ...uint16(0), ...uint32(2)]),
      record(0x00d6, [...uint16(1), ...uint16(1), ...uint16(0), ...uint16('Manual'.length), 0, ...ascii('Man')]),
    ].flat(),
  );
}

function buildBiff8WorkbookWithContinuedCustomDateFormat(): Uint8Array {
  const strings = ['Name', 'Due', 'Alpha'];
  const sstPayload = [
    ...uint32(strings.length),
    ...uint32(strings.length),
    ...strings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ];

  return new Uint8Array(
    [
      record(0x041e, [...uint16(165), ...uint16('yyyy-mm-dd'.length), 0, ...ascii('yyyy-')]),
      record(0x003c, [0, ...ascii('mm-dd')]),
      record(0x00e0, [
        ...uint16(0),
        ...uint16(0),
        ...uint16(0),
        ...uint16(0),
        ...uint32(0),
        ...uint32(0),
        ...uint16(0),
      ]),
      record(0x00e0, [
        ...uint16(0),
        ...uint16(165),
        ...uint16(0),
        ...uint16(0),
        ...uint32(0),
        ...uint32(0),
        ...uint16(0),
      ]),
      record(0x00fc, sstPayload),
      record(0x00fd, [...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0)]),
      record(0x00fd, [...uint16(0), ...uint16(1), ...uint16(0), ...uint32(1)]),
      record(0x00fd, [...uint16(1), ...uint16(0), ...uint16(0), ...uint32(2)]),
      record(0x0203, [...uint16(1), ...uint16(1), ...uint16(1), ...float64(45292)]),
    ].flat(),
  );
}

interface Biff8SheetFixture {
  name: string;
  boundSheetOffset?: number;
  rows: string[][];
}

function buildBiff8WorkbookWithSheets(
  sheets: Biff8SheetFixture[],
  options: { boundSheetOrder?: number[] } = {},
): Uint8Array {
  const strings = sheets.flatMap((sheet) => sheet.rows.flat());
  const stringIndexes = new Map<string, number>();
  strings.forEach((value, index) => stringIndexes.set(value, index));
  const sst = record(0x00fc, [
    ...uint32(strings.length),
    ...uint32(strings.length),
    ...strings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ]);
  const workbookBof = biff8Bof(0x0005);
  const globalsEof = record(0x000a, []);
  const sheetSubstreams = sheets.map((sheet) => [
    ...biff8Bof(0x0010),
    ...sheet.rows.flatMap((row, rowIndex) =>
      row.flatMap((value, columnIndex) =>
        record(0x00fd, [
          ...uint16(rowIndex),
          ...uint16(columnIndex),
          ...uint16(0),
          ...uint32(stringIndexes.get(value) ?? 0),
        ]),
      ),
    ),
    ...record(0x000a, []),
  ]);
  const boundSheetsLength = sheets.reduce((total, sheet) => total + 4 + 8 + sheet.name.length, 0);
  let nextSheetOffset = workbookBof.length + boundSheetsLength + sst.length + globalsEof.length;
  const sheetOffsets = sheetSubstreams.map((sheetSubstream) => {
    const sheetOffset = nextSheetOffset;
    nextSheetOffset += sheetSubstream.length;
    return sheetOffset;
  });
  const boundSheetOrder = options.boundSheetOrder ?? sheets.map((_, index) => index);
  const boundSheets = boundSheetOrder.flatMap((sheetIndex) => {
    const sheet = sheets[sheetIndex];
    const sheetOffset = sheet.boundSheetOffset ?? sheetOffsets[sheetIndex];
    return record(0x0085, [...uint32(sheetOffset), 0, 0, sheet.name.length, 0, ...ascii(sheet.name)]);
  });

  return new Uint8Array([workbookBof, boundSheets, sst, globalsEof, ...sheetSubstreams].flat(2));
}

function buildBiff8WorkbookWithIsolatedSurrogateSheetName(): Uint8Array {
  const sheets = [
    {
      nameCodes: [0x004f, 0xdc00, 0x004b],
      rows: [
        ['Name', 'Amount'],
        ['Alpha', '42'],
      ],
    },
    {
      nameCodes: ascii('Q2'),
      rows: [
        ['Name', 'Amount'],
        ['Beta', '108'],
      ],
    },
  ];
  const strings = sheets.flatMap((sheet) => sheet.rows.flat());
  const stringIndexes = new Map<string, number>();
  strings.forEach((value, index) => stringIndexes.set(value, index));
  const sst = record(0x00fc, [
    ...uint32(strings.length),
    ...uint32(strings.length),
    ...strings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ]);
  const workbookBof = biff8Bof(0x0005);
  const globalsEof = record(0x000a, []);
  const sheetSubstreams = sheets.map((sheet) => [
    ...biff8Bof(0x0010),
    ...sheet.rows.flatMap((row, rowIndex) =>
      row.flatMap((value, columnIndex) =>
        record(0x00fd, [
          ...uint16(rowIndex),
          ...uint16(columnIndex),
          ...uint16(0),
          ...uint32(stringIndexes.get(value) ?? 0),
        ]),
      ),
    ),
    ...record(0x000a, []),
  ]);
  const boundSheetsLength = sheets.reduce((total, sheet) => total + 4 + 8 + sheet.nameCodes.length * 2, 0);
  let nextSheetOffset = workbookBof.length + boundSheetsLength + sst.length + globalsEof.length;
  const boundSheets = sheets.flatMap((sheet, index) => {
    const sheetOffset = nextSheetOffset;
    nextSheetOffset += sheetSubstreams[index].length;
    return record(0x0085, [
      ...uint32(sheetOffset),
      0,
      0,
      sheet.nameCodes.length,
      1,
      ...sheet.nameCodes.flatMap(uint16),
    ]);
  });

  return new Uint8Array([workbookBof, boundSheets, sst, globalsEof, ...sheetSubstreams].flat(2));
}

function buildBiff8WorkbookWithTruncatedSheetName(): Uint8Array {
  const sheets = [
    {
      declaredNameLength: 3,
      name: 'Q',
      rows: [
        ['Name', 'Amount'],
        ['Alpha', '42'],
      ],
    },
    {
      declaredNameLength: 2,
      name: 'Q2',
      rows: [
        ['Name', 'Amount'],
        ['Beta', '108'],
      ],
    },
  ];
  const strings = sheets.flatMap((sheet) => sheet.rows.flat());
  const stringIndexes = new Map<string, number>();
  strings.forEach((value, index) => stringIndexes.set(value, index));
  const sst = record(0x00fc, [
    ...uint32(strings.length),
    ...uint32(strings.length),
    ...strings.flatMap((value) => [...uint16(value.length), 0, ...ascii(value)]),
  ]);
  const workbookBof = biff8Bof(0x0005);
  const globalsEof = record(0x000a, []);
  const sheetSubstreams = sheets.map((sheet) => [
    ...biff8Bof(0x0010),
    ...sheet.rows.flatMap((row, rowIndex) =>
      row.flatMap((value, columnIndex) =>
        record(0x00fd, [
          ...uint16(rowIndex),
          ...uint16(columnIndex),
          ...uint16(0),
          ...uint32(stringIndexes.get(value) ?? 0),
        ]),
      ),
    ),
    ...record(0x000a, []),
  ]);
  const boundSheetsLength = sheets.reduce((total, sheet) => total + 4 + 8 + sheet.name.length, 0);
  let nextSheetOffset = workbookBof.length + boundSheetsLength + sst.length + globalsEof.length;
  const boundSheets = sheets.flatMap((sheet, index) => {
    const sheetOffset = nextSheetOffset;
    nextSheetOffset += sheetSubstreams[index].length;
    return record(0x0085, [...uint32(sheetOffset), 0, 0, sheet.declaredNameLength, 0, ...ascii(sheet.name)]);
  });

  return new Uint8Array([workbookBof, boundSheets, sst, globalsEof, ...sheetSubstreams].flat(2));
}

function biff8Bof(documentType: number): number[] {
  return record(0x0809, [
    ...uint16(0x0600),
    ...uint16(documentType),
    ...uint16(0x0dbb),
    ...uint16(0x07cc),
    ...uint32(0),
    ...uint32(0),
  ]);
}

function buildBiff8WorkbookWithTruncatedBlankRecord(): Uint8Array {
  return new Uint8Array([
    ...biff8Bof(0x0010),
    ...biff8InlineLabelRecord(0, 0, 'Name'),
    ...biff8InlineLabelRecord(0, 1, 'Amount'),
    ...biff8InlineLabelRecord(0, 2, 'Notes'),
    ...biff8InlineLabelRecord(1, 0, 'Alpha'),
    ...record(0x0203, [...uint16(1), ...uint16(1), ...uint16(0), ...float64(42)]),
    ...biff8TruncatedBlankRecord(1, 2, 8),
  ]);
}

function biff8InlineLabelRecord(row: number, column: number, value: string): number[] {
  return record(0x0204, [...uint16(row), ...uint16(column), ...uint16(0), ...uint16(value.length), 0, ...ascii(value)]);
}

function buildBiff8WorkbookWithIsolatedSurrogateInlineLabel(): Uint8Array {
  return new Uint8Array([
    ...biff8Bof(0x0010),
    ...biff8InlineLabelRecord(0, 0, 'Name'),
    ...biff8InlineLabelRecord(0, 1, 'Status'),
    ...biff8InlineLabelRecord(1, 0, 'Alpha'),
    ...biff8Utf16InlineLabelRecord(1, 1, [0x004f, 0xdc00, 0x004b]),
  ]);
}

function biff8Utf16InlineLabelRecord(row: number, column: number, codes: number[]): number[] {
  return record(0x0204, [
    ...uint16(row),
    ...uint16(column),
    ...uint16(0),
    ...uint16(codes.length),
    1,
    ...codes.flatMap(uint16),
  ]);
}

function biff8TruncatedBlankRecord(row: number, column: number, declaredLength: number): number[] {
  return [...uint16(0x0201), ...uint16(declaredLength), ...uint16(row), ...uint16(column), ...uint16(0)];
}

function pptTextHeaderAtom(instance = 0): number[] {
  return pptRecord(0x0f9f, uint32(0), instance);
}

function pptTruncatedTextHeaderAtom(instance: number, declaredLength: number): number[] {
  return [...uint16(instance << 4), ...uint16(0x0f9f), ...uint32(declaredLength), ...uint32(0)];
}

function pptTextBytesAtom(value: string): number[] {
  return pptRecord(0x0fa8, ascii(value));
}

function pptTextBytesAtomBytes(payload: number[]): number[] {
  return pptRecord(0x0fa8, payload);
}

function pptTruncatedTextBytesAtom(value: string, declaredLength: number): number[] {
  return [...uint16(0), ...uint16(0x0fa8), ...uint32(declaredLength), ...ascii(value)];
}

function pptTruncatedTextBytesAtomBytes(payload: number[], declaredLength: number): number[] {
  return [...uint16(0), ...uint16(0x0fa8), ...uint32(declaredLength), ...payload];
}

function pptTruncatedTextCharsAtom(value: string, declaredLength: number): number[] {
  return [...uint16(0), ...uint16(0x0fa0), ...uint32(declaredLength), ...utf16Le(value)];
}

function pptTruncatedUnsupportedAtom(recordType: number, value: string, declaredLength: number): number[] {
  return [...uint16(0), ...uint16(recordType), ...uint32(declaredLength), ...ascii(value)];
}

function pptTextCharsAtomWithDanglingByte(value: string): number[] {
  const payload = [...utf16Le(value), 0xff];
  return [...uint16(0), ...uint16(0x0fa0), ...uint32(payload.length), ...payload];
}

function pptTextCharsAtomWithDanglingHighSurrogate(value: string): number[] {
  const payload = [...utf16Le(value), ...uint16(0xd83d)];
  return [...uint16(0), ...uint16(0x0fa0), ...uint32(payload.length), ...payload];
}

function pptTextCharsAtomWithDanglingLowSurrogate(value: string): number[] {
  const payload = [...utf16Le(value), ...uint16(0xdc00)];
  return [...uint16(0), ...uint16(0x0fa0), ...uint32(payload.length), ...payload];
}

function pptTextCharsAtomWithIsolatedSurrogate(before: string, after: string): number[] {
  const payload = [...utf16Le(before), ...uint16(0xdc00), ...utf16Le(after)];
  return [...uint16(0), ...uint16(0x0fa0), ...uint32(payload.length), ...payload];
}

function pptTextCharsAtomWithControlCodeUnit(before: string, after: string): number[] {
  const payload = [...utf16Le(before), ...uint16(0x0007), ...utf16Le(after)];
  return [...uint16(0), ...uint16(0x0fa0), ...uint32(payload.length), ...payload];
}

function pptTextCharsAtom(value: string): number[] {
  return pptRecord(0x0fa0, utf16Le(value));
}

function pptRecord(recordType: number, payload: number[], instance = 0): number[] {
  return [...uint16(instance << 4), ...uint16(recordType), ...uint32(payload.length), ...payload];
}

function pptContainer(recordType: number, payload: number[]): number[] {
  return [...uint16(0x000f), ...uint16(recordType), ...uint32(payload.length), ...payload];
}

function isBiff8NumberCell(value: Biff8Cell): value is Biff8NumberCell {
  return typeof value === 'object' && value !== null && 'number' in value;
}

function isBiff8MalformedNumberCell(value: Biff8Cell): value is Biff8MalformedNumberCell {
  return typeof value === 'object' && value !== null && 'malformedNumber' in value;
}

function isBiff8RkCell(value: Biff8Cell): value is Biff8RkCell {
  return typeof value === 'object' && value !== null && 'rk' in value;
}

function isBiff8RawRkCell(value: Biff8Cell): value is Biff8RawRkCell {
  return isBiff8RawRkValue(value);
}

function isBiff8MalformedRkCell(value: Biff8Cell): value is Biff8MalformedRkCell {
  return typeof value === 'object' && value !== null && 'malformedRk' in value;
}

function isBiff8RawRkValue(value: unknown): value is Biff8RawRkCell {
  return typeof value === 'object' && value !== null && 'rawRk' in value;
}

function isBiff8MulRkCell(value: Biff8Cell): value is Biff8MulRkCell {
  return typeof value === 'object' && value !== null && 'mulrk' in value;
}

function isBiff8MalformedMulRkCell(value: Biff8Cell): value is Biff8MalformedMulRkCell {
  return typeof value === 'object' && value !== null && 'malformedMulrk' in value;
}

function isBiff8MalformedMulRkMissingLastColumnCell(
  value: Biff8Cell,
): value is Biff8MalformedMulRkMissingLastColumnCell {
  return typeof value === 'object' && value !== null && 'malformedMulrkMissingLastColumn' in value;
}

function isBiff8FormulaCell(value: Biff8Cell): value is Biff8FormulaCell {
  return typeof value === 'object' && value !== null && 'formulaResult' in value;
}

function isBiff8MalformedFormulaCell(value: Biff8Cell): value is Biff8MalformedFormulaCell {
  return typeof value === 'object' && value !== null && 'malformedFormula' in value;
}

function isBiff8FormulaStringCell(value: Biff8Cell): value is Biff8FormulaStringCell {
  return typeof value === 'object' && value !== null && 'formulaStringResult' in value;
}

function isBiff8FormulaBooleanCell(value: Biff8Cell): value is Biff8FormulaBooleanCell {
  return typeof value === 'object' && value !== null && 'formulaBooleanResult' in value;
}

function isBiff8FormulaErrorCell(value: Biff8Cell): value is Biff8FormulaErrorCell {
  return typeof value === 'object' && value !== null && 'formulaErrorResult' in value;
}

function isBiff8FormulaEmptyCell(value: Biff8Cell): value is Biff8FormulaEmptyCell {
  return typeof value === 'object' && value !== null && 'formulaEmptyResult' in value;
}

function isBiff8FormulaMissingStringCell(value: Biff8Cell): value is Biff8FormulaMissingStringCell {
  return typeof value === 'object' && value !== null && 'formulaMissingStringResult' in value;
}

function isBiff8FormulaMalformedStringCell(value: Biff8Cell): value is Biff8FormulaMalformedStringCell {
  return typeof value === 'object' && value !== null && 'formulaMalformedStringResult' in value;
}

function isBiff8MissingSharedStringCell(value: Biff8Cell): value is Biff8MissingSharedStringCell {
  return typeof value === 'object' && value !== null && 'missingSharedString' in value;
}

function isBiff8MalformedSharedStringCell(value: Biff8Cell): value is Biff8MalformedSharedStringCell {
  return typeof value === 'object' && value !== null && 'malformedSharedString' in value;
}

function isBiff8InlineLabelCell(value: Biff8Cell): value is Biff8InlineLabelCell {
  return typeof value === 'object' && value !== null && 'label' in value;
}

function isBiff8MissingInlineLabelCell(value: Biff8Cell): value is Biff8MissingInlineLabelCell {
  return typeof value === 'object' && value !== null && 'missingLabel' in value;
}

function isBiff8MalformedInlineLabelHeaderCell(value: Biff8Cell): value is Biff8MalformedInlineLabelHeaderCell {
  return typeof value === 'object' && value !== null && 'malformedLabelHeader' in value;
}

function isBiff8BooleanCell(value: Biff8Cell): value is Biff8BooleanCell {
  return typeof value === 'object' && value !== null && 'bool' in value;
}

function isBiff8BoolErrorCell(value: Biff8Cell): value is Biff8BoolErrorCell {
  return typeof value === 'object' && value !== null && 'boolError' in value;
}

function isBiff8MalformedBoolErrorCell(value: Biff8Cell): value is Biff8MalformedBoolErrorCell {
  return typeof value === 'object' && value !== null && 'malformedBoolError' in value;
}

function isBiff8BlankCell(value: Biff8Cell): value is Biff8BlankCell {
  return typeof value === 'object' && value !== null && 'blank' in value;
}

function isBiff8MulBlankCell(value: Biff8Cell): value is Biff8MulBlankCell {
  return typeof value === 'object' && value !== null && 'mulblank' in value;
}

function isBiff8MalformedMulBlankCell(value: Biff8Cell): value is Biff8MalformedMulBlankCell {
  return typeof value === 'object' && value !== null && 'malformedMulblank' in value;
}

function isBiff8MalformedMulBlankMissingLastColumnCell(
  value: Biff8Cell,
): value is Biff8MalformedMulBlankMissingLastColumnCell {
  return typeof value === 'object' && value !== null && 'malformedMulblankMissingLastColumn' in value;
}

function isBiff8MalformedMulBlankMissingLastColumnRangeCell(
  value: Biff8Cell,
): value is Biff8MalformedMulBlankMissingLastColumnRangeCell {
  return typeof value === 'object' && value !== null && 'malformedMulblankMissingLastColumnCount' in value;
}

function record(id: number, payload: number[]): number[] {
  return [...uint16(id), ...uint16(payload.length), ...payload];
}

function ascii(value: string): number[] {
  return Array.from(value, (char) => char.charCodeAt(0));
}

function biff8FixtureUnicodeString(value: string): number[] {
  const isCompressed = Array.from(value).every((char) => char.charCodeAt(0) <= 0xff);
  return [...uint16(value.length), isCompressed ? 0 : 1, ...(isCompressed ? ascii(value) : utf16Le(value))];
}

function utf16Le(value: string): number[] {
  return Array.from(value).flatMap((char) => uint16(char.charCodeAt(0)));
}

function uint16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function uint32(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function rkNumber(value: number, divideBy100 = false): number[] {
  const integerValue = Math.round(value * (divideBy100 ? 100 : 1));
  return uint32(((integerValue << 2) | 0x02 | (divideBy100 ? 0x01 : 0)) >>> 0);
}

function float64(value: number): number[] {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, true);
  return Array.from(bytes);
}
