import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactContentFacts, resolveArtifactContentFactsEligibility } from '../lib/artifact-content-facts';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_file',
    title: '路线图 PPT',
    icon: '📎',
    type: 'file',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 2,
    fileName: 'roadmap.pptx',
    filePath: '/user-data/storage/artifacts/art_file/files/roadmap.pptx',
    originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
    fileSize: 4096,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    externalFormat: 'powerpoint',
    contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
    ...overrides,
  };
}

describe('artifact content facts', () => {
  it('builds durable file facts for imported non-text artifacts', () => {
    const facts = buildArtifactContentFacts(
      createArtifact(),
      {
        fileSize: 4096,
        bytesRead: 4096,
        sha256: 'a'.repeat(64),
        signatureHex: '504b0304140000000800',
      },
      90,
    );

    expect(facts).toEqual({
      extractedAt: 90,
      status: 'recorded',
      format: 'powerpoint',
      sourceKind: 'imported_file',
      summary: 'PowerPoint facts · roadmap.pptx · 4 KB · sha256 aaaaaaaaaaaa',
      fileName: 'roadmap.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileSize: 4096,
      bytesRead: 4096,
      sha256: 'a'.repeat(64),
      signatureHex: '504b0304140000000800',
      imageDimensions: undefined,
    });
  });

  it('records image dimensions when imported media facts include them', () => {
    const facts = buildArtifactContentFacts(
      createArtifact({
        type: 'image',
        fileName: 'cover.png',
        mimeType: 'image/png',
        externalFormat: 'image',
        contentSummary: 'Image · cover.png · 8 KB',
      }),
      {
        fileSize: 8192,
        bytesRead: 8192,
        sha256: 'b'.repeat(64),
        signatureHex: '89504e470d0a1a0a',
        imageDimensions: { width: 1280, height: 720, kind: 'png' },
      },
      100,
    );

    expect(facts.summary).toBe('Image facts · cover.png · 1280x720 · 8 KB · sha256 bbbbbbbbbbbb');
    expect(facts.imageDimensions).toEqual({ width: 1280, height: 720, kind: 'png' });
  });

  it('records PDF version and page count when imported facts include them', () => {
    const facts = buildArtifactContentFacts(
      createArtifact({
        fileName: 'brief.pdf',
        mimeType: 'application/pdf',
        externalFormat: 'pdf',
        contentSummary: 'PDF · brief.pdf · 4 KB',
      }),
      {
        fileSize: 4096,
        bytesRead: 4096,
        sha256: 'c'.repeat(64),
        signatureHex: '255044462d312e37',
        pdfInfo: { version: '1.7', pageCount: 12 },
      },
      110,
    );

    expect(facts.summary).toBe('PDF facts · brief.pdf · PDF 1.7 · 12 pages · 4 KB · sha256 cccccccccccc');
    expect(facts.pdfInfo).toEqual({ version: '1.7', pageCount: 12 });
  });

  it('allows only imported non-text file copies to produce content facts', () => {
    expect(resolveArtifactContentFactsEligibility(createArtifact())).toEqual({
      eligible: true,
      format: 'powerpoint',
    });

    expect(
      resolveArtifactContentFactsEligibility(
        createArtifact({
          externalFormat: 'text',
          fileName: 'plan.md',
          mimeType: 'text/markdown',
        }),
      ),
    ).toEqual({
      eligible: false,
      format: 'text',
      reason: 'text-extractable-format',
    });

    expect(
      resolveArtifactContentFactsEligibility(
        createArtifact({
          originalFilePath: undefined,
        }),
      ),
    ).toEqual({
      eligible: false,
      format: 'powerpoint',
      reason: 'not-imported-file',
    });
  });
});
