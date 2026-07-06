import type { ArtifactExternalFormat, ArtifactMeta, ArtifactReuseKind } from './artifact-types';
import { formatArtifactPdfFacts } from './artifact-content-facts';
import { describeArtifactThumbnail } from './artifact-thumbnail';
import { buildArtifactValueHealth } from './artifact-value-health';
import { buildArtifactValueSummary, inferArtifactExternalFormat } from './artifact-value-summary';

export type ArtifactPreviewPrimaryAction = 'preview_html' | 'open_file' | 'open_link' | 'copy_command' | 'view_detail';
export type ArtifactPdfViewerZoom = 'page-width' | '100' | '150' | '200';

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
  thumbnailKind?: string;
  thumbnailSummary?: string;
  documentPreviewAvailable?: boolean;
  documentPreviewSummary?: string;
}

export type ArtifactNativePreviewPanel =
  | {
      kind: 'image_thumbnail';
      title: string;
      imageUrl: string;
      alt: string;
      summary: string;
      safetyNote: string;
    }
  | {
      kind: 'content_extract';
      title: string;
      formatLabel: string;
      summary: string;
      snippet: string;
      stats: string;
      safetyNote: string;
    }
  | {
      kind: 'content_facts';
      title: string;
      formatLabel: string;
      summary: string;
      facts: string[];
      safetyNote: string;
    }
  | {
      kind: 'media_embed';
      mediaType: 'audio' | 'video';
      title: string;
      formatLabel: string;
      mediaUrl: string;
      summary: string;
      facts?: string[];
      safetyNote: string;
    }
  | {
      kind: 'document_embed';
      documentType: 'pdf';
      title: string;
      formatLabel: string;
      documentUrl: string;
      summary: string;
      viewerLabel: string;
      pageSummary?: string;
      pageCount?: number;
      safetyNote: string;
    };

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
  const thumbnail = describeArtifactThumbnail(artifact);
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
    thumbnail?.kind,
    thumbnail?.summary,
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
    safetyNote: resolvePreviewSafetyNote(primaryAction, artifact, format),
  };
}

export function buildArtifactAgentPreviewCard(artifact: ArtifactMeta): ArtifactAgentPreviewCard {
  const { thumbnailUrl, ...previewCard } = buildArtifactPreviewCard(artifact);
  const thumbnail = describeArtifactThumbnail(artifact);
  const documentPreviewAvailable =
    artifact.documentPreview?.format === 'pdf' &&
    artifact.documentPreview.dataUrl.trim().startsWith('data:application/pdf');
  return {
    ...previewCard,
    thumbnailAvailable: thumbnailUrl ? true : undefined,
    thumbnailKind: thumbnail?.kind,
    thumbnailSummary: thumbnail?.summary,
    documentPreviewAvailable: documentPreviewAvailable ? true : undefined,
    documentPreviewSummary: documentPreviewAvailable ? artifact.documentPreview?.summary : undefined,
  };
}

export function buildArtifactNativePreviewPanel(artifact: ArtifactMeta): ArtifactNativePreviewPanel | undefined {
  const previewCard = buildArtifactPreviewCard(artifact);
  const format = inferArtifactExternalFormat(artifact);
  if (previewCard.thumbnailUrl) {
    const placeholderThumbnail = describeArtifactThumbnail(artifact)?.kind === 'format-placeholder';
    return {
      kind: 'image_thumbnail',
      title: format === 'image' ? '图片预览' : placeholderThumbnail ? '格式占位缩略图' : '文件缩略图',
      imageUrl: previewCard.thumbnailUrl,
      alt: artifact.fileName ?? artifact.title,
      summary: previewCard.summary,
      safetyNote: resolveThumbnailPanelSafetyNote(format, placeholderThumbnail),
    };
  }

  const documentPanel = buildDocumentEmbedPreviewPanel(artifact, format, previewCard.summary);
  if (documentPanel) return documentPanel;

  const mediaPanel = buildMediaEmbedPreviewPanel(artifact, format, previewCard.summary);
  if (mediaPanel) return mediaPanel;

  if (artifact.contentExtract?.snippet.trim()) {
    return {
      kind: 'content_extract',
      title: `${FORMAT_LABELS[artifact.contentExtract.format]} 文本预览`,
      formatLabel: FORMAT_LABELS[artifact.contentExtract.format],
      summary: artifact.contentExtract.summary,
      snippet: artifact.contentExtract.snippet,
      stats: [
        `${artifact.contentExtract.bytesRead} B`,
        `${artifact.contentExtract.textLength} chars`,
        artifact.contentExtract.truncated ? 'truncated' : undefined,
      ]
        .filter(Boolean)
        .join(' · '),
      safetyNote: '使用导入副本抽取的只读文本预览，不打开原始文件，也不会执行任何内容。',
    };
  }

  if (artifact.contentFacts) {
    const facts = buildContentFactsPreviewItems(artifact);
    if (facts.length > 0) {
      return {
        kind: 'content_facts',
        title: `${FORMAT_LABELS[artifact.contentFacts.format]} 文件事实`,
        formatLabel: FORMAT_LABELS[artifact.contentFacts.format],
        summary: artifact.contentFacts.summary,
        facts,
        safetyNote: '使用导入副本记录的只读文件事实，不打开原始文件，也不会执行任何内容。',
      };
    }
  }

  return undefined;
}

