import { describe, expect, it } from 'vitest';
import { recordArtifactAuthDecision } from '../lib/artifact-runtime-auth';
import type { ArtifactMeta } from '../lib/artifact-types';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_1',
    title: '交互报告',
    icon: '📊',
    type: 'report',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('artifact runtime auth records', () => {
  it('appends runtime authorization decisions to artifact metadata', () => {
    const updated = recordArtifactAuthDecision(createArtifact(), {
      id: 'auth_1',
      capability: 'readFile',
      detail: '/Users/deepin/report.csv',
      granted: true,
      level: 'artifact',
      requestedAt: 10,
      decidedAt: 20,
    });

    expect(updated.updatedAt).toBe(20);
    expect(updated.authEvents).toEqual([
      {
        id: 'auth_1',
        capability: 'readFile',
        detail: '/Users/deepin/report.csv',
        granted: true,
        level: 'artifact',
        requestedAt: 10,
        decidedAt: 20,
      },
    ]);
  });
});
