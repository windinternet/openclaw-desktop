import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('store lint guardrails', () => {
  it('routes store diagnostics through the preload log bridge', () => {
    const source = readFileSync('src/lib/store.ts', 'utf8');

    expect(source).toContain('function logStore(level: string, ...args: unknown[]): void');
    expect(source).toContain('window.electronAPI?.log?.send(level, ...args);');
    expect(source).toContain("logStore('WARN', '[syncRepositoryContextForInstance]'");
    expect(source).toContain("logStore('ERROR', '[fetchSessions]', err);");
    expect(source).not.toContain('console.');
  });
});
