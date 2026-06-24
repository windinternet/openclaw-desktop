import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import {
  classifyKnowledgeSearchResult,
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

  it('loads recent files, backlinks, and related work/output links', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/notes/raw.md', name: 'raw.md', size: 20, updatedAt: 3 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/index.md', name: 'index.md', size: 40, updatedAt: 2 },
          { path: 'wiki/topics/agentic.md', name: 'agentic.md', size: 50, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') return '# Wiki Index\n[Agentic](topics/agentic.md)';
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/topics/agentic.md') return [
        '# Agentic',
        '[Matter](../../work/active/matter.md)',
        '[Output](../../outputs/reports/report.md)',
      ].join('\n');
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

    expect(snapshot.recentFiles.map((file) => file.path)).toEqual([
      'wiki/topics/agentic.md',
      'sources/notes/raw.md',
      'wiki/index.md',
    ]);
    expect(snapshot.backlinks).toEqual([
      { sourcePath: 'wiki/index.md', targetPath: 'wiki/topics/agentic.md' },
    ]);
    expect(snapshot.relatedRepositoryLinks).toEqual([
      { sourcePath: 'wiki/topics/agentic.md', targetPath: 'work/active/matter.md', type: 'work' },
      { sourcePath: 'wiki/topics/agentic.md', targetPath: 'outputs/reports/report.md', type: 'output' },
    ]);
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

    expect(results).toEqual([{ path: 'wiki/index.md', line: 1, snippet: 'Agentic Repository', sourceType: 'wiki' }]);
    expect(search).toHaveBeenCalledWith('/repo', 'Agentic', ['sources', 'wiki']);
  });

  it('classifies knowledge search results by repository area', () => {
    const binding = createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' });

    expect(classifyKnowledgeSearchResult(binding, { path: 'sources/notes/raw.md', line: 1, snippet: 'raw' }).sourceType).toBe('sources');
    expect(classifyKnowledgeSearchResult(binding, { path: 'wiki/topics/agentic.md', line: 1, snippet: 'wiki' }).sourceType).toBe('wiki');
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

  it('renders recent updates and relationship sections in the knowledge panel', () => {
    const source = readFileSync('src/components/KnowledgeRepositoryPanel.tsx', 'utf8');

    expect(source).toContain('snapshot?.recentFiles');
    expect(source).toContain('snapshot?.backlinks');
    expect(source).toContain('snapshot?.relatedRepositoryLinks');
    expect(source).toContain("t('knowledge.recentUpdates')");
    expect(source).toContain("t('knowledge.relationships')");
    expect(source).toContain("t('common.failed')");
  });
});
