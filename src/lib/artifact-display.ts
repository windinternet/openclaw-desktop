import type { ArtifactExternalFormat, ArtifactMeta, ArtifactReuseKind } from './artifact-types';
import { formatArtifactPdfFacts } from './artifact-content-facts';
import { buildArtifactValueHealth } from './artifact-value-health';
import { buildArtifactValueSummary, inferArtifactExternalFormat } from './artifact-value-summary';

export type ArtifactPreviewPrimaryAction = 'preview_html' | 'open_file' | 'open_link' | 'copy_command' | 'view_detail';

export interface ArtifactPreviewCard {
  formatLabel: string;
  thumbnailLabel: string;
  thumbnailUrl?: string;
  summary: string;
  location?: string;
  primaryAction: ArtifactPreviewPrimaryAction;
  actionLabel: string;
  safetyNote?: string;
}

export interface ArtifactAgentPreviewCard extends Omit<ArtifactPreviewCard, 'thumbnailUrl'> {
  thumbnailAvailable?: boolean;
}

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

const REUSABLE_ASSET_SEARCH_ALIASES: Record<ArtifactReuseKind, string[]> = {
  asset: ['资产', '通用资产', '可复用资产', '可复用的资产', 'reusable asset'],
  template: ['模板', '模版', '可复用模板', '可复用的模板', 'reusable template'],
  tool: ['工具', '可复用工具', '可复用的工具', 'reusable tool'],
  script: ['脚本', '可复用脚本', '可复用的脚本', 'reusable script'],
  workflow: ['工作流', '流程', '可复用工作流', '可复用的工作流', 'reusable workflow'],
};

export function buildArtifactOutputDescription(artifact: ArtifactMeta): string {
  const inferredSummary = meaningfulSummary(buildArtifactValueSummary(artifact));

  return firstNonEmpty(
    artifact.contentFacts?.summary,
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
    artifact.reuseKind,
    artifact.repositoryOutputPath,
    artifact.repositoryPreviewPath,
    formatArtifactSource(artifact),
    dateLabel,
  ];

  return dedupe(parts.filter((part): part is string => Boolean(part))).join(' · ');
}

export function buildArtifactSearchText(artifact: ArtifactMeta): string {
  const previewCard = buildArtifactPreviewCard(artifact);
  const valueHealth = buildArtifactValueHealth(artifact);
  const fields = [
    artifact.id,
    artifact.title,
    artifact.description,
    artifact.type,
    artifact.status,
    artifact.tags.join(' '),
    buildArtifactOutputDescription(artifact),
    artifact.externalFormat,
    artifact.contentSummary,
    artifact.reuseKind,
    ...buildReusableAssetSearchAliases(artifact.reuseKind),
    artifact.repositoryOutputPath,
    artifact.repositoryPreviewPath,
    artifact.fileName,
    artifact.filePath,
    artifact.originalFilePath,
    artifact.mimeType,
    artifact.fileInspection?.format,
    artifact.fileInspection?.sourceKind,
    artifact.fileInspection?.openBehavior,
    artifact.fileInspection?.previewStatus,
    artifact.fileInspection?.summary,
    artifact.fileInspection?.fileName,
    artifact.fileInspection?.storedPath,
    artifact.fileInspection?.originalPath,
    artifact.fileInspection?.url,
    artifact.fileInspection?.command,
    ...(artifact.fileInspection?.limitations ?? []),
    artifact.contentExtract?.status,
    artifact.contentExtract?.format,
    artifact.contentExtract?.sourceKind,
    artifact.contentExtract?.summary,
    artifact.contentExtract?.fileName,
    artifact.contentExtract?.mimeType,
    artifact.contentExtract?.snippet,
    artifact.contentFacts?.status,
    artifact.contentFacts?.format,
    artifact.contentFacts?.sourceKind,
    artifact.contentFacts?.summary,
    artifact.contentFacts?.fileName,
    artifact.contentFacts?.mimeType,
    artifact.contentFacts?.sha256,
    artifact.contentFacts?.signatureHex,
    artifact.contentFacts?.imageDimensions
      ? `${artifact.contentFacts.imageDimensions.width}x${artifact.contentFacts.imageDimensions.height}`
      : undefined,
    artifact.contentFacts?.imageDimensions?.kind,
    formatArtifactPdfFacts(artifact.contentFacts?.pdfInfo),
    artifact.thumbnail ? 'thumbnail available' : undefined,
    valueHealth.status,
    valueHealth.summary,
    ...valueHealth.strengths,
    ...valueHealth.gaps,
    ...valueHealth.nextActions,
    artifact.previewPlan?.format,
    artifact.previewPlan?.sourceKind,
    artifact.previewPlan?.strategy,
    artifact.previewPlan?.surface,
    artifact.previewPlan?.primaryAction,
    artifact.previewPlan?.summary,
    artifact.previewPlan?.safetyNote,
    ...(artifact.previewPlan?.limitations ?? []),
    ...(artifact.previewPlan?.nextSteps ?? []),
    artifact.url,
    artifact.command,
    formatArtifactSource(artifact),
    previewCard.formatLabel,
    previewCard.thumbnailLabel,
    previewCard.summary,
    previewCard.location,
    previewCard.actionLabel,
    previewCard.safetyNote,
    ...(artifact.enrichmentEvents ?? []).flatMap((event) => [
      event.kind,
      event.status,
      event.format,
      event.reason,
      event.resultSummary,
      event.error,
    ]),
    ...(artifact.executionEvents ?? []).flatMap((event) => [
      event.status,
      event.sourceId,
      event.sourceName,
      event.runner,
      event.command,
      event.approvalTitle,
      event.approvalRisk,
      event.approvalReason,
      event.outputArtifactId,
      event.repositoryOutputPath,
      event.resultSummary,
      event.error,
    ]),
  ];

  return dedupe(fields.filter((field): field is string => Boolean(field?.trim())))
    .join('\n')
    .toLowerCase();
}

