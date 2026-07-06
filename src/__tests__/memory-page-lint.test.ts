import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('MemoryPage lint boundaries', () => {
  it('routes file read failures through the preload log bridge', () => {
    const source = readFileSync('src/pages/MemoryPage.tsx', 'utf8');

    expect(source).toMatch(/window\.electronAPI\?\.log\?\.send\(\s*'ERROR'/);
    expect(source).toContain('[MemoryPage] read file error:');
    expect(source).not.toContain('console.error');
  });
});
