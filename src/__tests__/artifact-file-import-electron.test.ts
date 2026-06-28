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
    expect(handler).toContain('MAX_IMPORTED_PDF_TEXT_BYTES');
    expect(handler).toContain('extractPdfTextFromBuffer');
    expect(handler).toContain('MAX_IMPORTED_OOXML_TEXT_BYTES');
    expect(handler).toContain('extractOoxmlTextFromBuffer');
    expect(preload).toContain('artifact:readImportedText');
    expect(preload).toContain('readImportedText');
    expect(persistence).toContain('readImportedText');
  });

  it('reads file facts only from imported artifact storage copies', () => {
    const handler = readFileSync('electron/artifact-handlers.ts', 'utf8');
    const ipc = readFileSync('src/lib/artifact-ipc.ts', 'utf8');
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const persistence = readFileSync('src/lib/artifact-persistence.ts', 'utf8');

    expect(ipc).toContain("READ_IMPORTED_FILE_FACTS: 'artifact:readImportedFileFacts'");
    expect(handler).toContain('ARTIFACT_IPC.READ_IMPORTED_FILE_FACTS');
    expect(handler).toContain('readImportedArtifactFileFacts');
    expect(handler).toContain('createHash');
    expect(handler).toContain('MAX_PDF_FACT_SCAN_BYTES');
    expect(handler).toContain('detectPdfFacts');
    expect(handler).toContain('filesDir(artifactId)');
    expect(handler).toContain('path.resolve(meta.filePath)');
    expect(preload).toContain('artifact:readImportedFileFacts');
    expect(preload).toContain('readImportedFileFacts');
    expect(persistence).toContain('readImportedFileFacts');
  });

  it('reads image thumbnails only from imported artifact storage copies', () => {
    const handler = readFileSync('electron/artifact-handlers.ts', 'utf8');
    const ipc = readFileSync('src/lib/artifact-ipc.ts', 'utf8');
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const persistence = readFileSync('src/lib/artifact-persistence.ts', 'utf8');

    expect(ipc).toContain("READ_IMPORTED_IMAGE_THUMBNAIL: 'artifact:readImportedImageThumbnail'");
    expect(handler).toContain('ARTIFACT_IPC.READ_IMPORTED_IMAGE_THUMBNAIL');
    expect(handler).toContain('readImportedArtifactImageThumbnail');
    expect(handler).toContain('MAX_IMAGE_THUMBNAIL_BYTES');
    expect(handler).toContain('filesDir(artifactId)');
    expect(handler).toContain('path.resolve(meta.filePath)');
    expect(preload).toContain('artifact:readImportedImageThumbnail');
    expect(preload).toContain('readImportedImageThumbnail');
    expect(persistence).toContain('readImportedImageThumbnail');
  });
});
