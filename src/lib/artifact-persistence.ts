import type { ArtifactMeta } from './artifact-types';
import type { ArtifactContentReadResult } from './artifact-content-extract';
import type { ArtifactContentFactsReadResult } from './artifact-content-facts';
import type { ArtifactThumbnailReadResult } from './artifact-thumbnail';

interface ArtifactApi {
  open: (artifactId: string, version: number) => Promise<number>;
  getMeta: (artifactId: string) => Promise<ArtifactMeta | null>;
  getHtml: (artifactId: string, version?: number) => Promise<string | null>;
  saveMeta: (artifactId: string, meta: ArtifactMeta) => Promise<void>;
  saveHtml: (artifactId: string, version: number, html: string) => Promise<void>;
  importFile: (
    artifactId: string,
    sourcePath: string,
    preferredFileName?: string,
  ) => Promise<Pick<ArtifactMeta, 'filePath' | 'fileName' | 'fileSize' | 'mimeType'>>;
  readImportedText: (artifactId: string) => Promise<ArtifactContentReadResult>;
  readImportedFileFacts: (artifactId: string) => Promise<ArtifactContentFactsReadResult>;
  readImportedImageThumbnail: (artifactId: string) => Promise<ArtifactThumbnailReadResult>;
  list: () => Promise<ArtifactMeta[]>;
  updateIndex: (entries: ArtifactMeta[]) => Promise<void>;
}

function getApi(): ArtifactApi {
  const api = (window as unknown as { electronAPI?: { artifact?: ArtifactApi } }).electronAPI?.artifact;
  if (!api) throw new Error('electronAPI.artifact not available');
  return api;
}

export const artifactPersistence = {
  async list(): Promise<ArtifactMeta[]> {
    return getApi().list();
  },

  async saveMeta(artifactId: string, meta: ArtifactMeta): Promise<void> {
    await getApi().saveMeta(artifactId, meta);
  },

  async loadMeta(artifactId: string): Promise<ArtifactMeta | null> {
    return getApi().getMeta(artifactId);
  },

  async saveHtml(artifactId: string, version: number, html: string): Promise<void> {
    await getApi().saveHtml(artifactId, version, html);
  },

  async importFile(
    artifactId: string,
    sourcePath: string,
    preferredFileName?: string,
  ): Promise<Pick<ArtifactMeta, 'filePath' | 'fileName' | 'fileSize' | 'mimeType'>> {
    return getApi().importFile(artifactId, sourcePath, preferredFileName);
  },

  async readImportedText(artifactId: string): Promise<ArtifactContentReadResult> {
    return getApi().readImportedText(artifactId);
  },

  async readImportedFileFacts(artifactId: string): Promise<ArtifactContentFactsReadResult> {
    return getApi().readImportedFileFacts(artifactId);
  },

  async readImportedImageThumbnail(artifactId: string): Promise<ArtifactThumbnailReadResult> {
    return getApi().readImportedImageThumbnail(artifactId);
  },

  async loadHtml(artifactId: string, version?: number): Promise<string | null> {
    return getApi().getHtml(artifactId, version);
  },

  async updateIndex(entries: ArtifactMeta[]): Promise<void> {
    await getApi().updateIndex(entries);
  },

  openWindow(artifactId: string, version: number): Promise<number> {
    return getApi().open(artifactId, version);
  },
};
