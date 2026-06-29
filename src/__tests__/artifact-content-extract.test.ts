import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactContentExtract, resolveArtifactContentExtractEligibility } from '../lib/artifact-content-extract';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_text',
    title: '推进计划',
    icon: '📎',
    type: 'file',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 2,
    fileName: 'plan.md',
    filePath: '/user-data/storage/artifacts/art_text/files/plan.md',
    originalFilePath: '/Users/deepin/Documents/plan.md',
    fileSize: 128,
    mimeType: 'text/markdown',
    externalFormat: 'text',
    contentSummary: 'Text · plan.md · 128 B',
    ...overrides,
  };
}

describe('artifact content extract', () => {
  it('builds durable text extract facts from imported text artifact content', () => {
    const rawText = '# 推进计划\r\n\r\nShip the content extraction slice.\n\nNext step.';
    const normalizedText = '# 推进计划\n\nShip the content extraction slice.\n\nNext step.';

    const extract = buildArtifactContentExtract(
      createArtifact(),
      {
        text: rawText,
        bytesRead: 72,
        truncated: false,
      },
      50,
    );

    expect(extract).toEqual({
      extractedAt: 50,
      status: 'extracted',
      format: 'text',
      sourceKind: 'imported_file',
      fileName: 'plan.md',
      mimeType: 'text/markdown',
      bytesRead: 72,
      textLength: normalizedText.length,
      truncated: false,
      snippet: normalizedText,
      summary: expect.stringContaining('plan.md'),
    });
  });

  it('allows only imported text-like artifact copies to be extracted', () => {
    expect(resolveArtifactContentExtractEligibility(createArtifact())).toEqual({
      eligible: true,
      format: 'text',
    });

    expect(
      resolveArtifactContentExtractEligibility(
        createArtifact({
          externalFormat: 'pdf',
          fileName: 'brief.pdf',
          mimeType: 'application/pdf',
        }),
      ),
    ).toEqual({
      eligible: true,
      format: 'pdf',
    });

    expect(
      resolveArtifactContentExtractEligibility(
        createArtifact({
          externalFormat: 'powerpoint',
          fileName: 'roadmap.pptx',
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }),
      ),
    ).toEqual({
      eligible: true,
      format: 'powerpoint',
    });

    expect(
      resolveArtifactContentExtractEligibility(
        createArtifact({
          externalFormat: 'audio',
          fileName: 'meeting.mp3',
          mimeType: 'audio/mpeg',
        }),
      ),
    ).toEqual({
      eligible: false,
      format: 'audio',
      reason: 'unsupported-format',
    });

    expect(
      resolveArtifactContentExtractEligibility(
        createArtifact({
          originalFilePath: undefined,
        }),
      ),
    ).toEqual({
      eligible: false,
      format: 'text',
      reason: 'not-imported-file',
    });
  });

  it('labels imported PDF extracts as best-effort PDF text', () => {
    const text = 'Quarterly roadmap and delivery risks.';
    const extract = buildArtifactContentExtract(
      createArtifact({
        externalFormat: 'pdf',
        fileName: 'brief.pdf',
        mimeType: 'application/pdf',
      }),
      {
        text,
        bytesRead: 4096,
        truncated: false,
      },
      60,
    );

    expect(extract).toEqual(
      expect.objectContaining({
        format: 'pdf',
        fileName: 'brief.pdf',
        mimeType: 'application/pdf',
        summary: `PDF text extract · brief.pdf · ${text.length} chars`,
        snippet: text,
      }),
    );
  });

  it('labels imported Office extracts by external format', () => {
    const text = 'Quarterly Roadmap Delivery risks';
    const extract = buildArtifactContentExtract(
      createArtifact({
        externalFormat: 'powerpoint',
        fileName: 'roadmap.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
      {
        text,
        bytesRead: 8192,
        truncated: false,
      },
      70,
    );

    expect(extract).toEqual(
      expect.objectContaining({
        format: 'powerpoint',
        fileName: 'roadmap.pptx',
        summary: `PowerPoint text extract · roadmap.pptx · ${text.length} chars`,
        snippet: text,
      }),
    );
  });
});
