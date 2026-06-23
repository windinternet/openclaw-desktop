import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import {
  extractMarkdownLinks,
  findBacklinks,
  loadKnowledgeSnapshot,
  searchKnowledge,
} from '../lib/repository-knowledge';

describe('repository knowledge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads sources, wiki files, index, and log from a ready repository binding', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/note.md', name: 'note.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') return [{ path: 'wiki/index.md', name: 'index.md', size: 40, updatedAt: 2 }];
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') return '# Wiki Index';
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { listMarkdown, readText },
      },
    });

    const snapshot = await loadKnowledgeSnapshot({
      ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      status: 'repo_ready',
    });

    expect(snapshot.sources).toHaveLength(1);
    expect(snapshot.wiki).toHaveLength(1);
    expect(snapshot.indexMarkdown).toBe('# Wiki Index');
    expect(snapshot.logMarkdown).toBe('# Wiki Log');
    expect(listMarkdown).toHaveBeenCalledWith('/repo', 'sources');
    expect(listMarkdown).toHaveBeenCalledWith('/repo', 'wiki');
  });

  it('searches only sources and wiki paths for knowledge queries', async () => {
    const search = vi.fn(async () => [
      { path: 'wiki/index.md', line: 1, snippet: 'Agentic Repository' },
    ]);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { search },
      },
    });

    const results = await searchKnowledge(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      'Agentic',
    );

    expect(results).toEqual([{ path: 'wiki/index.md', line: 1, snippet: 'Agentic Repository' }]);
    expect(search).toHaveBeenCalledWith('/repo', 'Agentic', ['sources', 'wiki']);
  });

  it('extracts markdown links and finds backlinks', () => {
    expect(extractMarkdownLinks('See [Topic](topics/topic.md) and [External](https://example.com).')).toEqual([
      'topics/topic.md',
    ]);

    expect(findBacklinks([
      { path: 'wiki/index.md', content: '[Topic](topics/topic.md)' },
      { path: 'wiki/other.md', content: '[Other](other.md)' },
    ], 'topics/topic.md')).toEqual(['wiki/index.md']);
  });
});

