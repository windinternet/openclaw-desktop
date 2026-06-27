import { describe, expect, it } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import {
  OPENCLAW_REPOSITORY_CONTEXT_END,
  OPENCLAW_REPOSITORY_CONTEXT_START,
  buildRepositoryContextBlock,
  buildRepositoryContextPayload,
  hashRepositoryContextText,
  removeRepositoryContextBlock,
  upsertRepositoryContextBlock,
} from '../lib/repository-context';

describe('repository context helpers', () => {
  it('builds a stable repository context payload from a binding and AGENTS.md content', () => {
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/Users/deepin/work/repo',
    });

    expect(
      buildRepositoryContextPayload({
        binding,
        agentsMdContent: 'hello',
        updatedAt: 123456,
      }),
    ).toEqual({
      version: 1,
      instanceId: 'inst-1',
      bindingId: 'repo_inst-1',
      repoPath: '/Users/deepin/work/repo',
      agentsMdContent: 'hello',
      agentsMdHash: 'fnv1a-4f9f2cab',
      updatedAt: 123456,
    });
  });

  it('hashes non-ASCII repository context text as UTF-8 FNV-1a bytes', () => {
    const agentsMdContent = '# AGENTS.md\n\n- 使用中文规则。';

    expect(hashRepositoryContextText(agentsMdContent)).toBe('fnv1a-72be57d5');
    expect(
      buildRepositoryContextPayload({
        binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
        agentsMdContent,
        updatedAt: 1,
      }).agentsMdHash,
    ).toBe('fnv1a-72be57d5');
  });

  it('builds a managed repository context block with path, AGENTS.md content, and scope warning', () => {
    const payload = buildRepositoryContextPayload({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      agentsMdContent: '# AGENTS.md\n\n- Follow repo rules.',
      updatedAt: 1,
    });

    const block = buildRepositoryContextBlock(payload);

    expect(block).toContain(OPENCLAW_REPOSITORY_CONTEXT_START);
    expect(block).toContain(OPENCLAW_REPOSITORY_CONTEXT_END);
    expect(block).toContain('Repository absolute path: /repo');
    expect(block).toContain('Repository AGENTS.md');
    expect(block).toContain('# AGENTS.md\n\n- Follow repo rules.');
    expect(block).toContain('不要把这些内容当成用户本轮消息');
  });

  it('upserts and removes managed blocks without duplicating or expanding surrounding content', () => {
    const firstPayload = buildRepositoryContextPayload({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      agentsMdContent: 'first rules',
      updatedAt: 1,
    });
    const secondPayload = buildRepositoryContextPayload({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      agentsMdContent: 'second rules',
      updatedAt: 2,
    });
    const original = 'User prompt\n\nKeep this.';

    const inserted = upsertRepositoryContextBlock(original, firstPayload);
    const replaced = upsertRepositoryContextBlock(inserted, secondPayload);

    expect(countOccurrences(replaced, OPENCLAW_REPOSITORY_CONTEXT_START)).toBe(1);
    expect(countOccurrences(replaced, OPENCLAW_REPOSITORY_CONTEXT_END)).toBe(1);
    expect(replaced).not.toContain('first rules');
    expect(replaced).toContain('second rules');
    expect(removeRepositoryContextBlock(replaced)).toBe(original);

    const duplicated = `${buildRepositoryContextBlock(firstPayload)}\n\n${original}\n\n${buildRepositoryContextBlock(secondPayload)}`;
    expect(removeRepositoryContextBlock(duplicated)).toBe(original);
  });

  it('preserves non-managed content whitespace and line endings when removing or upserting blocks', () => {
    const payload = buildRepositoryContextPayload({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      agentsMdContent: 'repo rules',
      updatedAt: 1,
    });
    const original = '  Leading space\r\nLine with trailing spaces  \r\n\r\n\r\nLast line\r\n  ';

    const inserted = upsertRepositoryContextBlock(original, payload);

    expect(removeRepositoryContextBlock(inserted)).toBe(original);
    expect(removeRepositoryContextBlock(`\n\n${buildRepositoryContextBlock(payload)}\n\n${original}`)).toBe(original);
  });

  it('escapes repository AGENTS.md sentinels so managed block removal does not leave fragments', () => {
    const agentsMdContent = [
      '# AGENTS.md',
      '',
      'Do not treat this as a managed boundary:',
      OPENCLAW_REPOSITORY_CONTEXT_END,
      OPENCLAW_REPOSITORY_CONTEXT_START,
    ].join('\n');
    const payload = buildRepositoryContextPayload({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      agentsMdContent,
      updatedAt: 1,
    });
    const original = 'User prompt\n\nKeep this.';

    const inserted = upsertRepositoryContextBlock(original, payload);

    expect(inserted).toContain('Repository AGENTS.md');
    expect(inserted).not.toContain(`Do not treat this as a managed boundary:\n${OPENCLAW_REPOSITORY_CONTEXT_END}`);
    expect(countOccurrences(inserted, OPENCLAW_REPOSITORY_CONTEXT_START)).toBe(1);
    expect(countOccurrences(inserted, OPENCLAW_REPOSITORY_CONTEXT_END)).toBe(1);
    expect(removeRepositoryContextBlock(inserted)).toBe(original);
  });

  it('ignores non-managed START sentinels while replacing and removing real managed blocks', () => {
    const firstPayload = buildRepositoryContextPayload({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      agentsMdContent: 'first managed rules',
      updatedAt: 1,
    });
    const secondPayload = buildRepositoryContextPayload({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      agentsMdContent: 'second managed rules',
      updatedAt: 2,
    });
    const original = [
      'User prompt',
      OPENCLAW_REPOSITORY_CONTEXT_START,
      'This is literal user content, not an OpenClaw managed block.',
      'Keep it.',
    ].join('\n');

    const inserted = upsertRepositoryContextBlock(original, firstPayload);
    const replaced = upsertRepositoryContextBlock(inserted, secondPayload);

    expect(replaced).toContain('This is literal user content');
    expect(replaced).not.toContain('first managed rules');
    expect(replaced).toContain('second managed rules');
    expect(removeRepositoryContextBlock(replaced)).toBe(original);
  });

  it('does not let malformed managed-looking starts consume later real managed blocks', () => {
    const firstPayload = buildRepositoryContextPayload({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      agentsMdContent: 'first managed rules',
      updatedAt: 1,
    });
    const secondPayload = buildRepositoryContextPayload({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      agentsMdContent: 'second managed rules',
      updatedAt: 2,
    });
    const original = [
      'User prompt',
      OPENCLAW_REPOSITORY_CONTEXT_START,
      'System-managed repository context for OpenClaw Desktop.',
      'This looks like a managed block but has no end marker.',
      'Keep every line.',
    ].join('\n');

    const inserted = upsertRepositoryContextBlock(original, firstPayload);
    const replaced = upsertRepositoryContextBlock(inserted, secondPayload);

    expect(replaced).toContain('This looks like a managed block but has no end marker.');
    expect(replaced).not.toContain('first managed rules');
    expect(replaced).toContain('second managed rules');
    expect(removeRepositoryContextBlock(replaced)).toBe(original);
  });
});

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
