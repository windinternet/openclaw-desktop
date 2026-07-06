import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('user profile lint boundaries', () => {
  it('routes USER.md profile read failures through the preload log bridge', () => {
    const source = readFileSync('src/lib/user.ts', 'utf8');

    expect(source).toMatch(/window\.electronAPI\?\.log\?\.send\(\s*'WARN'/);
    expect(source).toMatch(/window\.electronAPI\?\.log\?\.send\(\s*'ERROR'/);
    expect(source).toContain('USER.md not found');
    expect(source).toContain('USER.md is empty');
    expect(source).toContain('failed for agent');
    expect(source).not.toContain('console.warn');
    expect(source).not.toContain('console.error');
  });

  it('reuses the static gateway client import instead of creating a split-point that Rollup cannot use', () => {
    const source = readFileSync('src/lib/user.ts', 'utf8');

    expect(source).toContain("import { createGatewayClient, type GatewayClient } from './gateway';");
    expect(source).not.toContain("await import('./gateway')");
  });
});
