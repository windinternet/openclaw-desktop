import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop self-knowledge UI integration', () => {
  it('wires Desktop self-knowledge sync into store, connection flow, and Control Center actions', () => {
    const store = readFileSync('src/lib/store.ts', 'utf8');
    const mainPage = readFileSync('src/pages/MainPage.tsx', 'utf8');
    const repositoryProtocolPage = readFileSync('src/pages/RepositoryProtocolPage.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(store).toContain('syncDesktopSelfKnowledgeWithCompanion');
    expect(store).toContain('syncDesktopSelfKnowledgeForInstance');
    expect(store).toContain('[syncDesktopSelfKnowledgeForInstance]');
    expect(mainPage).toContain('syncDesktopSelfKnowledgeForInstance(currentId)');
    expect(repositoryProtocolPage).toContain('handleSyncDesktopSelfKnowledge');
    expect(repositoryProtocolPage).toContain('syncDesktopSelfKnowledge');
    expect(zh.controlCenter.syncDesktopSelfKnowledge).toBeTruthy();
    expect(zh.controlCenter.desktopSelfKnowledgeSyncDone).toBeTruthy();
    expect(zh.controlCenter.desktopSelfKnowledgeSyncPartial).toBeTruthy();
    expect(en.controlCenter.syncDesktopSelfKnowledge).toBeTruthy();
    expect(en.controlCenter.desktopSelfKnowledgeSyncDone).toBeTruthy();
    expect(en.controlCenter.desktopSelfKnowledgeSyncPartial).toBeTruthy();
  });
});
