import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

describe('knowledge digest queue', () => {
  it('surfaces undigested sources as a first-class Knowledge view', () => {
    const panel = readFileSync('src/components/KnowledgeRepositoryPanel.tsx', 'utf8');
    const page = readFileSync('src/pages/KnowledgeBasePage.tsx', 'utf8');
    const repositoryKnowledge = readFileSync('src/lib/repository-knowledge.ts', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(repositoryKnowledge).toContain('undigestedSources');
    expect(panel).toContain("| 'digest'");
    expect(panel).toContain('snapshot?.undigestedSources');
    expect(panel).toContain("t('knowledge.digestQueue')");
    expect(panel).toContain("t('knowledge.digestThisSource')");
    expect(panel).toContain("handleKnowledgeRewrite('digest-source', file.path)");
    expect(page).toContain("section === 'digest'");
    expect(page).toContain('itemKey="digest"');
    expect(getByPath(zh, 'knowledge.digestQueue')).toBeTruthy();
    expect(getByPath(zh, 'knowledge.digestThisSource')).toBeTruthy();
    expect(getByPath(en, 'knowledge.digestQueue')).toBeTruthy();
    expect(getByPath(en, 'knowledge.digestThisSource')).toBeTruthy();
  });
});
