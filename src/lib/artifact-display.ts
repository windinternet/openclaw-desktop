import type { ArtifactMeta } from './artifact-types';
import { buildArtifactValueSummary } from './artifact-value-summary';

const GENERIC_VALUE_SUMMARIES = new Set([
  'HTML',
  'Link',
  'App',
  'Word',
  'Excel',
  'PowerPoint',
  'PDF',
  'Image',
  'Audio',
  'Video',
  'Text',
  'Code',
  'File',
  'Unknown',
]);

export function buildArtifactOutputDescription(artifact: ArtifactMeta): string {
  const inferredSummary = meaningfulSummary(buildArtifactValueSummary(artifact));

  return firstNonEmpty(
    artifact.contentSummary,
    inferredSummary,
    artifact.repositoryOutputPath,
    artifact.repositoryPreviewPath,
    artifact.url,
    artifact.command,
    artifact.fileName,
    artifact.filePath,
    artifact.description,
    artifact.type,
  );
}

export function buildArtifactDisplayLine(artifact: ArtifactMeta, dateLabel?: string): string {
  const value = buildArtifactOutputDescription(artifact);
  const parts = [
    value,
    artifact.repositoryOutputPath,
    artifact.repositoryPreviewPath,
    formatArtifactSource(artifact),
    dateLabel,
  ];

  return dedupe(parts.filter((part): part is string => Boolean(part))).join(' · ');
}

function formatArtifactSource(artifact: ArtifactMeta): string {
  const id = artifact.source.id ? `/${artifact.source.id}` : '';
  const name = artifact.source.name ? ` ${artifact.source.name}` : '';
  return `${artifact.source.type}${id}${name}`;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => Boolean(value?.trim())) ?? '';
}

function meaningfulSummary(value?: string): string | undefined {
  if (!value || GENERIC_VALUE_SUMMARIES.has(value)) return undefined;
  return value;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
