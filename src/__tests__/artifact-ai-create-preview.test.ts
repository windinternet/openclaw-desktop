import { describe, expect, it } from 'vitest';
import { buildArtifactAICreateGenerateParams, parseArtifactAICreatePreview } from '../lib/artifact-ai-create-preview';

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
