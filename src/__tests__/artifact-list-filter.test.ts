import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { filterArtifactList } from '../lib/artifact-list-filter';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_1',
    title: '产物',
    icon: '📦',
    type: 'file',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('artifact list filtering', () => {
  it('filters by reuse kind before sorting recent artifacts', () => {
    const filtered = filterArtifactList(
      [
        createArtifact({ id: 'art_template', title: '复盘模板', reuseKind: 'template', updatedAt: 20 }),
        createArtifact({ id: 'art_script_old', title: '旧脚本', reuseKind: 'script', updatedAt: 10 }),
        createArtifact({ id: 'art_script_new', title: '新脚本', reuseKind: 'script', updatedAt: 30 }),
        createArtifact({ id: 'art_plain', title: '普通文件', updatedAt: 40 }),
      ],
      {
        typeFilter: 'all',
        reuseKindFilter: 'script',
        search: '',
      },
    );

    expect(filtered.map((artifact) => artifact.id)).toEqual(['art_script_new', 'art_script_old']);
  });

  it('combines type, reuse kind, and ordinary Chinese search filters', () => {
    const filtered = filterArtifactList(
      [
        createArtifact({
          id: 'art_script',
          title: '部署检查',
          type: 'code',
          reuseKind: 'script',
          contentSummary: '发布前检查命令',
          updatedAt: 20,
        }),
        createArtifact({
          id: 'art_workflow',
          title: '部署流程',
          type: 'code',
          reuseKind: 'workflow',
          updatedAt: 30,
        }),
        createArtifact({
          id: 'art_template',
          title: '部署模板',
          type: 'document',
          reuseKind: 'template',
          updatedAt: 40,
        }),
      ],
      {
        typeFilter: 'code',
        reuseKindFilter: 'script',
        search: '可复用的脚本',
      },
    );

    expect(filtered.map((artifact) => artifact.id)).toEqual(['art_script']);
  });
});
