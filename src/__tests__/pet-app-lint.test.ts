import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('PetApp lint boundaries', () => {
  it('routes sprite preload failures through the preload log bridge', () => {
    const source = readFileSync('src/pet/PetApp.tsx', 'utf8');

    expect(source).toMatch(/window\.electronAPI\?\.log\?\.send\(\s*'ERROR'/);
    expect(source).toContain('Failed to load pet sprites:');
    expect(source).not.toContain('console.error');
  });
});
