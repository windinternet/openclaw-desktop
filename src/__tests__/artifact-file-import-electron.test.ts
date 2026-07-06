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
    expect(handler).toContain('extractLegacyWordTextFromBuffer');
    expect(handler).toContain('await readImportedArtifactText(artifactId)');
    expect(handler).toContain('readImportedArtifactLegacyWordText');
    expect(handler).toContain('isLegacyWordArtifact(meta, format)');
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

  it('reads native thumbnails for imported PDF, Office, and media copies through macOS Quick Look', () => {
    const handler = readFileSync('electron/artifact-handlers.ts', 'utf8');
    const ipc = readFileSync('src/lib/artifact-ipc.ts', 'utf8');
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const persistence = readFileSync('src/lib/artifact-persistence.ts', 'utf8');

    expect(ipc).toContain("READ_IMPORTED_NATIVE_THUMBNAIL: 'artifact:readImportedNativeThumbnail'");
    expect(handler).toContain('ARTIFACT_IPC.READ_IMPORTED_NATIVE_THUMBNAIL');
    expect(handler).toContain('readImportedArtifactNativeThumbnail');
    expect(handler).toContain("process.platform !== 'darwin'");
    expect(handler).toContain("execFileSync('qlmanage'");
    expect(handler).toContain('resolveImportedArtifactStorageFile(artifactId)');
    expect(handler).toContain('inferArtifactExternalFormat(meta)');
    expect(handler).toContain('artifact format is not native-thumbnailable');
    expect(handler).toContain('MAX_NATIVE_THUMBNAIL_BYTES');
    expect(preload).toContain('artifact:readImportedNativeThumbnail');
    expect(preload).toContain('readImportedNativeThumbnail');
    expect(persistence).toContain('readImportedNativeThumbnail');
  });

  it('reads PDF document previews only from imported artifact storage copies', () => {
    const handler = readFileSync('electron/artifact-handlers.ts', 'utf8');
    const ipc = readFileSync('src/lib/artifact-ipc.ts', 'utf8');
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const persistence = readFileSync('src/lib/artifact-persistence.ts', 'utf8');

    expect(ipc).toContain("READ_IMPORTED_DOCUMENT_PREVIEW: 'artifact:readImportedDocumentPreview'");
    expect(handler).toContain('ARTIFACT_IPC.READ_IMPORTED_DOCUMENT_PREVIEW');
    expect(handler).toContain('readImportedArtifactDocumentPreview');
    expect(handler).toContain('MAX_IMPORTED_PDF_PREVIEW_BYTES');
    expect(handler).toContain('filesDir(artifactId)');
    expect(handler).toContain('path.resolve(meta.filePath)');
    expect(handler).toContain('data:application/pdf;base64');
    expect(preload).toContain('artifact:readImportedDocumentPreview');
    expect(preload).toContain('readImportedDocumentPreview');
    expect(persistence).toContain('readImportedDocumentPreview');
  });

  it('serves imported artifact files through a read-only artifact-file protocol', () => {
    const handler = readFileSync('electron/artifact-handlers.ts', 'utf8');

    expect(handler).toContain("protocol.handle('artifact-file'");
    expect(handler).toContain('^art_[a-z0-9]+$');
    expect(handler).toContain('resolveImportedArtifactStorageFile(artifactId)');
    expect(handler).toContain('inferArtifactExternalFormat(meta)');
    expect(handler).toContain('artifact-file protocol only serves imported PDF and media files');
    expect(handler).toContain("'content-type': mimeType");
    expect(handler).toContain('readFileSync(targetPath)');
  });

  it('supports range responses for imported artifact-file PDF and media streaming', () => {
    const handler = readFileSync('electron/artifact-handlers.ts', 'utf8');

    expect(handler).toContain("request.headers.get('range')");
    expect(handler).toContain('resolveArtifactFileRangeRequest(stat.size');
    expect(handler).toContain('status: 206');
    expect(handler).toContain("'content-range': range.contentRange");
    expect(handler).toContain("'accept-ranges': 'bytes'");
    expect(handler).toContain('readImportedArtifactFileRange(targetPath, range.start, range.length)');
    expect(handler).toContain('status: 416');
    expect(handler).toContain("'content-range': range.contentRange");
  });
});
