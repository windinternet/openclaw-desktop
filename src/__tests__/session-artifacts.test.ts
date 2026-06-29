import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { collectChatArtifactCandidates, filterArtifactsForSessionKeys } from '../lib/session-artifacts';

describe('session artifact helpers', () => {
  it('collects completed assistant artifact blocks from structured chat content', () => {
    const candidates = collectChatArtifactCandidates([
      {
        id: 'msg-1',
        role: 'assistant',
        status: 'completed',
        sourceSessionKey: 'agent:main:demo',
        content: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: '<artifact>\n{"title":"销售报告","type":"report"}\n<!doctype html><html><body>ok</body></html>\n</artifact>',
              },
            ],
          },
        ],
      },
      {
        id: 'msg-2',
        role: 'user',
        status: 'completed',
        sourceSessionKey: 'agent:main:demo',
        content: '<artifact>{"title":"用户草稿"}</artifact>',
      },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual(
      expect.objectContaining({
        key: 'agent:main:demo:msg-1:销售报告',
        sourceSessionKey: 'agent:main:demo',
        sourceMessageId: 'msg-1',
      }),
    );
    expect(candidates[0].parsed.title).toBe('销售报告');
  });

  it('collects every artifact block from one completed assistant message', () => {
    const candidates = collectChatArtifactCandidates([
      {
        id: 'msg-1',
        role: 'assistant',
        status: 'completed',
        sourceSessionKey: 'agent:main:demo',
        content: [
          '<artifact>',
          '{"title":"周报","type":"report"}',
          '<!doctype html><html><body>report</body></html>',
          '</artifact>',
          '<artifact>',
          '{"title":"执行清单","type":"checklist"}',
          '<!doctype html><html><body>checklist</body></html>',
          '</artifact>',
        ].join('\n'),
      },
    ]);

    expect(candidates.map((candidate) => candidate.parsed.title)).toEqual(['周报', '执行清单']);
    expect(candidates.map((candidate) => candidate.key)).toEqual([
      'agent:main:demo:msg-1:周报',
      'agent:main:demo:msg-1:执行清单',
    ]);
  });

  it('matches saved artifacts back to the current session detail page', () => {
    const artifacts: ArtifactMeta[] = [
      {
        id: 'art_1',
        title: '销售报告',
        icon: '📊',
        type: 'report',
        source: { type: 'chat', id: 'agent:main:demo', name: 'msg-1' },
        tags: [],
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'art_2',
        title: '其他报告',
        icon: '📊',
        type: 'report',
        source: { type: 'chat', id: 'agent:main:other', name: 'msg-2' },
        tags: [],
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    expect(filterArtifactsForSessionKeys(artifacts, ['agent:main:demo']).map((item) => item.id)).toEqual(['art_1']);
  });

  it('routes chat artifact autosave through the store creation path so repository mirroring can run', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');

    expect(source).toContain('const generateArtifact = useStore((s) => s.generateArtifact)');
    expect(source).toContain('void generateArtifact(');
    expect(source).not.toContain('saveArtifactFromChat(candidate.parsed');
  });
});
