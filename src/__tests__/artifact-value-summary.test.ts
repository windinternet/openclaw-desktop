import { describe, expect, it } from 'vitest';
import { buildArtifactValueSummary, inferArtifactExternalFormat } from '../lib/artifact-value-summary';

describe('artifact value summaries', () => {
  it('infers Office and PDF formats from filenames and MIME types', () => {
    expect(
      inferArtifactExternalFormat({
        type: 'file',
        fileName: 'roadmap.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
    ).toBe('powerpoint');
    expect(inferArtifactExternalFormat({ type: 'file', fileName: 'budget.xlsx' })).toBe('excel');
    expect(inferArtifactExternalFormat({ type: 'file', fileName: 'brief.docx' })).toBe('word');
    expect(inferArtifactExternalFormat({ type: 'file', fileName: 'contract.pdf' })).toBe('pdf');
  });

  it('builds a concise reusable value summary for file and link artifacts', () => {
    expect(
      buildArtifactValueSummary({
        type: 'file',
        fileName: 'roadmap.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileSize: 4096,
      }),
    ).toBe('PowerPoint · roadmap.pptx · 4 KB');

    expect(
      buildArtifactValueSummary({
        type: 'link',
        url: 'https://openclaw.ai/docs/getting-started',
      }),
    ).toBe('Link · openclaw.ai');
  });
});
