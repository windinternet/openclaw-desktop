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

  it('reads text only from imported artifact storage copies', () => {
    const handler = readFileSync('electron/artifact-handlers.ts', 'utf8');
    const ipc = readFileSync('src/lib/artifact-ipc.ts', 'utf8');
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const persistence = readFileSync('src/lib/artifact-persistence.ts', 'utf8');

    expect(ipc).toContain("READ_IMPORTED_TEXT: 'artifact:readImportedText'");
    expect(handler).toContain('ARTIFACT_IPC.READ_IMPORTED_TEXT');
    expect(handler).toContain('filesDir(artifactId)');
    expect(handler).toContain('path.resolve(meta.filePath)');
    expect(handler).toContain('readSync');
    expect(preload).toContain('artifact:readImportedText');
    expect(preload).toContain('readImportedText');
    expect(persistence).toContain('readImportedText');
  });
});
