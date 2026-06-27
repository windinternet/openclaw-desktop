import type { ArtifactMeta, VersionEntry } from './artifact-types';

export function buildArtifactVersionHistory(meta: ArtifactMeta): VersionEntry[] {
  if (meta.versions?.length) {
    return [...meta.versions].sort((a, b) => a.version - b.version);
  }

  const createdBy = artifactVersionCreator(meta);
  return Array.from({ length: Math.max(meta.currentVersion, 1) }, (_, index) => {
    const version = index + 1;
    return {
      version,
      label: version === 1 ? 'Initial version' : `Version ${version}`,
      createdBy,
      createdAt: meta.createdAt,
    };
  });
}

export function nextArtifactVersionHistory(meta: ArtifactMeta, entry: VersionEntry): VersionEntry[] {
  const versions = buildArtifactVersionHistory(meta).filter((version) => version.version !== entry.version);
  return [...versions, entry].sort((a, b) => a.version - b.version);
}

export function createInitialArtifactVersion(meta: Pick<ArtifactMeta, 'source' | 'createdAt'>): VersionEntry {
  return {
    version: 1,
    label: 'Initial version',
    createdBy: artifactVersionCreator(meta),
    createdAt: meta.createdAt,
  };
}

export function artifactVersionCreator(meta: Pick<ArtifactMeta, 'source'>): 'ai' | 'user' {
  return meta.source.type === 'manual' ? 'user' : 'ai';
}
