import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artifact Electron open handler', () => {
  it('routes file artifacts to system handlers instead of always opening an HTML preview window', () => {
    const source = readFileSync('electron/artifact-handlers.ts', 'utf8');

    expect(source).toContain('decideArtifactOpenTarget');
    expect(source).toContain('shell.openPath');
    expect(source).toContain('shell.openExternal');
    expect(source).toContain("case 'html-preview'");
    expect(source).toContain("case 'local-file'");
    expect(source).toContain("case 'external-url'");
  });
});
