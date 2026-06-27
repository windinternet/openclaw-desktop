import type { ArtifactMeta, ArtifactType } from './artifact-types';

export type ArtifactOpenTarget =
  | {
      kind: 'html-preview';
      artifactId: string;
      version: number;
    }
  | {
      kind: 'local-file';
      path: string;
    }
  | {
      kind: 'external-url';
      url: string;
    }
  | {
      kind: 'unavailable';
      reason: 'missing-meta' | 'missing-file-or-url';
    };

const HTML_TYPES = new Set<ArtifactType>([
  'report',
  'dashboard',
  'analysis',
  'checklist',
  'code',
  'document',
  'slide',
  'form',
  'other',
]);

export function isHtmlArtifactType(type: ArtifactType): boolean {
  return HTML_TYPES.has(type);
}

export function decideArtifactOpenTarget(meta: ArtifactMeta | null, version?: number): ArtifactOpenTarget {
  if (!meta) {
    return { kind: 'unavailable', reason: 'missing-meta' };
  }

  if (isHtmlArtifactType(meta.type)) {
    return {
      kind: 'html-preview',
      artifactId: meta.id,
      version: version ?? meta.currentVersion,
    };
  }

  if (meta.filePath) {
    return {
      kind: 'local-file',
      path: meta.filePath,
    };
  }

  if (meta.url) {
    return {
      kind: 'external-url',
      url: meta.url,
    };
  }

  return { kind: 'unavailable', reason: 'missing-file-or-url' };
}