function buildReusableAssetSearchAliases(reuseKind?: ArtifactReuseKind): string[] {
  if (!reuseKind) return [];
  return ['可复用资产', '可复用', ...REUSABLE_ASSET_SEARCH_ALIASES[reuseKind]];
}

export function buildArtifactPreviewCard(artifact: ArtifactMeta): ArtifactPreviewCard {
  const format = inferArtifactExternalFormat(artifact);
  const primaryAction = resolvePreviewPrimaryAction(artifact, format);
  const summary = firstNonEmpty(
    artifact.contentFacts?.summary,
    artifact.contentSummary,
    meaningfulSummary(buildArtifactValueSummary({ ...artifact, externalFormat: format })),
    artifact.description,
    artifact.title,
  );

  return {
    formatLabel: FORMAT_LABELS[format],
    thumbnailLabel: THUMBNAIL_LABELS[format],
    thumbnailUrl: resolveThumbnailUrl(artifact),
    summary,
    location: firstNonEmpty(
      artifact.repositoryOutputPath,
      artifact.repositoryPreviewPath,
      artifact.fileName,
      artifact.filePath,
      artifact.originalFilePath,
      artifact.url,
      artifact.command,
    ),
    primaryAction,
    actionLabel: ACTION_LABELS[primaryAction],
    safetyNote: resolvePreviewSafetyNote(primaryAction),
  };
}

export function buildArtifactAgentPreviewCard(artifact: ArtifactMeta): ArtifactAgentPreviewCard {
  const { thumbnailUrl, ...previewCard } = buildArtifactPreviewCard(artifact);
  return {
    ...previewCard,
    thumbnailAvailable: thumbnailUrl ? true : undefined,
  };
}

export function formatArtifactSource(artifact: ArtifactMeta): string {
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

function resolveThumbnailUrl(artifact: ArtifactMeta): string | undefined {
  if (!artifact.thumbnail) return undefined;
  const thumbnail = artifact.thumbnail.trim();
  return thumbnail.startsWith('data:image/') ? thumbnail : undefined;
}

const FORMAT_LABELS: Record<ArtifactExternalFormat, string> = {
  html: 'HTML',
  link: 'Link',
  app: 'App',
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
  pdf: 'PDF',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  text: 'Text',
  code: 'Code',
  file: 'File',
  unknown: 'Unknown',
};

const THUMBNAIL_LABELS: Record<ArtifactExternalFormat, string> = {
  html: 'HTML',
  link: 'LINK',
  app: 'APP',
  word: 'DOC',
  excel: 'XLS',
  powerpoint: 'PPT',
  pdf: 'PDF',
  image: 'IMG',
  audio: 'AUD',
  video: 'VID',
  text: 'TXT',
  code: 'CODE',
  file: 'FILE',
  unknown: 'ART',
};

const ACTION_LABELS: Record<ArtifactPreviewPrimaryAction, string> = {
  preview_html: '预览 HTML',
  open_file: '查看文件',
  open_link: '打开链接',
  copy_command: '复制命令',
  view_detail: '查看详情',
};

const HTML_PREVIEW_TYPES = new Set([
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
const FILE_LIKE_FORMATS = new Set<ArtifactExternalFormat>([
  'word',
  'excel',
  'powerpoint',
  'pdf',
  'image',
  'audio',
  'video',
  'text',
  'code',
  'file',
  'unknown',
]);

function resolvePreviewPrimaryAction(
  artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
): ArtifactPreviewPrimaryAction {
  if (artifact.type === 'link' || format === 'link') return 'open_link';
  if (artifact.type === 'app' || format === 'app') return 'copy_command';
  if (FILE_LIKE_FORMATS.has(format) || ['file', 'audio', 'image', 'video'].includes(artifact.type)) return 'open_file';
  if (HTML_PREVIEW_TYPES.has(artifact.type)) return 'preview_html';
  return 'view_detail';
}

function resolvePreviewSafetyNote(action: ArtifactPreviewPrimaryAction): string | undefined {
  if (action === 'open_file') return '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。';
  if (action === 'copy_command') return '命令只会复制给用户确认，不会由 Desktop 静默执行。';
  return undefined;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
