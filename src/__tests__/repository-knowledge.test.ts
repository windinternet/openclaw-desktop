import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import {
  buildKnowledgeRepositoryMappingPrompt,
  buildKnowledgeRewritePrompt,
  classifyKnowledgeSearchResult,
  extractMarkdownLinks,
  findBacklinks,
  loadKnowledgeSnapshot,
  parseKnowledgeRepositoryMappingResponse,
  parseKnowledgeIndexEntries,
  readKnowledgeDocument,
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

  it('parses wiki index links into navigable knowledge entries', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 3 }];
      if (directory === 'wiki') return [{ path: 'wiki/topics/agentic.md', name: 'agentic.md', size: 50, updatedAt: 5 }];
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '| 条目 | 摘要 | 来源 |',
          '|---|---|---|',
          '| [Agentic Repository](topics/agentic.md) | Repository is the working memory. | `sources/raw.md` |',
          '- [Raw Source](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/topics/agentic.md') return '# Agentic Repository';
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

    expect(snapshot.indexEntries).toEqual([
      {
        title: 'Agentic Repository',
        path: 'wiki/topics/agentic.md',
        kind: 'wiki',
        summary: 'Repository is the working memory.',
      },
      {
        title: 'Raw Source',
        path: 'sources/raw.md',
        kind: 'source',
        summary: '',
      },
    ]);
  });

  it('does not duplicate nested sources as wiki pages for mapped repositories', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === '30-knowledge/sources') return [{ path: '30-knowledge/sources/raw.md', name: 'raw.md', size: 20, updatedAt: 3 }];
      if (directory === '30-knowledge') {
        return [
          { path: '30-knowledge/index.md', name: 'index.md', size: 50, updatedAt: 5 },
          { path: '30-knowledge/wiki/topic.md', name: 'topic.md', size: 60, updatedAt: 6 },
          { path: '30-knowledge/sources/raw.md', name: 'raw.md', size: 20, updatedAt: 3 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === '30-knowledge/index.md') return '# Knowledge Index';
      if (relativePath === '30-knowledge/log.md') return '# Knowledge Log';
      return '# Topic';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { listMarkdown, readText },
      },
    });

    const snapshot = await loadKnowledgeSnapshot({
      ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      knowledge: {
        sourceRoot: '30-knowledge/sources',
        wikiRoot: '30-knowledge',
        indexPath: '30-knowledge/index.md',
        logPath: '30-knowledge/log.md',
        mappingSource: 'fallback',
      },
      status: 'repo_ready',
    });

    expect(snapshot.sources.map((file) => file.path)).toEqual(['30-knowledge/sources/raw.md']);
    expect(snapshot.wiki.map((file) => file.path)).toEqual(['30-knowledge/index.md', '30-knowledge/wiki/topic.md']);
  });

  it('reads knowledge documents with title and source type', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/topics/agentic.md') return '# Agentic Repository\n\nReusable knowledge.';
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText },
      },
    });

    const document = await readKnowledgeDocument(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      'wiki/topics/agentic.md',
    );

    expect(document).toEqual({
      path: 'wiki/topics/agentic.md',
      title: 'Agentic Repository',
      content: '# Agentic Repository\n\nReusable knowledge.',
      sourceType: 'wiki',
    });
    expect(readText).toHaveBeenCalledWith('/repo', 'wiki/topics/agentic.md');
  });

  it('builds an approval-first prompt for automatic knowledge rewriting', () => {
    const prompt = buildKnowledgeRewritePrompt({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      intent: 'digest-source',
      sourcePath: 'sources/raw.md',
      selectedPath: 'sources/raw.md',
    });

    expect(prompt).toContain('desktop.repository.read');
    expect(prompt).toContain('desktop.repository.write');
    expect(prompt).toContain('sources/raw.md');
    expect(prompt).toContain('wiki/index.md');
    expect(prompt).toContain('wiki/log.md');
    expect(prompt).toContain('approval_required');
    expect(prompt).toContain('写入或改写任何仓库文件前');
  });

  it('builds a binding-time semantic mapping prompt for LLM Wiki repositories', () => {
    const prompt = buildKnowledgeRepositoryMappingPrompt({
      repoPath: '/repo',
      tree: ['AGENTS.md', 'README.md', '30-knowledge/index.md', '30-knowledge/wiki/topic.md', '30-knowledge/sources/raw.md'],
      excerpts: [
        { path: 'AGENTS.md', content: 'sources 是事实源，wiki 是智能体维护的知识层。' },
      ],
    });

    expect(prompt).toContain('Karpathy LLM Wiki');
    expect(prompt).toContain('sourceRoot');
    expect(prompt).toContain('wikiRoot');
    expect(prompt).toContain('indexPath');
    expect(prompt).toContain('logPath');
    expect(prompt).toContain('不要输出 work/plans/runs/outputs');
    expect(prompt).toContain('```ai-action');
  });

  it('parses binding-time semantic mapping responses into agent mappings', () => {
    const parsed = parseKnowledgeRepositoryMappingResponse([
      '```ai-action',
      JSON.stringify({
        version: 1,
        kind: 'completed',
        summary: '已识别知识库映射',
        result: {
          isKnowledgeRepository: true,
          confidence: 'high',
          mapping: {
            sourceRoot: '30-knowledge/sources',
            wikiRoot: '30-knowledge/wiki',
            indexPath: '30-knowledge/index.md',
            logPath: '30-knowledge/log.md',
            schemaPath: 'AGENTS.md',
          },
        },
      }),
      '```',
    ].join('\n'));

    expect(parsed).toEqual({
      isKnowledgeRepository: true,
      confidence: 'high',
      mapping: {
        sourceRoot: '30-knowledge/sources',
        wikiRoot: '30-knowledge/wiki',
        indexPath: '30-knowledge/index.md',
        logPath: '30-knowledge/log.md',
        schemaPath: 'AGENTS.md',
        confidence: 'high',
        mappingSource: 'agent',
      },
    });
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

  it('parses table and list index entries without duplicates', () => {
    expect(parseKnowledgeIndexEntries({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      indexPath: 'wiki/index.md',
      markdown: [
        '| 条目 | 摘要 | 来源 |',
        '|---|---|---|',
        '| [Topic](topics/topic.md) | Summary | Source |',
        '- [Topic](topics/topic.md)',
        '- [Raw](../sources/raw.md)',
      ].join('\n'),
    })).toEqual([
      { title: 'Topic', path: 'wiki/topics/topic.md', kind: 'wiki', summary: 'Summary' },
      { title: 'Raw', path: 'sources/raw.md', kind: 'source', summary: '' },
    ]);
  });

  it('renders recent updates and relationship sections in the knowledge panel', () => {
    const source = readFileSync('src/components/KnowledgeRepositoryPanel.tsx', 'utf8');

    expect(source).toContain('snapshot?.recentFiles');
    expect(source).toContain('snapshot?.backlinks');
    expect(source).toContain('snapshot?.relatedRepositoryLinks');
    expect(source).toContain("t('knowledge.recentUpdates')");
    expect(source).toContain("t('knowledge.relationships')");
    expect(source).toContain("t('common.failed')");
    expect(source).toContain('readKnowledgeDocument');
    expect(source).toContain('loadKnowledgeDocumentHistory');
    expect(source).toContain("t('knowledge.gitHistory')");
    expect(source).toContain('buildKnowledgeRewritePrompt');
    expect(source).toContain("createAiActionRun({");
  });
});
