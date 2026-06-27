import { beforeEach, describe, expect, it, vi } from 'vitest';
import { artifactService } from '../lib/artifact-service';
import { artifactPersistence } from '../lib/artifact-persistence';
import { buildArtifactVersionHistory, nextArtifactVersionHistory } from '../lib/artifact-version-history';
import type { ArtifactMeta } from '../lib/artifact-types';

vi.mock('../lib/artifact-persistence', () => ({
  artifactPersistence: {
    saveMeta: vi.fn(),
    saveHtml: vi.fn(),
    loadMeta: vi.fn(),
    loadHtml: vi.fn(),
    list: vi.fn(),
    updateIndex: vi.fn(),
    importFile: vi.fn(),
  },
}));

const mockedPersistence = vi.mocked(artifactPersistence);

function createMeta(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_1',
    title: 'Report',
    icon: 'R',
    type: 'report',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 10,
    updatedAt: 10,
    ...overrides,
  };
}

describe('artifact version history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPersistence.list.mockResolvedValue([]);
    mockedPersistence.updateIndex.mockResolvedValue(undefined);
    mockedPersistence.saveMeta.mockResolvedValue(undefined);
    mockedPersistence.saveHtml.mockResolvedValue(undefined);
    mockedPersistence.loadHtml.mockResolvedValue('<!doctype html><html><body>v1</body></html>');
  });

  it('builds fallback history for older artifacts that only have currentVersion', () => {
    expect(buildArtifactVersionHistory(createMeta({ currentVersion: 3 }))).toEqual([
      { version: 1, label: 'Initial version', createdBy: 'user', createdAt: 10 },
      { version: 2, label: 'Version 2', createdBy: 'user', createdAt: 10 },
      { version: 3, label: 'Version 3', createdBy: 'user', createdAt: 10 },
    ]);
  });

  it('appends a new version entry without losing existing history', () => {
    expect(
      nextArtifactVersionHistory(
        createMeta({
          currentVersion: 2,
          versions: [{ version: 1, label: 'Initial version', createdBy: 'ai', createdAt: 10 }],
        }),
        { version: 2, label: 'AI append', createdBy: 'ai', createdAt: 20 },
      ),
    ).toEqual([
      { version: 1, label: 'Initial version', createdBy: 'ai', createdAt: 10 },
      { version: 2, label: 'AI append', createdBy: 'ai', createdAt: 20 },
    ]);
  });

  it('records version metadata when generating and appending HTML artifacts', async () => {
    const generated = await artifactService.generate({
      title: 'Version report',
      type: 'report',
      html: '<!doctype html><html><body>v1</body></html>',
      source: { type: 'action_run', id: 'run_1' },
    });

    expect(generated.versions).toEqual([
      expect.objectContaining({ version: 1, label: 'Initial version', createdBy: 'ai' }),
    ]);

    const meta = generated;
    mockedPersistence.loadMeta.mockResolvedValue(meta);
    mockedPersistence.list.mockResolvedValue([meta]);

    await artifactService.append('art_1', '<section>v2</section>');

    const savedMeta = mockedPersistence.saveMeta.mock.calls.at(-1)?.[1];
    expect(savedMeta?.currentVersion).toBe(2);
    expect(savedMeta?.versions).toEqual([
      expect.objectContaining({ version: 1, label: 'Initial version', createdBy: 'ai' }),
      expect.objectContaining({ version: 2, label: 'Appended HTML update', createdBy: 'ai' }),
    ]);
  });
});
