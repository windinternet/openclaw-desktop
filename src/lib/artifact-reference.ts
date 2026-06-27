import type { ArtifactMeta } from './artifact-types';

export interface ArtifactReuseReference {
  uri: string;
  markdown: string;
}

export function buildArtifactReuseReference(artifact: ArtifactMeta): ArtifactReuseReference {
  const uri = `artifact://${artifact.id}`;
  const lastReuseEvent = artifact.reuseEvents?.[artifact.reuseEvents.length - 1];
  const lastExecutionEvent = artifact.executionEvents?.[artifact.executionEvents.length - 1];
  const lines = [
    `- [${artifact.title}](${uri})`,
    `  - artifactId: ${artifact.id}`,
    `  - type: ${artifact.type}`,
    artifact.reuseKind ? `  - reuseKind: ${artifact.reuseKind}` : undefined,
    artifact.externalFormat ? `  - format: ${artifact.externalFormat}` : undefined,
    artifact.contentSummary ? `  - summary: ${artifact.contentSummary}` : undefined,
    `  - source: ${formatSource(artifact)}`,
    artifact.repositoryOutputPath ? `  - repositoryOutput: ${artifact.repositoryOutputPath}` : undefined,
    artifact.repositoryPreviewPath ? `  - repositoryPreview: ${artifact.repositoryPreviewPath}` : undefined,
    artifact.reuseEvents?.length ? `  - reuseEvents: ${artifact.reuseEvents.length}` : undefined,
    lastReuseEvent ? `  - lastReuse: ${lastReuseEvent.context}/${lastReuseEvent.status}` : undefined,
    artifact.executionEvents?.length ? `  - executionEvents: ${artifact.executionEvents.length}` : undefined,
    lastExecutionEvent ? `  - lastExecution: ${lastExecutionEvent.status}` : undefined,
    artifact.fileInspection
      ? `  - fileInspection: ${artifact.fileInspection.sourceKind}/${artifact.fileInspection.previewStatus}`
      : undefined,
    artifact.fileInspection?.limitations.length
      ? `  - fileInspectionLimitations: ${artifact.fileInspection.limitations.join(', ')}`
      : undefined,
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
