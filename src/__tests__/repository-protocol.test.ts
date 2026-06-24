import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import { loadRepositoryProtocolSnapshot } from '../lib/repository-protocol';

describe('repository protocol snapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads AGENTS, BOOTSTRAP, schemas, and path mappings from a ready repository', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => `content:${relativePath}`);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          readText,
        },
      },
    });

    const snapshot = await loadRepositoryProtocolSnapshot({
      ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      status: 'repo_ready',
    });

    expect(snapshot.documents.map((item) => item.path)).toEqual([
      'AGENTS.md',
      'BOOTSTRAP.md',
      'schemas/work.schema.md',
      'schemas/wiki.schema.md',
      'schemas/source.schema.md',
      'schemas/run.schema.md',
      'schemas/output.schema.md',
    ]);
    expect(snapshot.documents[0]).toMatchObject({
      title: 'AGENTS.md',
      content: 'content:AGENTS.md',
    });
    expect(snapshot.pathMappings).toContainEqual({ label: '成果', path: 'outputs' });
    expect(readText).toHaveBeenCalledWith('/repo', 'schemas/output.schema.md');
  });
});
