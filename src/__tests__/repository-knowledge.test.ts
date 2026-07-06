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
  buildKnowledgeRewriteActionInput,
  buildKnowledgeRepositoryMappingPrompt,
  buildKnowledgeRewritePrompt,
  applyKnowledgeRewriteApproval,
  classifyKnowledgeSearchResult,
  extractMarkdownLinks,
  findBacklinks,
  formatKnowledgeRewriteWrittenPaths,
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

  it('records best-effort fetched URL content when clipping a web source', () => {
    const now = new Date('2026-06-28T05:06:07.000Z');
    const imported = buildKnowledgeUrlSourceImport({
      url: 'https://example.com/articles/ai-workflows',
      fetched: {
        status: 'succeeded',
        title: 'AI Workflows',
        text: 'AI workflows turn repeated research and review into a reusable operating loop.',
        bytesRead: 2048,
        truncated: false,
      },
      now,
      sourceRoot: 'sources',
    });

    expect(imported.title).toBe('AI Workflows');
    expect(imported.markdown).toContain('urlFetchStatus: succeeded');
    expect(imported.markdown).toContain('urlFetchTitle: "AI Workflows"');
    expect(imported.markdown).toContain('urlFetchBytesRead: 2048');
    expect(imported.markdown).toContain('urlFetchTruncated: false');
    expect(imported.markdown).toContain('## 网页抓取内容');
    expect(imported.markdown).toContain(
      'AI workflows turn repeated research and review into a reusable operating loop.',
    );
    expect(imported.markdown).toContain('## 抓取边界');
    expect(imported.markdown).toContain('网页抓取为 best-effort');
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

  it('builds imported extracted files with extraction metadata and limitations', () => {
    const now = new Date('2026-06-28T07:08:09.000Z');
    const imported = buildKnowledgeFileSourceImport({
      fileName: 'Strategy Brief.pdf',
      mimeType: 'application/pdf',
      body: 'North star\n\nP0 import center',
      extracted: {
        format: 'pdf',
        status: 'best_effort',
        bytesRead: 4096,
        truncated: true,
        limitations: ['PDF/Office 文本抽取为 best-effort：会保留可读取文字，复杂版式、图片和公式可能丢失。'],
      },
      now,
      sourceRoot: 'sources',
    });

    expect(imported).toEqual({
      title: 'Strategy Brief',
      path: 'sources/imported/2026-06-28-070809-strategy-brief.md',
      markdown: [
        '---',
        'title: "Strategy Brief"',
        'source: desktop-file',
        'fileName: "Strategy Brief.pdf"',
        'mimeType: "application/pdf"',
        'extractedFormat: pdf',
        'extractionStatus: best_effort',
        'extractedBytesRead: 4096',
        'extractedTruncated: true',
        'importedAt: 2026-06-28T07:08:09.000Z',
        '---',
        '',
        '# Strategy Brief',
        '',
        '## 原始文件',
        '',
        '- Strategy Brief.pdf',
        '- application/pdf',
        '- format: pdf',
        '- extraction: best_effort',
        '- bytesRead: 4096',
        '- truncated: true',
        '',
        '## 抽取限制',
        '',
        '- PDF/Office 文本抽取为 best-effort：会保留可读取文字，复杂版式、图片和公式可能丢失。',
        '',
        '## 抽取文本',
        '',
        'North star',
        '',
        'P0 import center',
        '',
      ].join('\n'),
    });
  });

  it('builds legacy binary Office imports as unavailable source records', () => {
    const now = new Date('2026-06-28T07:09:10.000Z');
    const imported = buildKnowledgeFileSourceImport({
      fileName: 'Legacy Plan.doc',
      mimeType: 'application/msword',
      body: '旧版二进制 Office 正文抽取暂不可用。请转换为 .docx/.xlsx/.pptx 后重新导入，或手动粘贴摘录。',
      extracted: {
        format: 'word',
        status: 'unavailable',
        reason: 'legacy-binary-office',
        bytesRead: 0,
        truncated: false,
        limitations: ['旧版二进制 Office 正文抽取暂不可用：请转换为 .docx/.xlsx/.pptx 后重新导入，或手动粘贴摘录。'],
      },
      now,
      sourceRoot: 'sources',
    });

    expect(imported).toEqual({
      title: 'Legacy Plan',
      path: 'sources/imported/2026-06-28-070910-legacy-plan.md',
      markdown: [
        '---',
        'title: "Legacy Plan"',
        'source: desktop-file',
        'fileName: "Legacy Plan.doc"',
        'mimeType: "application/msword"',
        'extractedFormat: word',
        'extractionStatus: unavailable',
        'extractionReason: legacy-binary-office',
        'extractedBytesRead: 0',
        'extractedTruncated: false',
        'importedAt: 2026-06-28T07:09:10.000Z',
        '---',
        '',
        '# Legacy Plan',
        '',
        '## 原始文件',
        '',
        '- Legacy Plan.doc',
        '- application/msword',
        '- format: word',
        '- extraction: unavailable',
        '- reason: legacy-binary-office',
        '- bytesRead: 0',
        '- truncated: false',
        '',
        '## 抽取限制',
        '',
        '- 旧版二进制 Office 正文抽取暂不可用：请转换为 .docx/.xlsx/.pptx 后重新导入，或手动粘贴摘录。',
        '',
        '## 抽取状态',
        '',
        '旧版二进制 Office 正文抽取暂不可用。请转换为 .docx/.xlsx/.pptx 后重新导入，或手动粘贴摘录。',
        '',
      ].join('\n'),
    });
  });

  it('builds image OCR imports as unavailable source records', () => {
    const now = new Date('2026-06-28T07:10:11.000Z');
    const imported = buildKnowledgeFileSourceImport({
      fileName: 'Whiteboard.png',
      mimeType: 'image/png',
      body: '图片 OCR 暂不可用。请手动粘贴图片中的关键文字，或稍后使用 OCR 能力重新导入。',
      extracted: {
        format: 'image',
        status: 'unavailable',
        reason: 'image-ocr-unavailable',
        bytesRead: 0,
        truncated: false,
        limitations: ['图片 OCR 暂不可用：当前只记录文件来源，不读取图片文字。'],
      },
      now,
      sourceRoot: 'sources',
    });

    expect(imported).toEqual({
      title: 'Whiteboard',
      path: 'sources/imported/2026-06-28-071011-whiteboard.md',
      markdown: [
        '---',
        'title: "Whiteboard"',
        'source: desktop-file',
        'fileName: "Whiteboard.png"',
        'mimeType: "image/png"',
        'extractedFormat: image',
        'extractionStatus: unavailable',
        'extractionReason: image-ocr-unavailable',
        'extractedBytesRead: 0',
        'extractedTruncated: false',
        'importedAt: 2026-06-28T07:10:11.000Z',
        '---',
        '',
        '# Whiteboard',
        '',
        '## 原始文件',
        '',
        '- Whiteboard.png',
        '- image/png',
        '- format: image',
        '- extraction: unavailable',
        '- reason: image-ocr-unavailable',
        '- bytesRead: 0',
        '- truncated: false',
        '',
        '## 抽取限制',
        '',
        '- 图片 OCR 暂不可用：当前只记录文件来源，不读取图片文字。',
        '',
        '## 抽取状态',
        '',
        '图片 OCR 暂不可用。请手动粘贴图片中的关键文字，或稍后使用 OCR 能力重新导入。',
        '',
      ].join('\n'),
    });
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

  it('does not keep explicitly digested sources in the undigested queue', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') {
        return [
          { path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 3 },
          { path: 'sources/mentioned.md', name: 'mentioned.md', size: 22, updatedAt: 2 },
          { path: 'sources/still-raw.md', name: 'still-raw.md', size: 24, updatedAt: 1 },
        ];
      }
      if (directory === 'wiki') {
        return [
          { path: 'wiki/topic.md', name: 'topic.md', size: 40, updatedAt: 5 },
          { path: 'wiki/log.md', name: 'log.md', size: 42, updatedAt: 4 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') return '# Knowledge Index\n\n- [Topic](topic.md)';
      if (relativePath === 'wiki/log.md') {
        return [
          '# Knowledge Log',
          '',
          '- 2026-06-30: 消化 sources/raw.md 为 wiki/topics/raw.md',
          '- 2026-06-30: 记录 sources/mentioned.md 仍待处理',
        ].join('\n');
      }
      if (relativePath === 'wiki/topic.md') return '# Topic\n\nDerived facts without a direct source link.';
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

    expect(snapshot.undigestedSources.map((file) => file.path)).toEqual([
      'sources/mentioned.md',
      'sources/still-raw.md',
    ]);
    expect(snapshot.health.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'orphan_source', path: 'sources/raw.md' })]),
    );
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

  it('uses the current bound work root for long-unreviewed work health checks', async () => {
    const now = new Date('2026-06-28T00:00:00.000Z');
    const mappedActive = {
      path: '10-ops/tasks/active/old.md',
      name: 'old.md',
      size: 20,
      updatedAt: Date.parse('2026-06-01T00:00:00.000Z'),
    };
    const mappedBinding = {
      ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      paths: {
        ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }).paths,
        work: '10-ops/tasks',
      },
      status: 'repo_ready' as const,
    };
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === '10-ops/tasks/active') return [mappedActive];
      if (directory === '10-ops/tasks/someday') return [];
      if (directory === 'reviews/weekly') return [];
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') return '# Knowledge Index';
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { listMarkdown, readText },
      },
    });

    const snapshot = await loadKnowledgeSnapshot(mappedBinding, { now, unreviewedAfterDays: 14 });

    expect(listMarkdown).toHaveBeenCalledWith('/repo', '10-ops/tasks/active');
    expect(listMarkdown).toHaveBeenCalledWith('/repo', '10-ops/tasks/someday');
    expect(listMarkdown).not.toHaveBeenCalledWith('/repo', 'work/active');
    expect(listMarkdown).not.toHaveBeenCalledWith('/repo', 'work/someday');
    expect(snapshot.health.issues).toEqual([
      expect.objectContaining({
        id: 'long-unreviewed-work:10-ops/tasks/active/old.md',
        kind: 'long_unreviewed_work_item',
        path: '10-ops/tasks/active/old.md',
        targetPath: 'reviews/weekly/',
      }),
    ]);
  });

  it('does not treat knowledge health issue tables as work item reviews', async () => {
    const now = new Date('2026-06-28T00:00:00.000Z');
    const oldActive = {
      path: 'work/active/old.md',
      name: 'old.md',
      size: 20,
      updatedAt: Date.parse('2026-06-01T00:00:00.000Z'),
    };
    const weeklyReview = {
      path: 'reviews/weekly/2026-06-27-knowledge-health.md',
      name: '2026-06-27-knowledge-health.md',
      size: 20,
      updatedAt: Date.parse('2026-06-27T00:00:00.000Z'),
    };
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'work/active') return [oldActive];
      if (directory === 'work/someday') return [];
      if (directory === 'reviews/weekly') return [weeklyReview];
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') return '# Knowledge Index';
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === weeklyReview.path) {
        return [
          '---',
          'title: "知识库健康周复盘 2026-06-27"',
          'source: desktop-knowledge-health',
          '---',
          '',
          '# 知识库健康周复盘 2026-06-27',
          '',
          '## 问题列表',
          '',
          '| 严重度 | 类型 | 文件 | 目标 | 说明 |',
          '| --- | --- | --- | --- | --- |',
          '| warning | long_unreviewed_work_item | `work/active/old.md` | `reviews/weekly/` | 工作事项超过 14 天没有近期复盘。 |',
        ].join('\n');
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

    expect(snapshot.health.issues).toEqual([
      expect.objectContaining({
        id: 'long-unreviewed-work:work/active/old.md',
        kind: 'long_unreviewed_work_item',
        path: 'work/active/old.md',
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

  it('flags conflicting structured facts in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nFact: billing.dueDay = 15\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\n事实：billing.dueDay = 20\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'structured-contradiction:billing.dueDay:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '结构化事实矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '结构化事实 billing.dueDay 同时记录了 15 和 20。',
      }),
    ]);
  });

  it('flags colon-delimited structured facts in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
          { path: 'wiki/zh-current.md', name: 'zh-current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/zh-legacy.md', name: 'zh-legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [ZH Current](zh-current.md)',
          '- [ZH Legacy](zh-legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nFact: billing.currency: USD\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nFact: billing.currency: CNY\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/zh-current.md') {
        return '# ZH Current\n\n事实：support.level：enterprise\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/zh-legacy.md') {
        return '# ZH Legacy\n\n事实：support.level：community\n\n[Raw](../sources/raw.md)';
      }
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

    expect(snapshot.health.counts.total).toBe(2);
    expect(snapshot.health.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'structured-contradiction:billing.currency:wiki/legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '结构化事实矛盾',
          path: 'wiki/legacy.md',
          targetPath: 'wiki/current.md',
          detail: '结构化事实 billing.currency 同时记录了 USD 和 CNY。',
        }),
        expect.objectContaining({
          id: 'structured-contradiction:support.level:wiki/zh-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '结构化事实矛盾',
          path: 'wiki/zh-legacy.md',
          targetPath: 'wiki/zh-current.md',
          detail: '结构化事实 support.level 同时记录了 enterprise 和 community。',
        }),
      ]),
    );
  });

  it('flags conservative free-text support contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
          { path: 'wiki/passive-current.md', name: 'passive-current.md', size: 80, updatedAt: 4 },
          { path: 'wiki/passive-legacy.md', name: 'passive-legacy.md', size: 60, updatedAt: 3 },
          { path: 'wiki/not-supported-current.md', name: 'not-supported-current.md', size: 80, updatedAt: 2 },
          { path: 'wiki/not-supported-legacy.md', name: 'not-supported-legacy.md', size: 60, updatedAt: 1 },
          { path: 'wiki/no-longer-current.md', name: 'no-longer-current.md', size: 80, updatedAt: 0 },
          { path: 'wiki/no-longer-legacy.md', name: 'no-longer-legacy.md', size: 60, updatedAt: 0 },
          { path: 'wiki/no-longer-supports-current.md', name: 'no-longer-supports-current.md', size: 80, updatedAt: 0 },
          { path: 'wiki/no-longer-supports-legacy.md', name: 'no-longer-supports-legacy.md', size: 60, updatedAt: 0 },
          { path: 'wiki/stopped-supporting-current.md', name: 'stopped-supporting-current.md', size: 80, updatedAt: 0 },
          { path: 'wiki/stopped-supporting-legacy.md', name: 'stopped-supporting-legacy.md', size: 60, updatedAt: 0 },
          {
            path: 'wiki/discontinued-support-current.md',
            name: 'discontinued-support-current.md',
            size: 80,
            updatedAt: 0,
          },
          {
            path: 'wiki/discontinued-support-legacy.md',
            name: 'discontinued-support-legacy.md',
            size: 60,
            updatedAt: 0,
          },
          { path: 'wiki/removed-current.md', name: 'removed-current.md', size: 80, updatedAt: 0 },
          { path: 'wiki/removed-legacy.md', name: 'removed-legacy.md', size: 60, updatedAt: 0 },
          { path: 'wiki/discontinued-current.md', name: 'discontinued-current.md', size: 80, updatedAt: 0 },
          { path: 'wiki/discontinued-legacy.md', name: 'discontinued-legacy.md', size: 60, updatedAt: 0 },
          { path: 'wiki/ended-current.md', name: 'ended-current.md', size: 80, updatedAt: 0 },
          { path: 'wiki/ended-legacy.md', name: 'ended-legacy.md', size: 60, updatedAt: 0 },
          { path: 'wiki/has-ended-current.md', name: 'has-ended-current.md', size: 80, updatedAt: 0 },
          { path: 'wiki/has-ended-legacy.md', name: 'has-ended-legacy.md', size: 60, updatedAt: 0 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Passive Current](passive-current.md)',
          '- [Passive Legacy](passive-legacy.md)',
          '- [Not Supported Current](not-supported-current.md)',
          '- [Not Supported Legacy](not-supported-legacy.md)',
          '- [No Longer Current](no-longer-current.md)',
          '- [No Longer Legacy](no-longer-legacy.md)',
          '- [No Longer Supports Current](no-longer-supports-current.md)',
          '- [No Longer Supports Legacy](no-longer-supports-legacy.md)',
          '- [Stopped Supporting Current](stopped-supporting-current.md)',
          '- [Stopped Supporting Legacy](stopped-supporting-legacy.md)',
          '- [Discontinued Support Current](discontinued-support-current.md)',
          '- [Discontinued Support Legacy](discontinued-support-legacy.md)',
          '- [Removed Current](removed-current.md)',
          '- [Removed Legacy](removed-legacy.md)',
          '- [Discontinued Current](discontinued-current.md)',
          '- [Discontinued Legacy](discontinued-legacy.md)',
          '- [Ended Current](ended-current.md)',
          '- [Ended Legacy](ended-legacy.md)',
          '- [Has Ended Current](has-ended-current.md)',
          '- [Has Ended Legacy](has-ended-legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nThe product supports SSO.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nThe product does not support SSO.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/passive-current.md') {
        return '# Passive Current\n\nDesktop PDF export is supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/passive-legacy.md') {
        return '# Passive Legacy\n\nDesktop PDF export is unsupported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/not-supported-current.md') {
        return '# Not Supported Current\n\nDesktop CSV exports are supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/not-supported-legacy.md') {
        return '# Not Supported Legacy\n\nDesktop CSV exports are not supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/no-longer-current.md') {
        return '# No Longer Current\n\nDesktop CSV import is supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/no-longer-legacy.md') {
        return '# No Longer Legacy\n\nDesktop CSV import is no longer supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/no-longer-supports-current.md') {
        return '# No Longer Supports Current\n\nDesktop CSV migration is supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/no-longer-supports-legacy.md') {
        return '# No Longer Supports Legacy\n\nDesktop no longer supports CSV migration.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/stopped-supporting-current.md') {
        return '# Stopped Supporting Current\n\nDesktop CSV cleanup is supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/stopped-supporting-legacy.md') {
        return '# Stopped Supporting Legacy\n\nDesktop stopped supporting CSV cleanup.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/discontinued-support-current.md') {
        return '# Discontinued Support Current\n\nDesktop CSV forwarding is supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/discontinued-support-legacy.md') {
        return '# Discontinued Support Legacy\n\nDesktop discontinued support for CSV forwarding.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/removed-current.md') {
        return '# Removed Current\n\nDesktop CSV sync is supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/removed-legacy.md') {
        return '# Removed Legacy\n\nDesktop support for CSV sync was removed.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/discontinued-current.md') {
        return '# Discontinued Current\n\nDesktop CSV backup is supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/discontinued-legacy.md') {
        return '# Discontinued Legacy\n\nDesktop support for CSV backup was discontinued.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/ended-current.md') {
        return '# Ended Current\n\nDesktop CSV archive is supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/ended-legacy.md') {
        return '# Ended Legacy\n\nDesktop support for CSV archive ended.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/has-ended-current.md') {
        return '# Has Ended Current\n\nDesktop CSV restore is supported.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/has-ended-legacy.md') {
        return '# Has Ended Legacy\n\nDesktop support for CSV restore has ended.\n\n[Raw](../sources/raw.md)';
      }
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

    expect(snapshot.health.counts.total).toBe(11);
    expect(snapshot.health.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'semantic-support-contradiction:sso:wiki/legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/legacy.md',
          targetPath: 'wiki/current.md',
          detail: '自由文本同时记录了支持 SSO 和不支持 SSO。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:pdf-export:wiki/passive-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/passive-legacy.md',
          targetPath: 'wiki/passive-current.md',
          detail: '自由文本同时记录了支持 PDF export 和不支持 PDF export。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:csv-exports:wiki/not-supported-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/not-supported-legacy.md',
          targetPath: 'wiki/not-supported-current.md',
          detail: '自由文本同时记录了支持 CSV exports 和不支持 CSV exports。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:csv-import:wiki/no-longer-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/no-longer-legacy.md',
          targetPath: 'wiki/no-longer-current.md',
          detail: '自由文本同时记录了支持 CSV import 和不支持 CSV import。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:csv-migration:wiki/no-longer-supports-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/no-longer-supports-legacy.md',
          targetPath: 'wiki/no-longer-supports-current.md',
          detail: '自由文本同时记录了支持 CSV migration 和不支持 CSV migration。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:csv-cleanup:wiki/stopped-supporting-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/stopped-supporting-legacy.md',
          targetPath: 'wiki/stopped-supporting-current.md',
          detail: '自由文本同时记录了支持 CSV cleanup 和不支持 CSV cleanup。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:csv-forwarding:wiki/discontinued-support-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/discontinued-support-legacy.md',
          targetPath: 'wiki/discontinued-support-current.md',
          detail: '自由文本同时记录了支持 CSV forwarding 和不支持 CSV forwarding。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:csv-sync:wiki/removed-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/removed-legacy.md',
          targetPath: 'wiki/removed-current.md',
          detail: '自由文本同时记录了支持 CSV sync 和不支持 CSV sync。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:csv-backup:wiki/discontinued-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/discontinued-legacy.md',
          targetPath: 'wiki/discontinued-current.md',
          detail: '自由文本同时记录了支持 CSV backup 和不支持 CSV backup。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:csv-archive:wiki/ended-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/ended-legacy.md',
          targetPath: 'wiki/ended-current.md',
          detail: '自由文本同时记录了支持 CSV archive 和不支持 CSV archive。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:csv-restore:wiki/has-ended-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/has-ended-legacy.md',
          targetPath: 'wiki/has-ended-current.md',
          detail: '自由文本同时记录了支持 CSV restore 和不支持 CSV restore。',
        }),
      ]),
    );
  });

  it('flags conservative free-text can/cannot contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop can export CSV.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop cannot export CSV.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:export-csv:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 export CSV 和不支持 export CSV。',
      }),
    ]);
  });

  it('flags conservative Chinese free-text can/cannot contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\n小龙虾可以导出 CSV。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\n小龙虾不能导出 CSV。\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:csv:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 导出 CSV 和不支持 导出 CSV。',
      }),
    ]);
  });

  it('flags conservative enabled disabled contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
          { path: 'wiki/zh-current.md', name: 'zh-current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/zh-legacy.md', name: 'zh-legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [ZH Current](zh-current.md)',
          '- [ZH Legacy](zh-legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop offline mode is enabled.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop offline mode is disabled.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/zh-current.md') {
        return '# ZH Current\n\n小龙虾已启用 CSV export。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/zh-legacy.md') {
        return '# ZH Legacy\n\n小龙虾已禁用 CSV export。\n\n[Raw](../sources/raw.md)';
      }
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

    expect(snapshot.health.counts.total).toBe(2);
    expect(snapshot.health.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'semantic-support-contradiction:offline-mode:wiki/legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/legacy.md',
          targetPath: 'wiki/current.md',
          detail: '自由文本同时记录了支持 offline mode 和不支持 offline mode。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:csv-export:wiki/zh-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/zh-legacy.md',
          targetPath: 'wiki/zh-current.md',
          detail: '自由文本同时记录了支持 CSV export 和不支持 CSV export。',
        }),
      ]),
    );
  });

  it('flags conservative plural enabled disabled contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop offline features are enabled.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop offline features are disabled.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:offline-features:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 offline features 和不支持 offline features。',
      }),
    ]);
  });

  it('flags conservative turned on off contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop audit logging is turned on.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop audit logging is turned off.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:audit-logging:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 audit logging 和不支持 audit logging。',
      }),
    ]);
  });

  it('flags conservative switched on off contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop diagnostics export is switched on.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop diagnostics export is switched off.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:diagnostics-export:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 diagnostics export 和不支持 diagnostics export。',
      }),
    ]);
  });

  it('flags conservative activated deactivated contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop access review is activated.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop access review is deactivated.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:access-review:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 access review 和不支持 access review。',
      }),
    ]);
  });

  it('flags conservative permitted forbidden contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop data export is permitted.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop data export is forbidden.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:data-export:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 data export 和不支持 data export。',
      }),
    ]);
  });

  it('flags conservative plural permitted forbidden contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop data exports are permitted.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop data exports are forbidden.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:data-exports:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 data exports 和不支持 data exports。',
      }),
    ]);
  });

  it('flags conservative allowed disallowed contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop guest export is allowed.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop guest export is disallowed.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:guest-export:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 guest export 和不支持 guest export。',
      }),
    ]);
  });

  it('flags conservative plural allowed disallowed contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop repository writes are allowed.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop repository writes are disallowed.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:repository-writes:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 repository writes 和不支持 repository writes。',
      }),
    ]);
  });

  it('flags conservative authorized unauthorized contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop remote control is authorized.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop remote control is unauthorized.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:remote-control:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 remote control 和不支持 remote control。',
      }),
    ]);
  });

  it('flags conservative plural authorized unauthorized contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop remote approvals are authorized.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop remote approvals are unauthorized.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:remote-approvals:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 remote approvals 和不支持 remote approvals。',
      }),
    ]);
  });

  it('flags conservative granted revoked contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop file access is granted.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop file access is revoked.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:file-access:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 file access 和不支持 file access。',
      }),
    ]);
  });

  it('flags conservative plural granted revoked contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop file permissions are granted.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop file permissions are revoked.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:file-permissions:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 file permissions 和不支持 file permissions。',
      }),
    ]);
  });

  it('flags conservative approved denied contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop repository writes are approved.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop repository writes are denied.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:repository-writes:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 repository writes 和不支持 repository writes。',
      }),
    ]);
  });

  it('flags conservative Chinese open closed contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\n小龙虾开启离线模式。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\n小龙虾关闭离线模式。\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:subject:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 离线模式 和不支持 离线模式。',
      }),
    ]);
  });

  it('flags conservative Chinese already open closed contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\n小龙虾已开启审计日志。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\n小龙虾已关闭审计日志。\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:subject:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 审计日志 和不支持 审计日志。',
      }),
    ]);
  });

  it('flags conservative Chinese enable stop contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\n小龙虾启用实验模式。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\n小龙虾停用实验模式。\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:subject:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 实验模式 和不支持 实验模式。',
      }),
    ]);
  });

  it('flags conservative Chinese allow prohibit contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\n小龙虾允许访客导出。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\n小龙虾禁止访客导出。\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:subject:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 访客导出 和不支持 访客导出。',
      }),
    ]);
  });

  it('flags conservative required optional contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
          { path: 'wiki/zh-current.md', name: 'zh-current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/zh-legacy.md', name: 'zh-legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [ZH Current](zh-current.md)',
          '- [ZH Legacy](zh-legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop SSO is required.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop SSO is optional.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/zh-current.md') {
        return '# ZH Current\n\n小龙虾必须配置审计日志。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/zh-legacy.md') {
        return '# ZH Legacy\n\n小龙虾可选配置审计日志。\n\n[Raw](../sources/raw.md)';
      }
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

    expect(snapshot.health.counts.total).toBe(2);
    expect(snapshot.health.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'semantic-support-contradiction:sso:wiki/legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/legacy.md',
          targetPath: 'wiki/current.md',
          detail: '自由文本同时记录了支持 SSO 和不支持 SSO。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:subject:wiki/zh-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/zh-legacy.md',
          targetPath: 'wiki/zh-current.md',
          detail: '自由文本同时记录了支持 配置审计日志 和不支持 配置审计日志。',
        }),
      ]),
    );
  });

  it('flags conservative plural required optional contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop audit logs are required.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop audit logs are optional.\n\n[Raw](../sources/raw.md)';
      }
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
    expect(snapshot.health.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'semantic-support-contradiction:audit-logs:wiki/legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/legacy.md',
          targetPath: 'wiki/current.md',
          detail: '自由文本同时记录了支持 audit logs 和不支持 audit logs。',
        }),
      ]),
    );
  });

  it('flags conservative available unavailable contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
          { path: 'wiki/zh-current.md', name: 'zh-current.md', size: 80, updatedAt: 6 },
          { path: 'wiki/zh-legacy.md', name: 'zh-legacy.md', size: 60, updatedAt: 5 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [ZH Current](zh-current.md)',
          '- [ZH Legacy](zh-legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop PDF preview is available.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop PDF preview is unavailable.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/zh-current.md') {
        return '# ZH Current\n\n小龙虾离线模式可用。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/zh-legacy.md') {
        return '# ZH Legacy\n\n小龙虾离线模式不可用。\n\n[Raw](../sources/raw.md)';
      }
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

    expect(snapshot.health.counts.total).toBe(2);
    expect(snapshot.health.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'semantic-support-contradiction:pdf-preview:wiki/legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/legacy.md',
          targetPath: 'wiki/current.md',
          detail: '自由文本同时记录了支持 PDF preview 和不支持 PDF preview。',
        }),
        expect.objectContaining({
          id: 'semantic-support-contradiction:subject:wiki/zh-legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/zh-legacy.md',
          targetPath: 'wiki/zh-current.md',
          detail: '自由文本同时记录了支持 离线模式 和不支持 离线模式。',
        }),
      ]),
    );
  });

  it('flags conservative plural available unavailable contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop PDF previews are available.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop PDF previews are unavailable.\n\n[Raw](../sources/raw.md)';
      }
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
    expect(snapshot.health.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'semantic-support-contradiction:pdf-previews:wiki/legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/legacy.md',
          targetPath: 'wiki/current.md',
          detail: '自由文本同时记录了支持 PDF previews 和不支持 PDF previews。',
        }),
      ]),
    );
  });

  it('flags conservative recommended not recommended contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop sandbox mode is recommended.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop sandbox mode is not recommended.\n\n[Raw](../sources/raw.md)';
      }
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
    expect(snapshot.health.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'semantic-support-contradiction:sandbox-mode:wiki/legacy.md:3',
          kind: 'contradictory_knowledge_record',
          severity: 'warning',
          title: '自由文本能力矛盾',
          path: 'wiki/legacy.md',
          targetPath: 'wiki/current.md',
          detail: '自由文本同时记录了支持 sandbox mode 和不支持 sandbox mode。',
        }),
      ]),
    );
  });

  it('flags conservative Chinese recommended not recommended contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\n小龙虾建议开启沙盒模式。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\n小龙虾不建议开启沙盒模式。\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:subject:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 开启沙盒模式 和不支持 开启沙盒模式。',
      }),
    ]);
  });

  it('flags conservative should should not contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop should enable sandbox mode.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop should not enable sandbox mode.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:enable-sandbox-mode:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 enable sandbox mode 和不支持 enable sandbox mode。',
      }),
    ]);
  });

  it('flags conservative allowed to not allowed to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is allowed to open local settings.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is not allowed to open local settings.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:open-local-settings:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 open local settings 和不支持 open local settings。',
      }),
    ]);
  });

  it('flags conservative permitted to not permitted to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is permitted to export diagnostics.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is not permitted to export diagnostics.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:export-diagnostics:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 export diagnostics 和不支持 export diagnostics。',
      }),
    ]);
  });

  it('flags conservative permitted to forbidden to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is permitted to run local tools.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is forbidden to run local tools.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:run-local-tools:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 run local tools 和不支持 run local tools。',
      }),
    ]);
  });

  it('flags conservative permitted prohibited from contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop local tool execution is permitted.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is prohibited from local tool execution.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:local-tool-execution:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 local tool execution 和不支持 local tool execution。',
      }),
    ]);
  });

  it('flags conservative permitted restricted from contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop local tool execution is permitted.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is restricted from local tool execution.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:local-tool-execution:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 local tool execution 和不支持 local tool execution。',
      }),
    ]);
  });

  it('flags conservative permitted blocked from contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop local tool execution is permitted.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is blocked from local tool execution.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:local-tool-execution:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 local tool execution 和不支持 local tool execution。',
      }),
    ]);
  });

  it('flags conservative permitted barred from contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop local tool execution is permitted.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is barred from local tool execution.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:local-tool-execution:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 local tool execution 和不支持 local tool execution。',
      }),
    ]);
  });

  it('flags conservative permitted prevented from contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop local tool execution is permitted.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is prevented from local tool execution.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:local-tool-execution:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 local tool execution 和不支持 local tool execution。',
      }),
    ]);
  });

  it('flags conservative permitted precluded from contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop local tool execution is permitted.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is precluded from local tool execution.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:local-tool-execution:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 local tool execution 和不支持 local tool execution。',
      }),
    ]);
  });

  it('flags conservative able to unable to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is able to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is unable to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:execute-local-tools:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 execute local tools 和不支持 execute local tools。',
      }),
    ]);
  });

  it('flags conservative able to not able to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is able to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is not able to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:execute-local-tools:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 execute local tools 和不支持 execute local tools。',
      }),
    ]);
  });

  it('flags conservative capable of incapable of contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is capable of executing local tools.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is incapable of executing local tools.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:executing-local-tools:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 executing local tools 和不支持 executing local tools。',
      }),
    ]);
  });

  it('flags conservative capable of not capable of contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is capable of executing local tools.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is not capable of executing local tools.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:executing-local-tools:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 executing local tools 和不支持 executing local tools。',
      }),
    ]);
  });

  it('flags conservative has ability lacks ability contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop has the ability to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop lacks the ability to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:execute-local-tools:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 execute local tools 和不支持 execute local tools。',
      }),
    ]);
  });

  it('flags conservative has ability does not have ability contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop has the ability to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not have the ability to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:execute-local-tools:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 execute local tools 和不支持 execute local tools。',
      }),
    ]);
  });

  it('flags conservative compatible with incompatible with contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is compatible with legacy Office imports.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is incompatible with legacy Office imports.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:legacy-office-imports:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 legacy Office imports 和不支持 legacy Office imports。',
      }),
    ]);
  });

  it('flags conservative requires does not require contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop requires a bound repository.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not require a bound repository.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:a-bound-repository:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 a bound repository 和不支持 a bound repository。',
      }),
    ]);
  });

  it('flags conservative uses does not use contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop uses local storage.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not use local storage.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:local-storage:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 local storage 和不支持 local storage。',
      }),
    ]);
  });

  it('flags conservative relies on does not rely on contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop relies on Gateway connection.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not rely on Gateway connection.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-connection:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway connection 和不支持 Gateway connection。',
      }),
    ]);
  });

  it('flags conservative depends on does not depend on contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop depends on workspace binding.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not depend on workspace binding.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:workspace-binding:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 workspace binding 和不支持 workspace binding。',
      }),
    ]);
  });

  it('flags conservative integrates with does not integrate with contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop integrates with Gateway approvals.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not integrate with Gateway approvals.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-approvals:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway approvals 和不支持 Gateway approvals。',
      }),
    ]);
  });

  it('flags conservative connects to does not connect to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop connects to Gateway control plane.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not connect to Gateway control plane.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-control-plane:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway control plane 和不支持 Gateway control plane。',
      }),
    ]);
  });

  it('flags conservative communicates with does not communicate with contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop communicates with Gateway session bus.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not communicate with Gateway session bus.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-session-bus:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway session bus 和不支持 Gateway session bus。',
      }),
    ]);
  });

  it('flags conservative routes to does not route to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop routes to Workbench reviews.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not route to Workbench reviews.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:workbench-reviews:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Workbench reviews 和不支持 Workbench reviews。',
      }),
    ]);
  });

  it('flags conservative sends to does not send to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop sends to Gateway callbacks.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not send to Gateway callbacks.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-callbacks:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway callbacks 和不支持 Gateway callbacks。',
      }),
    ]);
  });

  it('flags conservative receives from does not receive from contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop receives from Gateway events.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not receive from Gateway events.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-events:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway events 和不支持 Gateway events。',
      }),
    ]);
  });

  it('flags conservative listens to does not listen to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop listens to Gateway event stream.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not listen to Gateway event stream.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-event-stream:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway event stream 和不支持 Gateway event stream。',
      }),
    ]);
  });

  it('flags conservative subscribes to does not subscribe to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop subscribes to Gateway event stream.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not subscribe to Gateway event stream.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-event-stream:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway event stream 和不支持 Gateway event stream。',
      }),
    ]);
  });

  it('flags conservative publishes to does not publish to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop publishes to Gateway topics.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not publish to Gateway topics.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-topics:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway topics 和不支持 Gateway topics。',
      }),
    ]);
  });

  it('flags conservative emits to does not emit to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop emits to Gateway event bus.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not emit to Gateway event bus.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-event-bus:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway event bus 和不支持 Gateway event bus。',
      }),
    ]);
  });

  it('flags conservative broadcasts to does not broadcast to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop broadcasts to Gateway event channel.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not broadcast to Gateway event channel.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-event-channel:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway event channel 和不支持 Gateway event channel。',
      }),
    ]);
  });

  it('flags conservative forwards to does not forward to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop forwards to Gateway callback queue.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not forward to Gateway callback queue.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:gateway-callback-queue:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Gateway callback queue 和不支持 Gateway callback queue。',
      }),
    ]);
  });

  it('flags conservative delivers to does not deliver to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop delivers to Workbench output inbox.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not deliver to Workbench output inbox.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:workbench-output-inbox:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Workbench output inbox 和不支持 Workbench output inbox。',
      }),
    ]);
  });

  it('flags conservative writes to does not write to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop writes to Repository outputs.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not write to Repository outputs.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:repository-outputs:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Repository outputs 和不支持 Repository outputs。',
      }),
    ]);
  });

  it('flags conservative saves to does not save to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop saves to Artifact storage.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not save to Artifact storage.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:artifact-storage:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Artifact storage 和不支持 Artifact storage。',
      }),
    ]);
  });

  it('flags conservative stores in does not store in contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop stores in Repository memory.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not store in Repository memory.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:repository-memory:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Repository memory 和不支持 Repository memory。',
      }),
    ]);
  });

  it('flags conservative persists to does not persist to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop persists to Repository memory.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not persist to Repository memory.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:repository-memory:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 Repository memory 和不支持 Repository memory。',
      }),
    ]);
  });

  it('flags conservative equipped to not equipped to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is equipped to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is not equipped to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:execute-local-tools:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 execute local tools 和不支持 execute local tools。',
      }),
    ]);
  });

  it('flags conservative ready to not ready to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is ready to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is not ready to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:execute-local-tools:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 execute local tools 和不支持 execute local tools。',
      }),
    ]);
  });

  it('flags conservative prepared to not prepared to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is prepared to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is not prepared to execute local tools.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:execute-local-tools:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 execute local tools 和不支持 execute local tools。',
      }),
    ]);
  });

  it('flags conservative authorized to not authorized to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is authorized to manage remote sessions.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is not authorized to manage remote sessions.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:manage-remote-sessions:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 manage remote sessions 和不支持 manage remote sessions。',
      }),
    ]);
  });

  it('flags conservative approved to not approved to contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop is approved to execute repository assets.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop is not approved to execute repository assets.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:execute-repository-assets:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 execute repository assets 和不支持 execute repository assets。',
      }),
    ]);
  });

  it('flags conservative has access does not have access contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop has access to repository assets.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop does not have access to repository assets.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:repository-assets:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 repository assets 和不支持 repository assets。',
      }),
    ]);
  });

  it('flags conservative has access has no access contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop has access to repository assets.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop has no access to repository assets.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:repository-assets:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 repository assets 和不支持 repository assets。',
      }),
    ]);
  });

  it('flags conservative must must not contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop must request approval before running assets.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop must not request approval before running assets.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:request-approval-before-running-assets:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail:
          '自由文本同时记录了支持 request approval before running assets 和不支持 request approval before running assets。',
      }),
    ]);
  });

  it('flags conservative may may not contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop may open local settings.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop may not open local settings.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:open-local-settings:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 open local settings 和不支持 open local settings。',
      }),
    ]);
  });

  it('flags conservative shall shall not contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop shall preserve user outputs.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop shall not preserve user outputs.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:preserve-user-outputs:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 preserve user outputs 和不支持 preserve user outputs。',
      }),
    ]);
  });

  it('flags conservative mandatory prohibited contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop approval prompts are mandatory.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop approval prompts are prohibited.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:approval-prompts:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 approval prompts 和不支持 approval prompts。',
      }),
    ]);
  });

  it('flags conservative compulsory prohibited contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\nDesktop approval prompts are compulsory.\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\nDesktop approval prompts are prohibited.\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:approval-prompts:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 approval prompts 和不支持 approval prompts。',
      }),
    ]);
  });

  it('flags conservative Chinese should should not contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\n小龙虾应该开启沙盒模式。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\n小龙虾不应该开启沙盒模式。\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:subject:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 开启沙盒模式 和不支持 开启沙盒模式。',
      }),
    ]);
  });

  it('flags conservative Chinese must must not contradictions in knowledge health', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'sources') return [{ path: 'sources/raw.md', name: 'raw.md', size: 20, updatedAt: 1 }];
      if (directory === 'wiki') {
        return [
          { path: 'wiki/current.md', name: 'current.md', size: 80, updatedAt: 8 },
          { path: 'wiki/legacy.md', name: 'legacy.md', size: 60, updatedAt: 7 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'wiki/index.md') {
        return [
          '# Knowledge Index',
          '- [Current](current.md)',
          '- [Legacy](legacy.md)',
          '- [Raw](../sources/raw.md)',
        ].join('\n');
      }
      if (relativePath === 'wiki/log.md') return '# Wiki Log';
      if (relativePath === 'wiki/current.md') {
        return '# Current\n\n小龙虾必须请求审批。\n\n[Raw](../sources/raw.md)';
      }
      if (relativePath === 'wiki/legacy.md') {
        return '# Legacy\n\n小龙虾不得请求审批。\n\n[Raw](../sources/raw.md)';
      }
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
        id: 'semantic-support-contradiction:subject:wiki/legacy.md:3',
        kind: 'contradictory_knowledge_record',
        severity: 'warning',
        title: '自由文本能力矛盾',
        path: 'wiki/legacy.md',
        targetPath: 'wiki/current.md',
        detail: '自由文本同时记录了支持 请求审批 和不支持 请求审批。',
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

  it('applies approved knowledge rewrite writes to wiki, index and log', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { writeText },
      },
    });

    const result = await applyKnowledgeRewriteApproval(
      {
        ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
        status: 'repo_ready',
      },
      {
        actionRunId: 'run-knowledge-1',
        repositoryWrite: {
          path: 'wiki/topics/raw.md',
          content: '# Raw\n\nReusable knowledge.',
          sourcePath: 'sources/raw.md',
          writes: [
            { path: 'wiki/topics/raw.md', content: '# Raw\n\nReusable knowledge.' },
            { path: 'wiki/index.md', content: '# Knowledge Index\n\n- [Raw](topics/raw.md)' },
            { path: 'wiki/log.md', content: '# Knowledge Log\n\n- 2026-06-28: digested sources/raw.md' },
          ],
        },
      },
    );

    expect(result.writtenPaths).toEqual(['wiki/topics/raw.md', 'wiki/index.md', 'wiki/log.md']);
    expect(writeText).toHaveBeenCalledTimes(3);
    expect(writeText).toHaveBeenNthCalledWith(1, '/repo', 'wiki/topics/raw.md', '# Raw\n\nReusable knowledge.');
    expect(writeText).toHaveBeenNthCalledWith(
      2,
      '/repo',
      'wiki/index.md',
      '# Knowledge Index\n\n- [Raw](topics/raw.md)',
    );
    expect(writeText).toHaveBeenNthCalledWith(
      3,
      '/repo',
      'wiki/log.md',
      '# Knowledge Log\n\n- 2026-06-28: digested sources/raw.md',
    );
  });

  it('formats approved knowledge rewrite written paths for ActionRun summaries', () => {
    expect(
      formatKnowledgeRewriteWrittenPaths(['wiki/topics/raw.md', 'wiki/index.md', 'wiki/log.md', 'wiki/topics/raw.md']),
    ).toBe('wiki/topics/raw.md, wiki/index.md, wiki/log.md');
  });

  it('rejects approved knowledge rewrite writes outside the knowledge wiki boundary', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { writeText },
      },
    });

    await expect(
      applyKnowledgeRewriteApproval(
        {
          ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
          status: 'repo_ready',
        },
        {
          actionRunId: 'run-knowledge-1',
          repositoryWrite: {
            path: 'wiki/topics/raw.md',
            content: '# Raw',
            writes: [
              { path: 'wiki/topics/raw.md', content: '# Raw' },
              { path: 'work/active/side-effect.md', content: '# Side effect' },
            ],
          },
        },
      ),
    ).rejects.toThrow('Approved knowledge writes can only update wiki files');
    expect(writeText).not.toHaveBeenCalled();
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
    expect(prompt).toContain('消化计划');
    expect(prompt).toContain('读取资料源 `sources/raw.md`');
    expect(prompt).toContain('提取可复用事实、决策、流程、约束和待确认问题');
    expect(prompt).toContain('对照现有 Wiki、index 和 log，避免重复或自相矛盾');
    expect(prompt).toContain('输出 approval_required 或 no_write_needed');
  });

  it('builds a digest plan input for Knowledge rewrite ActionRuns', () => {
    const input = buildKnowledgeRewriteActionInput({
      intent: 'digest-source',
      selectedPath: 'sources/raw.md',
      workItemPath: 'work/active/release.md',
      assetRunPath: 'runs/assets/build.md',
    });

    expect(input).toContain('消化资料');
    expect(input).toContain('path: sources/raw.md');
    expect(input).toContain('来源事项: work/active/release.md');
    expect(input).toContain('来源资产运行: runs/assets/build.md');
    expect(input).toContain('消化计划');
    expect(input).toContain('读取资料源');
    expect(input).toContain('提取可复用事实');
    expect(input).toContain('对照现有 Wiki/index/log');
    expect(input).toContain('approval_required 或 no_write_needed');
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

  it('builds a source execution instruction for plan execution knowledge updates', () => {
    const instruction = buildKnowledgeTailActionRewriteInstruction({
      workItemPath: 'work/active/release.md',
      tailActionId: 'action-run-knowledge:run-1',
    });

    expect(instruction).toContain('来源事项 work/active/release.md');
    expect(instruction).toContain('来源执行记录 action-run-knowledge:run-1');
    expect(instruction).toContain('no_write_needed');
  });

  it('includes source ActionRun details in source execution knowledge update instructions', () => {
    const instruction = buildKnowledgeTailActionRewriteInstruction({
      workItemPath: 'work/active/release.md',
      tailActionId: 'action-run-knowledge:gateway-run-1',
      sourceRunResultSummary: '发布检查完成，发现部署手册缺少回滚步骤。',
      sourceRunAssistantResponse: '建议把回滚命令和验证清单写入 wiki/runbooks/release.md。',
    } as Parameters<typeof buildKnowledgeTailActionRewriteInstruction>[0] & {
      sourceRunAssistantResponse: string;
      sourceRunResultSummary: string;
    });

    expect(instruction).toContain('来源执行结果摘要');
    expect(instruction).toContain('发布检查完成，发现部署手册缺少回滚步骤。');
    expect(instruction).toContain('来源执行助手回复');
    expect(instruction).toContain('建议把回滚命令和验证清单写入 wiki/runbooks/release.md。');
  });

  it('builds an asset-run-only instruction for knowledge tail actions', () => {
    const instruction = buildKnowledgeTailActionRewriteInstruction({
      assetRunPath: 'runs/assets/20260629-010203-tools-release-check-sh.md',
      tailActionId: 'action-run-knowledge:asset-run-card',
      sourceAssetRunMarkdown: [
        '# Release check',
        '',
        'status: succeeded',
        'result: 发现发布检查脚本缺少回滚验证。',
      ].join('\n'),
    });

    expect(instruction).toContain('来源资产运行 runs/assets/20260629-010203-tools-release-check-sh.md');
    expect(instruction).toContain('来源执行记录 action-run-knowledge:asset-run-card');
    expect(instruction).toContain('来源资产运行内容');
    expect(instruction).toContain('发现发布检查脚本缺少回滚验证。');
    expect(instruction).toContain('读取来源资产运行、相关执行结果和现有知识库');
    expect(instruction).toContain('no_write_needed');
    expect(instruction).not.toContain('来源事项 undefined');
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
    const page = readFileSync('src/pages/KnowledgeBasePage.tsx', 'utf8');

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
    expect(source).toContain('createAiActionRunWithWorkItemAssignment({');
    expect(page).toContain('getRequestedKnowledgePath');
    expect(page).toContain('initialKnowledgePath={requestedKnowledgePath}');
    expect(source).toContain('initialKnowledgePath?: string | null');
    expect(source).toContain('snapshot.sources.some((file) => file.path === initialKnowledgePath)');
    expect(source).toContain('snapshot.wiki.some((file) => file.path === initialKnowledgePath)');
    expect(source).toContain('openDocument(initialKnowledgePath)');
  });

  it('wires URL clipping to best-effort Electron webpage fetching before import', () => {
    const panel = readFileSync('src/components/KnowledgeRepositoryPanel.tsx', 'utf8');
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const handlers = readFileSync('electron/repository-handlers.ts', 'utf8');
    const env = readFileSync('src/vite-env.d.ts', 'utf8');

    expect(panel).toContain('fetchKnowledgeUrl');
    expect(panel).toContain('fetched: fetchedUrlContent');
    expect(preload).toContain("ipcRenderer.invoke('repository:fetchKnowledgeUrl'");
    expect(handlers).toContain("ipcMain.handle('repository:fetchKnowledgeUrl'");
    expect(handlers).toContain('extractReadableTextFromHtml');
    expect(env).toContain('fetchKnowledgeUrl?:');
  });

  it('keeps approved knowledge write paths observable in Action Center summaries', () => {
    const actionCenter = readFileSync('src/pages/ActionCenterPage.tsx', 'utf8');
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    expect(actionCenter).toContain('formatKnowledgeRewriteWrittenPaths(writeResult.writtenPaths)');
    expect(actionCenter).toContain('paths:');
    expect(zh).toContain('{{paths}}');
    expect(en).toContain('{{paths}}');
  });
});
