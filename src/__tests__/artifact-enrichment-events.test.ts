import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { recordArtifactEnrichmentEvent } from '../lib/artifact-enrichment-events';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_file',
    title: '路线图 PDF',
    icon: '📎',
    type: 'file',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 2,
    fileName: 'brief.pdf',
    externalFormat: 'pdf',
    ...overrides,
  };
}

describe('artifact enrichment events', () => {
  it('records a successful enrichment attempt as durable artifact metadata', () => {
    const next = recordArtifactEnrichmentEvent(createArtifact(), {
      kind: 'content_extract',
      status: 'succeeded',
      format: 'pdf',
      attemptedAt: 80,
      resultSummary: 'PDF text extract · brief.pdf · 37 chars',
    });

    expect(next.enrichmentEvents).toEqual([
      {
        id: 'enrich_28_1',
        kind: 'content_extract',
        status: 'succeeded',
        artifactVersion: 1,
        format: 'pdf',
        attemptedAt: 80,
        resultSummary: 'PDF text extract · brief.pdf · 37 chars',
      },
    ]);
    expect(next.updatedAt).toBe(80);
  });

  it('appends failed enrichment attempts without losing earlier events', () => {
    const next = recordArtifactEnrichmentEvent(
      createArtifact({
        enrichmentEvents: [
          {
            id: 'enrich_1',
            kind: 'content_facts',
            status: 'succeeded',
            artifactVersion: 1,
            format: 'pdf',
            attemptedAt: 50,
            resultSummary: 'PDF facts · brief.pdf',
          },
        ],
      }),
      {
        kind: 'thumbnail',
        status: 'failed',
        format: 'image',
        attemptedAt: 90,
        error: 'invalid image thumbnail data',
      },
    );

    expect(next.enrichmentEvents).toHaveLength(2);
    expect(next.enrichmentEvents?.[1]).toEqual(
      expect.objectContaining({
        id: 'enrich_2i_2',
        kind: 'thumbnail',
        status: 'failed',
        artifactVersion: 1,
        format: 'image',
        attemptedAt: 90,
        error: 'invalid image thumbnail data',
      }),
    );
  });
});
