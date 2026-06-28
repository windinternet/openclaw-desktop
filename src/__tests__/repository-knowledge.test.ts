import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import {
  buildKnowledgeHealthReview,
  buildKnowledgeFileSourceImport,
  buildKnowledgeFolderSourceImport,
  buildKnowledgeTailActionRewriteInstruction,
  buildKnowledgeTextSourceImport,
  buildKnowledgeUrlSourceImport,
  buildKnowledgeRepositoryMappingPrompt,
  buildKnowledgeRewritePrompt,
  classifyKnowledgeSearchResult,
  extractMarkdownLinks,
  findBacklinks,
  importKnowledgeFileSource,
  importKnowledgeFolderSource,
  writeKnowledgeHealthReview,
  importKnowledgeTextSource,
  importKnowledgeUrlSource,
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

  it('builds and writes pasted text as a source markdown file', async () => {
    const now = new Date('2026-06-28T04:05:06.000Z');
    const imported = buildKnowledgeTextSourceImport({
      title: '  My Raw Idea  ',
      body: 'Line 1\n\nLine 2',
      now,
      sourceRoot: 'sources',
    });

    expect(imported).toEqual({
      title: 'My Raw Idea',
      path: 'sources/imported/2026-06-28-040506-my-raw-idea.md',
      markdown: [
        '---',
        'title: "My Raw Idea"',
        'source: desktop-paste',
        'importedAt: 2026-06-28T04:05:06.000Z',
        '---',
        '',
        '# My Raw Idea',
        '',
        '## 原始内容',
        '',
        'Line 1',
        '',
        'Line 2',
        '',
      ].join('\n'),
    });

    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { writeText },
      },
    });

    const written = await importKnowledgeTextSource(
      {
        ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
        status: 'repo_ready',
      },
      { title: 'My Raw Idea', body: 'Line 1\n\nLine 2', now },
    );

    expect(written.path).toBe('sources/imported/2026-06-28-040506-my-raw-idea.md');
    expect(writeText).toHaveBeenCalledWith('/repo', written.path, written.markdown);
  });

  it('builds and writes clipped URLs as source markdown files', async () => {
    const now = new Date('2026-06-28T05:06:07.000Z');
    const imported = buildKnowledgeUrlSourceImport({
      title: '  Useful Article  ',
      url: 'https://example.com/articles/ai-workflows?utm=1',
      note: 'Important excerpt',
      now,
      sourceRoot: 'sources',
    });

    expect(imported).toEqual({
      title: 'Useful Article',
      path: 'sources/imported/2026-06-28-050607-useful-article.md',
      markdown: [
        '---',
        'title: "Useful Article"',
        'source: desktop-url',
        'url: "https://example.com/articles/ai-workflows?utm=1"',
        'importedAt: 2026-06-28T05:06:07.000Z',
        '---',
        '',
        '# Useful Article',
        '',
        '## 来源链接',
        '',
        '- https://example.com/articles/ai-workflows?utm=1',
        '',
        '## 摘录与备注',
        '',
        'Important excerpt',
        '',
      ].join('\n'),
    });

    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { writeText },
      },
    });

    const written = await importKnowledgeUrlSource(
      {
        ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
        status: 'repo_ready',
      },
      {
        title: 'Useful Article',
        url: 'https://example.com/articles/ai-workflows?utm=1',
        note: 'Important excerpt',
        now,
      },
    );

    expect(written.path).toBe('sources/imported/2026-06-28-050607-useful-article.md');
    expect(writeText).toHaveBeenCalledWith('/repo', written.path, written.markdown);
  });

  it('builds and writes imported text files as source markdown files', async () => {
    const now = new Date('2026-06-28T06:07:08.000Z');
    const imported = buildKnowledgeFileSourceImport({
      fileName: 'Meeting Notes.md',
      mimeType: 'text/markdown',
      body: '# Notes\n\nAction item',
      now,
      sourceRoot: 'sources',
    });

    expect(imported).toEqual({
      title: 'Meeting Notes',
      path: 'sources/imported/2026-06-28-060708-meeting-notes.md',
      markdown: [
        '---',
        'title: "Meeting Notes"',
        'source: desktop-file',
        'fileName: "Meeting Notes.md"',
        'mimeType: "text/markdown"',
        'importedAt: 2026-06-28T06:07:08.000Z',
        '---',
        '',
        '# Meeting Notes',
        '',
        '## 原始文件',
        '',
        '- Meeting Notes.md',
        '- text/markdown',
        '',
        '## 原始内容',
        '',
        '# Notes',
        '',
        'Action item',
        '',
      ].join('\n'),
    });

    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { writeText },
      },
    });

    const written = await importKnowledgeFileSource(
      {
        ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
        status: 'repo_ready',
      },
      {
        fileName: 'Meeting Notes.md',
        mimeType: 'text/markdown',
        body: '# Notes\n\nAction item',
        now,
      },
    );

    expect(written.path).toBe('sources/imported/2026-06-28-060708-meeting-notes.md');
    expect(writeText).toHaveBeenCalledWith('/repo', written.path, written.markdown);
  });

  it('builds and writes folder-imported text files with relative path metadata', async () => {
    const now = new Date('2026-06-28T08:09:10.000Z');
    const imported = buildKnowledgeFolderSourceImport({
      fileName: 'notes.md',
      relativePath: 'project-a/meetings/notes.md',
      mimeType: 'text/markdown',
      body: '# 周会记录\n\n行动项',
      now,
      sourceRoot: 'sources',
    });

    expect(imported).toEqual({
      title: 'notes',
      path: 'sources/imported/2026-06-28-080910-project-a-meetings-notes-md.md',
      markdown: [
        '---',
        'title: "notes"',
        'source: desktop-folder',
        'fileName: "notes.md"',
        'relativePath: "project-a/meetings/notes.md"',
        'mimeType: "text/markdown"',
        'importedAt: 2026-06-28T08:09:10.000Z',
        '---',
        '',
        '# notes',
        '',
        '## 原始文件',
        '',
        '- notes.md',
        '- project-a/meetings/notes.md',
        '- text/markdown',
        '',
        '## 原始内容',
        '',
        '# 周会记录',
        '',
        '行动项',
        '',
      ].join('\n'),
    });

    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { writeText },
      },
    });

    const written = await importKnowledgeFolderSource(
      {
        ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
        status: 'repo_ready',
      },
      {
        fileName: 'notes.md',
        relativePath: 'project-a/meetings/notes.md',
        mimeType: 'text/markdown',
        body: '# 周会记录\n\n行动项',
        now,
      },
    );

    expect(written.path).toBe('sources/imported/2026-06-28-080910-project-a-meetings-notes-md.md');
    expect(writeText).toHaveBeenCalledWith('/repo', written.path, written.markdown);
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
      if (relativePath === 'wiki/topics/agentic.md')
        return ['# Agentic', '[Matter](../../work/active/matter.md)', '[Output](../../outputs/reports/report.md)'].join(
          '\n',
        );
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
    expect(snapshot.backlinks).toEqual([{ sourcePath: 'wiki/index.md', targetPath: 'wiki/topics/agentic.md' }]);
    expect(snapshot.relatedRepositoryLinks).toEqual([
      { sourcePath: 'wiki/topics/agentic.md', targetPath: 'work/active/matter.md', type: 'work' },
      { sourcePath: 'wiki/topics/agentic.md', targetPath: 'outputs/reports/report.md', type: 'output' },
    ]);
  });

  it('computes knowledge health issues from repository markdown facts', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') {
        return [
          { path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 3 },
          { path: 'sources/indexed.md', name: 'indexed.md', size: 22, updatedAt: 2 },
          { path: 'sources/orphan.md', name: 'orphan.md', size: 24, updatedAt: 1 },
        ];
      }
      if (directory === 'wiki') {
        return [
          { path: 'wiki/topic.md', name: 'topic.md', size: 40, updatedAt: 5 },
          { path: 'wiki/healthy.md', name: 'healthy.md', size: 42, updatedAt: 4 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Topic](topic.md)',
          '- [Missing](missing.md)',
          '- [Indexed Source](../sources/indexed.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/topic.md') return '# Topic\n\n[Broken](missing.md)';
      if (relativePath === 'wiki/healthy.md') return '# Healthy\n\n[Raw](../sources/raw.md)';
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
    const health = (
      snapshot as {
        health?: {
          issues: Array<{ kind: string; path: string; targetPath?: string; severity: string }>;
          counts: { total: number; warning: number };
        };
      }
    ).health;

    expect(health?.counts.total).toBe(5);
    expect(health?.counts.warning).toBe(5);
    expect(health?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'orphan_source', path: 'sources/orphan.md', severity: 'warning' }),
        expect.objectContaining({ kind: 'unindexed_wiki', path: 'wiki/healthy.md', severity: 'warning' }),
        expect.objectContaining({ kind: 'stale_index_entry', path: 'wiki/index.md', targetPath: 'wiki/missing.md' }),
        expect.objectContaining({
          kind: 'broken_knowledge_link',
          path: 'wiki/topic.md',
          targetPath: 'wiki/missing.md',
        }),
        expect.objectContaining({ kind: 'wiki_without_source_reference', path: 'wiki/topic.md' }),
      ]),
    );
    expect(snapshot.undigestedSources.map((file) => file.path)).toEqual(['sources/orphan.md']);
  });

  it('flags long-unreviewed work items in knowledge health', async () => {
    const now = new Date('2026-06-28T00:00:00.000Z');
    const oldActive = {
      path: 'work/active/old.md',
      name: 'old.md',
      size: 20,
      updatedAt: Date.parse('2026-06-01T00:00:00.000Z'),
    };
    const freshActive = {
      path: 'work/active/fresh.md',
      name: 'fresh.md',
      size: 20,
      updatedAt: Date.parse('2026-06-24T00:00:00.000Z'),
    };
    const reviewedSomeday = {
      path: 'work/someday/reviewed.md',
      name: 'reviewed.md',
      size: 20,
      updatedAt: Date.parse('2026-05-20T00:00:00.000Z'),
    };
    const weeklyReview = {
      path: 'reviews/weekly/2026-06-27.md',
      name: '2026-06-27.md',
      size: 20,
      updatedAt: Date.parse('2026-06-27T00:00:00.000Z'),
    };
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'work/active') return [oldActive, freshActive];
      if (directory === 'work/someday') return [reviewedSomeday];
      if (directory === 'reviews/weekly') return [weeklyReview];
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') return '# Knowledge Index';
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === weeklyReview.path) {
        return '# 周复盘\n\n- 已复盘 [Reviewed](../../work/someday/reviewed.md)';
      }
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { listMarkdown, readText },
      },
    });

    const snapshot = await loadKnowledgeSnapshot(
      {
        ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
        status: 'repo_ready',
      },
      { now, unreviewedAfterDays: 14 },
    );

    expect(listMarkdown).toHaveBeenCalledWith('/repo', 'work/active');
    expect(listMarkdown).toHaveBeenCalledWith('/repo', 'work/someday');
    expect(listMarkdown).toHaveBeenCalledWith('/repo', 'reviews/weekly');
    expect(snapshot.health.counts.total).toBe(1);
    expect(snapshot.health.issues).toEqual([
      expect.objectContaining({
        id: 'long-unreviewed-work:work/active/old.md',
        kind: 'long_unreviewed_work_item',
        severity: 'warning',
        title: '长期未复盘事项',
        path: 'work/active/old.md',
        targetPath: 'reviews/weekly/',
      }),
    ]);
  });

  it('flags explicitly marked contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/topic.md', name: 'topic.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return ['# Knowledge Index', '- [Topic](topic.md)', '- [Legacy](legacy.md)', '- [Raw](../sources/raw.md)'].join(
          '\n',
        );
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/topic.md') {
        return '# Topic\n\n矛盾：当前说法与 [Legacy](legacy.md) 冲突，需复核。来源 [Raw](../sources/raw.md)。';
      }
      if (relativePath === 'wiki/legacy.md') return '# Legacy\n\n[Raw](../sources/raw.md)';
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

    expect(snapshot.health.counts.total).toBe(1);
    expect(snapshot.health.issues).toEqual([
      expect.objectContaining({
        id: 'contradiction:wiki/topic.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '相互矛盾记录',
        path: 'wiki/topic.md',
        targetPath: 'wiki/legacy.md',
      }),
    ]);
  });

  it('builds and writes weekly knowledge health reviews', async () => {
    const now = new Date('2026-06-28T07:08:09.000Z');
    const health = {
      issues: [
        {
          id: 'orphan-source:sources/orphan.md',
          kind: 'orphan_source' as const,
          severity: 'warning' as const,
          title: '孤立资料',
          detail: '资料还没有被索引或 Wiki 引用。',
          path: 'sources/orphan.md',
          updatedAt: 1782620000000,
        },
        {
          id: 'stale-index:wiki/index.md->wiki/missing.md',
          kind: 'stale_index_entry' as const,
          severity: 'warning' as const,
          title: '索引陈旧',
          detail: '知识索引指向不存在的文件：wiki/missing.md',
          path: 'wiki/index.md',
          targetPath: 'wiki/missing.md',
        },
      ],
      counts: { total: 2, critical: 0, warning: 2, info: 0 },
    };

    const review = buildKnowledgeHealthReview({
      health,
      now,
      reviewsRoot: 'reviews',
    });

    expect(review).toEqual({
      path: 'reviews/weekly/2026-06-28-knowledge-health.md',
      markdown: [
        '---',
        'title: "知识库健康周复盘 2026-06-28"',
        'source: desktop-knowledge-health',
        'generatedAt: 2026-06-28T07:08:09.000Z',
        'issueCount: 2',
        'criticalCount: 0',
        'warningCount: 2',
        'infoCount: 0',
        '---',
        '',
        '# 知识库健康周复盘 2026-06-28',
        '',
        '## 摘要',
        '',
        '- 总问题：2',
        '- 严重：0',
        '- 警告：2',
        '- 提醒：0',
        '',
        '## 问题列表',
        '',
        '| 严重度 | 类型 | 文件 | 目标 | 说明 |',
        '| --- | --- | --- | --- | --- |',
        '| warning | orphan_source | `sources/orphan.md` |  | 资料还没有被索引或 Wiki 引用。 |',
        '| warning | stale_index_entry | `wiki/index.md` | `wiki/missing.md` | 知识索引指向不存在的文件：wiki/missing.md |',
        '',
        '## 建议收尾动作',
        '',
        '- [ ] 消化孤立资料，或把不再需要的资料标记为归档候选。',
        '- [ ] 更新 `wiki/index.md`，移除或修正陈旧索引。',
        '- [ ] 复查本周新增 Wiki 是否引用了原始资料源。',
        '- [ ] 为长期未复盘事项补一条 `reviews/weekly/` 复盘，或把事项状态调整为完成/暂停。',
        '- [ ] 复核相互矛盾记录，确认保留说法、废弃说法和需要更新的 Wiki/log。',
        '- [ ] 必要时发起 Knowledge ActionRun，写入 Wiki、索引和日志。',
        '',
      ].join('\n'),
    });

    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { writeText },
      },
    });

    const written = await writeKnowledgeHealthReview(
      {
        ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
        status: 'repo_ready',
      },
      { health, now },
    );

    expect(written.path).toBe('reviews/weekly/2026-06-28-knowledge-health.md');
    expect(writeText).toHaveBeenCalledWith('/repo', written.path, written.markdown);
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
      if (directory === '30-knowledge/sources')
        return [{ path: '30-knowledge/sources/raw.md', name: 'raw.md', size: 20, updatedAt: 3 }];
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

  it('builds a source matter instruction for knowledge tail actions', () => {
    const instruction = buildKnowledgeTailActionRewriteInstruction({
      workItemPath: 'work/active/release.md',
      tailActionId: 'work/active/release.md:tail-action:2',
    });
    const prompt = buildKnowledgeRewritePrompt({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      intent: 'refresh-index',
      userInstruction: instruction,
    });

    expect(instruction).toContain('work/active/release.md');
    expect(instruction).toContain('work/active/release.md:tail-action:2');
    expect(instruction).toContain('关联执行记录');
    expect(instruction).toContain('no_write_needed');
    expect(prompt).toContain('work/active/release.md');
    expect(prompt).toContain('来源尾动作 ID');
    expect(prompt).toContain('approval_required');
  });

  it('builds a binding-time semantic mapping prompt for LLM Wiki repositories', () => {
    const template = readFileSync('src/prompts/repository/knowledge-semantic-mapping.md', 'utf8');
    const source = readFileSync('src/lib/repository-knowledge.ts', 'utf8');
    const prompt = buildKnowledgeRepositoryMappingPrompt({
      repoPath: '/repo',
      tree: [
        'AGENTS.md',
        'README.md',
        '30-knowledge/index.md',
        '30-knowledge/wiki/topic.md',
        '30-knowledge/sources/raw.md',
      ],
      excerpts: [{ path: 'AGENTS.md', content: 'sources 是事实源，wiki 是智能体维护的知识层。' }],
    });

    expect(template).toContain('{{tree}}');
    expect(template).toContain('{{excerpts}}');
    expect(source).toContain('knowledge-semantic-mapping.md?raw');
    expect(source).toContain('renderPromptTemplate');
    expect(prompt).toContain('LLM 维护的持久 Wiki 知识库');
    expect(prompt).toContain('Raw sources');
    expect(prompt).toContain('Schema / rules');
    expect(prompt).toContain('Ingest workflow');
    expect(prompt).toContain('Lint / health-check workflow');
    expect(prompt).not.toContain('Karpathy LLM Wiki');
    expect(prompt).toContain('sourceRoot');
    expect(prompt).toContain('wikiRoot');
    expect(prompt).toContain('indexPath');
    expect(prompt).toContain('logPath');
    expect(prompt).toContain('不要输出 work/plans/runs/outputs');
    expect(prompt).toContain('```ai-action');
  });

  it('parses binding-time semantic mapping responses into agent mappings', () => {
    const parsed = parseKnowledgeRepositoryMappingResponse(
      [
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
      ].join('\n'),
    );

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
    const search = vi.fn(async () => [{ path: 'wiki/index.md', line: 1, snippet: 'Agentic Repository' }]);
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

    expect(
      classifyKnowledgeSearchResult(binding, { path: 'sources/notes/raw.md', line: 1, snippet: 'raw' }).sourceType,
    ).toBe('sources');
    expect(
      classifyKnowledgeSearchResult(binding, { path: 'wiki/topics/agentic.md', line: 1, snippet: 'wiki' }).sourceType,
    ).toBe('wiki');
  });

  it('extracts markdown links and finds backlinks', () => {
    expect(extractMarkdownLinks('See [Topic](topics/topic.md) and [External](https://example.com).')).toEqual([
      'topics/topic.md',
    ]);

    expect(
      findBacklinks(
        [
          { path: 'wiki/index.md', content: '[Topic](topics/topic.md)' },
          { path: 'wiki/other.md', content: '[Other](other.md)' },
        ],
        'topics/topic.md',
      ),
    ).toEqual(['wiki/index.md']);
  });

  it('parses table and list index entries without duplicates', () => {
    expect(
      parseKnowledgeIndexEntries({
        binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
        indexPath: 'wiki/index.md',
        markdown: [
          '| 条目 | 摘要 | 来源 |',
          '|---|---|---|',
          '| [Topic](topics/topic.md) | Summary | Source |',
          '- [Topic](topics/topic.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n'),
      }),
    ).toEqual([
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
    expect(source).toContain('createAiActionRun({');
  });
});
