import { describe, expect, it } from 'vitest';
import { recordArtifactReuseEvent } from '../lib/artifact-reuse-record';
import type { ArtifactMeta } from '../lib/artifact-types';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_script',
    title: '部署脚本',
    icon: '📎',
    type: 'file',
    source: { type: 'action_run', id: 'run_create' },
    tags: ['deploy'],
    currentVersion: 3,
    status: 'draft',
    createdAt: 1,
    updatedAt: 2,
    reuseKind: 'script',
    ...overrides,
  };
}

describe('artifact reuse records', () => {
  it('appends reusable artifact usage records with source context and artifact version', () => {
    const updated = recordArtifactReuseEvent(createArtifact(), {
      id: 'reuse_1',
      context: 'action_run',
      sourceId: 'run_use',
      sourceName: '部署生产',
      purpose: '复用部署脚本生成发布步骤',
      status: 'succeeded',
      resultSummary: '生成 3 个发布命令',
      usedAt: 20,
    });

    expect(updated.updatedAt).toBe(20);
    expect(updated.reuseEvents).toEqual([
      {
        id: 'reuse_1',
        context: 'action_run',
        sourceId: 'run_use',
        sourceName: '部署生产',
        purpose: '复用部署脚本生成发布步骤',
        status: 'succeeded',
        resultSummary: '生成 3 个发布命令',
        artifactVersion: 3,
        usedAt: 20,
      },
    ]);
  });
});
