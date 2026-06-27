import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artifact Electron file import handler', () => {
  it('copies imported files into the artifact storage directory', () => {
    const handler = readFileSync('electron/artifact-handlers.ts', 'utf8');
    const ipc = readFileSync('src/lib/artifact-ipc.ts', 'utf8');
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const persistence = readFileSync('src/lib/artifact-persistence.ts', 'utf8');

    expect(ipc).toContain("IMPORT_FILE: 'artifact:importFile'");
    expect(handler).toContain('ARTIFACT_IPC.IMPORT_FILE');
    expect(handler).toContain('copyFileSync');
    expect(handler).toContain('statSync');
    expect(preload).toContain('artifact:importFile');
    expect(persistence).toContain('importFile');
  });
});
