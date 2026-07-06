import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artifact skill lint boundaries', () => {
  it('routes artifact skill write outcomes through the preload log bridge', () => {
    const source = readFileSync('src/lib/artifact-skill.ts', 'utf8');

    expect(source).toMatch(/window\.electronAPI\?\.log\?\.send\(\s*'INFO'/);
    expect(source).toMatch(/window\.electronAPI\?\.log\?\.send\(\s*'WARN'/);
    expect(source).toMatch(/window\.electronAPI\?\.log\?\.send\(\s*'ERROR'/);
    expect(source).toContain('[Artifact Skill] Written locally');
    expect(source).toContain('[Artifact Skill] Local write failed, trying RPC:');
    expect(source).toContain('[Artifact Skill] Written via RPC:');
    expect(source).toContain('[Artifact Skill] RPC also failed:');
    expect(source).not.toContain('console.');
  });
});