function resolveThumbnailPanelSafetyNote(format: ArtifactExternalFormat, placeholderThumbnail: boolean): string {
  if (format === 'image') return '使用导入副本生成的只读缩略图预览，不打开原始文件，也不会执行任何内容。';
  if (placeholderThumbnail) return '使用安全格式占位缩略图预览，不渲染文件内容，不打开原始文件，也不会执行任何内容。';
  return '使用导入副本生成的只读原生缩略图预览，不打开原始文件，也不会执行任何内容。';
}

function buildDocumentEmbedPreviewPanel(
  artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
  summary: string,
): ArtifactNativePreviewPanel | undefined {
  const pdfViewer = buildPdfViewerDetails(artifact);
  const documentSummary = artifact.contentSummary ?? summary;
  if (
    artifact.documentPreview?.format === 'pdf' &&
    artifact.documentPreview.dataUrl.trim().startsWith('data:application/pdf')
  ) {
    return {
      kind: 'document_embed',
      documentType: 'pdf',
      title: 'PDF 原生预览',
      formatLabel: FORMAT_LABELS.pdf,
      documentUrl: appendPdfViewerFragment(artifact.documentPreview.dataUrl.trim()),
      summary: artifact.documentPreview.summary,
      ...pdfViewer,
      safetyNote: '使用 Artifact storage 导入副本生成的只读 PDF 预览，不读取任意本机路径，不执行任何内容。',
    };
  }
  if (format === 'pdf' && artifact.filePath && artifact.originalFilePath) {
    return {
      kind: 'document_embed',
      documentType: 'pdf',
      title: 'PDF 原生预览',
      formatLabel: FORMAT_LABELS.pdf,
      documentUrl: appendPdfViewerFragment(`artifact-file://${artifact.id}/imported`),
      summary: documentSummary,
      ...pdfViewer,
      safetyNote: '使用 Artifact storage 导入副本的只读文件协议预览 PDF，不读取任意本机路径，不执行任何内容。',
    };
  }
  if (format !== 'pdf' || !artifact.url?.trim()) return undefined;
  return {
    kind: 'document_embed',
    documentType: 'pdf',
    title: 'PDF 原生预览',
    formatLabel: FORMAT_LABELS.pdf,
    documentUrl: appendPdfViewerFragment(artifact.url.trim()),
    summary: documentSummary,
    ...pdfViewer,
    safetyNote: '使用浏览器内建 PDF 查看器预览显式 PDF URL，不读取任意本机路径，不执行任何内容。',
  };
}

function buildPdfViewerDetails(artifact: ArtifactMeta): {
  viewerLabel: string;
  pageSummary?: string;
  pageCount?: number;
} {
  return {
    viewerLabel: '第 1 页 · 适合宽度',
    pageSummary: formatArtifactPdfFacts(artifact.contentFacts?.pdfInfo)?.replace(/, /g, ' · '),
    pageCount: artifact.contentFacts?.pdfInfo?.pageCount,
  };
}

export function buildPdfViewerUrl(url: string, options: { page?: number; zoom?: ArtifactPdfViewerZoom } = {}): string {
  const page = normalizePdfViewerPage(options.page);
  const zoom = options.zoom ?? 'page-width';
  const [baseUrl, fragment = ''] = url.split('#');
  const params = new URLSearchParams(fragment);
  params.set('page', String(page));
  params.set('zoom', zoom);
  return `${baseUrl}#${params.toString()}`;
}

function appendPdfViewerFragment(url: string): string {
  return buildPdfViewerUrl(url);
}

function normalizePdfViewerPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

function buildMediaEmbedPreviewPanel(
  artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
  summary: string,
): ArtifactNativePreviewPanel | undefined {
  if (format !== 'audio' && format !== 'video' && artifact.type !== 'audio' && artifact.type !== 'video')
    return undefined;
  const mediaType = format === 'video' || artifact.type === 'video' ? 'video' : 'audio';
  const facts = buildContentFactsPreviewItems(artifact);
  if (artifact.filePath && artifact.originalFilePath) {
    return {
      kind: 'media_embed',
      mediaType,
      title: mediaType === 'video' ? '视频预览' : '音频预览',
      formatLabel: FORMAT_LABELS[mediaType],
      mediaUrl: `artifact-file://${artifact.id}/imported`,
      summary,
      facts: facts.length > 0 ? facts : undefined,
      safetyNote: '使用 Artifact storage 导入副本的只读文件协议预览媒体，不自动播放，不执行任何内容。',
    };
  }
  if (!artifact.url?.trim()) return undefined;
  return {
    kind: 'media_embed',
    mediaType,
    title: mediaType === 'video' ? '视频预览' : '音频预览',
    formatLabel: FORMAT_LABELS[mediaType],
    mediaUrl: artifact.url.trim(),
    summary,
    facts: facts.length > 0 ? facts : undefined,
    safetyNote: '使用浏览器内建媒体控件预览显式媒体 URL，不自动播放，不执行任何内容。',
  };
}

function buildContentFactsPreviewItems(artifact: ArtifactMeta): string[] {
  const facts = artifact.contentFacts;
  if (!facts) return [];
  return [
    ...splitFactList(formatArtifactPdfFacts(facts.pdfInfo)),
    facts.imageDimensions
      ? `${facts.imageDimensions.width}x${facts.imageDimensions.height} ${facts.imageDimensions.kind}`
      : undefined,
    facts.fileSize !== undefined ? `${facts.fileSize} B` : undefined,
    facts.sha256 ? `sha256 ${facts.sha256.slice(0, 12)}` : undefined,
    facts.signatureHex ? `signature ${facts.signatureHex}` : undefined,
  ].filter((item): item is string => Boolean(item?.trim()));
}

function splitFactList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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
  if (hasBrowserPdfDetailPreview(artifact, format) || hasBrowserMediaDetailPreview(artifact, format)) {
    return 'view_detail';
  }
  if (artifact.type === 'link' || format === 'link') return 'open_link';
  if (artifact.type === 'app' || format === 'app') return 'copy_command';
  if (FILE_LIKE_FORMATS.has(format) || ['file', 'audio', 'image', 'video'].includes(artifact.type)) return 'open_file';
  if (HTML_PREVIEW_TYPES.has(artifact.type)) return 'preview_html';
  return 'view_detail';
}

function resolvePreviewSafetyNote(
  action: ArtifactPreviewPrimaryAction,
  artifact?: ArtifactMeta,
  format?: ArtifactExternalFormat,
): string | undefined {
  if (artifact && format && hasBrowserPdfDetailPreview(artifact, format)) {
    return '可在 Artifact 详情页使用浏览器内建 PDF 查看器只读预览，不读取任意本机路径，也不会执行任何内容。';
  }
  if (artifact && format && hasBrowserMediaDetailPreview(artifact, format)) {
    return '可在 Artifact 详情页使用浏览器内建媒体控件只读预览，不自动播放，也不会执行任何内容。';
  }
  if (action === 'open_file') return '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。';
  if (action === 'copy_command') return '命令只会复制给用户确认，不会由 Desktop 静默执行。';
  return undefined;
}

function hasBrowserPdfDetailPreview(artifact: ArtifactMeta, format: ArtifactExternalFormat): boolean {
  if (format !== 'pdf') return false;
  if (
    artifact.documentPreview?.format === 'pdf' &&
    artifact.documentPreview.dataUrl.trim().startsWith('data:application/pdf')
  ) {
    return true;
  }
  if (artifact.url?.trim()) return true;
  return Boolean(artifact.filePath && artifact.originalFilePath);
}

function hasBrowserMediaDetailPreview(artifact: ArtifactMeta, format: ArtifactExternalFormat): boolean {
  if (format !== 'audio' && format !== 'video' && artifact.type !== 'audio' && artifact.type !== 'video') return false;
  if (artifact.url?.trim()) return true;
  return Boolean(artifact.filePath && artifact.originalFilePath);
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
