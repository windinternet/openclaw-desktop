import type { ArtifactMeta } from './artifact-types';

export interface ArtifactReuseReference {
  uri: string;
  markdown: string;
}

export function buildArtifactReuseReference(artifact: ArtifactMeta): ArtifactReuseReference {
  const uri = `artifact://${artifact.id}`;
  const lines = [
    `- [${artifact.title}](${uri})`,
    `  - artifactId: ${artifact.id}`,
    `  - type: ${artifact.type}`,
    artifact.externalFormat ? `  - format: ${artifact.externalFormat}` : undefined,
    artifact.contentSummary ? `  - summary: ${artifact.contentSummary}` : undefined,
    `  - source: ${formatSource(artifact)}`,
    artifact.repositoryOutputPath ? `  - repositoryOutput: ${artifact.repositoryOutputPath}` : undefined,
    artifact.repositoryPreviewPath ? `  - repositoryPreview: ${artifact.repositoryPreviewPath}` : undefined,
    artifact.fileName ? `  - fileName: ${artifact.fileName}` : undefined,
    artifact.filePath ? `  - filePath: ${artifact.filePath}` : undefined,
    artifact.url ? `  - url: ${artifact.url}` : undefined,
    artifact.command ? `  - command: ${artifact.command}` : undefined,
    artifact.tags.length > 0 ? `  - tags: ${artifact.tags.join(', ')}` : undefined,
  ];

  return {
    uri,
    markdown: lines.filter((line): line is string => typeof line === 'string').join('\n'),
  };
}

function formatSource(artifact: ArtifactMeta): string {
  const sourceId = artifact.source.id ? `/${artifact.source.id}` : '';
  const sourceName = artifact.source.name ? ` ${artifact.source.name}` : '';
  return `${artifact.source.type}${sourceId}${sourceName}`;
}
