import type { ArtifactMeta, ArtifactReuseKind } from './artifact-types';
import { buildArtifactSearchText } from './artifact-display';

export type ArtifactReuseKindFilter = ArtifactReuseKind | 'all';

export interface ArtifactListFilterOptions {
  typeFilter: ArtifactMeta['type'] | 'all' | string;
  reuseKindFilter: ArtifactReuseKindFilter;
  search: string;
}

export function filterArtifactList(artifacts: ArtifactMeta[], options: ArtifactListFilterOptions): ArtifactMeta[] {
  const query = options.search.trim().toLowerCase();
  return artifacts
    .filter((artifact) => {
      if (options.typeFilter !== 'all' && artifact.type !== options.typeFilter) return false;
      if (options.reuseKindFilter !== 'all' && artifact.reuseKind !== options.reuseKindFilter) return false;
      if (query && !buildArtifactSearchText(artifact).includes(query)) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
