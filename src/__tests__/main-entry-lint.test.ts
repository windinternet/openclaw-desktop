import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('main entry lint guardrails', () => {
  it('uses the typed preload API for external link mode hydration', () => {
    const main = readFileSync('src/main.tsx', 'utf8');
    const viteEnv = readFileSync('src/vite-env.d.ts', 'utf8');

    expect(main).toContain('window.electronAPI?.setExternalLinkMode?.');
    expect(main).not.toContain('window as any');
    expect(viteEnv).toContain("setExternalLinkMode?: (mode: import('./lib/settings-types').ExternalLinkMode) => void");
  });
});
