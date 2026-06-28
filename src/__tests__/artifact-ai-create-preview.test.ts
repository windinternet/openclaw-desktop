import { describe, expect, it } from 'vitest';
import {
  buildArtifactAICreateGenerateParams,
  normalizeArtifactAICreatePreviewDraft,
  parseArtifactAICreatePreview,
  parseArtifactAICreatePreviews,
  selectArtifactAICreatePreviewsForSave,
} from '../lib/artifact-ai-create-preview';

describe('artifact AI create preview', () => {
  it('builds a rich save preview from an artifact block', () => {
    const preview = parseArtifactAICreatePreview(
      [
        '本次生成一个可交互 HTML 仪表盘。',
        '<artifact>',
        JSON.stringify({
          title: '发布验收仪表盘',
          type: 'dashboard',
          description: '用于发布前验收和风险查看',
          tags: ['发布', '验收'],
          externalFormat: 'html',
          contentSummary: 'HTML · 发布验收交互仪表盘',
          reuseKind: 'workflow',
        }),
        '<!doctype html><html><body><button>检查</button></body></html>',
        '</artifact>',
      ].join('\n'),
    );

    expect(preview).toEqual(
      expect.objectContaining({
        title: '发布验收仪表盘',
        type: 'dashboard',
        description: '用于发布前验收和风险查看',
        tags: ['发布', '验收'],
        html: '<!doctype html><html><body><button>检查</button></body></html>',
        externalFormat: 'html',
        contentSummary: 'HTML · 发布验收交互仪表盘',
        reuseKind: 'workflow',
      }),
    );

    expect(buildArtifactAICreateGenerateParams(preview!, 'run-1')).toEqual(
      expect.objectContaining({
        title: '发布验收仪表盘',
        type: 'dashboard',
        html: '<!doctype html><html><body><button>检查</button></body></html>',
        externalFormat: 'html',
        contentSummary: 'HTML · 发布验收交互仪表盘',
        reuseKind: 'workflow',
        source: { type: 'action_run', id: 'run-1', name: 'AI 魔法创建' },
      }),
    );
  });

  it('keeps every rich artifact block as an explicit save candidate', () => {
    const previews = parseArtifactAICreatePreviews(
      [
        '<artifact>',
        JSON.stringify({
          title: '发布验收仪表盘',
          type: 'dashboard',
          externalFormat: 'html',
          contentSummary: 'HTML · 发布验收交互仪表盘',
        }),
        '<!doctype html><html><body>dashboard</body></html>',
        '</artifact>',
        '<artifact>',
        JSON.stringify({
          title: '发布复盘文档',
          type: 'document',
          tags: ['复盘'],
          externalFormat: 'html',
          contentSummary: 'HTML · 发布复盘文档',
        }),
        '<!doctype html><html><body>review</body></html>',
        '</artifact>',
      ].join('\n'),
    );

    expect(previews).toHaveLength(2);
    expect(previews.map((preview) => preview.title)).toEqual(['发布验收仪表盘', '发布复盘文档']);
    expect(previews[0]).toEqual(
      expect.objectContaining({
        type: 'dashboard',
        html: '<!doctype html><html><body>dashboard</body></html>',
        contentSummary: 'HTML · 发布验收交互仪表盘',
      }),
    );
    expect(parseArtifactAICreatePreview('')).toBeNull();
  });

  it('selects multiple edited artifact candidates for explicit batch saving', () => {
    const previews = parseArtifactAICreatePreviews(
      [
        '<artifact>',
        JSON.stringify({
          title: '交互式 HTML 仪表盘',
          type: 'dashboard',
          externalFormat: 'html',
          contentSummary: 'HTML · 可交互推进仪表盘',
        }),
        '<!doctype html><html><body>dashboard</body></html>',
        '</artifact>',
        '<artifact>',
        JSON.stringify({
          title: '路线图链接',
          type: 'link',
          url: ' https://example.com/roadmap ',
          externalFormat: 'link',
          contentSummary: '链接 · 路线图入口',
        }),
        '</artifact>',
        '<artifact>',
        JSON.stringify({
          title: '   ',
          type: 'document',
          externalFormat: 'word',
          fileName: 'brief.docx',
        }),
        '</artifact>',
      ].join('\n'),
    );

    const selected = selectArtifactAICreatePreviewsForSave(previews, [1, 0, 1, 99, -1]);

    expect(selected).toHaveLength(2);
    expect(selected.map((preview) => preview.title)).toEqual(['路线图链接', '交互式 HTML 仪表盘']);
    expect(selected[0]).toEqual(
      expect.objectContaining({
        url: 'https://example.com/roadmap',
        externalFormat: 'link',
      }),
    );
    expect(selected[1]).toEqual(
      expect.objectContaining({
        html: '<!doctype html><html><body>dashboard</body></html>',
        externalFormat: 'html',
      }),
    );
  });

  it('normalizes edited save metadata while keeping generated content', () => {
    const draft = normalizeArtifactAICreatePreviewDraft({
      title: '  用户校正后的复盘文档  ',
      type: 'document',
      description: '  更准确的说明  ',
      tags: [' 复盘 ', '', ' 验收 '],
      html: '<!doctype html><html><body>review</body></html>',
      contentSummary: '  HTML · 可交互复盘文档  ',
    });

    expect(draft).toEqual(
      expect.objectContaining({
        title: '用户校正后的复盘文档',
        description: '更准确的说明',
        tags: ['复盘', '验收'],
        html: '<!doctype html><html><body>review</body></html>',
        contentSummary: 'HTML · 可交互复盘文档',
      }),
    );
    expect(buildArtifactAICreateGenerateParams(draft, 'run-2')).toEqual(
      expect.objectContaining({
        title: '用户校正后的复盘文档',
        description: '更准确的说明',
        tags: ['复盘', '验收'],
        contentSummary: 'HTML · 可交互复盘文档',
        source: { type: 'action_run', id: 'run-2', name: 'AI 魔法创建' },
      }),
    );
  });

  it('preserves user-edited HTML body exactly when saving', () => {
    const editedHtml = '\n<!doctype html>\n<html><body><main>用户校正正文</main></body></html>\n';
    const draft = normalizeArtifactAICreatePreviewDraft({
      title: '  用户校正后的 HTML 产物  ',
      type: 'dashboard',
      html: editedHtml,
      externalFormat: 'html',
      contentSummary: '  HTML · 用户校正正文  ',
    });

    expect(draft.html).toBe(editedHtml);
    expect(buildArtifactAICreateGenerateParams(draft, 'run-html')).toEqual(
      expect.objectContaining({
        title: '用户校正后的 HTML 产物',
        html: editedHtml,
        externalFormat: 'html',
        contentSummary: 'HTML · 用户校正正文',
        source: { type: 'action_run', id: 'run-html', name: 'AI 魔法创建' },
      }),
    );
  });

  it('normalizes user-edited link and file details before saving', () => {
    const draft = normalizeArtifactAICreatePreviewDraft({
      title: '  用户校正后的资料包  ',
      type: 'file',
      url: '  https://example.com/report.xlsx  ',
      command: '  open report.xlsx  ',
      filePath: '  /Users/deepin/Documents/report.xlsx  ',
      fileName: '  report.xlsx  ',
      fileSize: 4096,
      mimeType: '  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  ',
      externalFormat: 'excel',
      reuseKind: 'asset',
      importFile: true,
    });

    expect(draft).toEqual(
      expect.objectContaining({
        title: '用户校正后的资料包',
        url: 'https://example.com/report.xlsx',
        command: 'open report.xlsx',
        filePath: '/Users/deepin/Documents/report.xlsx',
        fileName: 'report.xlsx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        externalFormat: 'excel',
        reuseKind: 'asset',
        importFile: true,
      }),
    );
    expect(buildArtifactAICreateGenerateParams(draft, 'run-file')).toEqual(
      expect.objectContaining({
        url: 'https://example.com/report.xlsx',
        command: 'open report.xlsx',
        filePath: '/Users/deepin/Documents/report.xlsx',
        fileName: 'report.xlsx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        externalFormat: 'excel',
        reuseKind: 'asset',
        importFile: true,
        source: { type: 'action_run', id: 'run-file', name: 'AI 魔法创建' },
      }),
    );
  });

  it('keeps legacy ai-action result parsing for simple artifacts', () => {
    const preview = parseArtifactAICreatePreview(
      [
        '```ai-action',
        JSON.stringify({
          version: 1,
          kind: 'completed',
          result: {
            title: 'OpenClaw 文档',
            type: 'link',
            url: 'https://openclaw.ai/docs',
            description: '官方文档',
            tags: ['docs'],
          },
        }),
        '```',
      ].join('\n'),
    );

    expect(preview).toEqual(
      expect.objectContaining({
        title: 'OpenClaw 文档',
        type: 'link',
        url: 'https://openclaw.ai/docs',
        description: '官方文档',
        tags: ['docs'],
      }),
    );
  });
});
