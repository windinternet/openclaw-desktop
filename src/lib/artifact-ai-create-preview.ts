import { parseArtifactsFromText } from './artifact-parser';
import type { GenerateParams } from './artifact-service';
import type { ArtifactExternalFormat, ArtifactReuseKind, ArtifactType } from './artifact-types';

export interface ArtifactAICreatePreview {
  title: string;
  type: ArtifactType;
  description?: string;
  tags?: string[];
  html?: string;
  url?: string;
  command?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  externalFormat?: ArtifactExternalFormat;
  contentSummary?: string;
  reuseKind?: ArtifactReuseKind;
  importFile?: boolean;
}

const HTML_ARTIFACT_TYPES: ArtifactType[] = [
  'report',
  'dashboard',
  'analysis',
  'checklist',
  'code',
  'document',
  'slide',
  'form',
  'other',
];

const ARTIFACT_TYPES: ArtifactType[] = [...HTML_ARTIFACT_TYPES, 'link', 'app', 'file', 'audio', 'image', 'video'];

export function parseArtifactAICreatePreview(response: string | undefined): ArtifactAICreatePreview | null {
  return parseArtifactAICreatePreviews(response).at(-1) ?? null;
}

export function parseArtifactAICreatePreviews(response: string | undefined): ArtifactAICreatePreview[] {
  if (!response?.trim()) return [];

  const parsedArtifacts = parseArtifactsFromText(response);
  if (parsedArtifacts.length > 0) {
    return parsedArtifacts.map((artifact) => ({
      title: artifact.title,
      type: artifact.type,
      description: artifact.description,
      tags: artifact.tags,
      html: artifact.html,
      url: artifact.url,
      command: artifact.command,
      filePath: artifact.filePath,
      fileName: artifact.fileName,
      fileSize: artifact.fileSize,
      mimeType: artifact.mimeType,
      externalFormat: artifact.externalFormat,
      contentSummary: artifact.contentSummary,
      reuseKind: artifact.reuseKind,
      importFile: artifact.importFile,
    }));
  }

  return parseLegacyAiActionPreviews(response);
}

export function normalizeArtifactAICreatePreviewDraft(preview: ArtifactAICreatePreview): ArtifactAICreatePreview {
  return {
    ...preview,
    title: preview.title.trim(),
    description: trimmedStringValue(preview.description),
    tags: normalizeTags(preview.tags),
    url: trimmedStringValue(preview.url),
    command: trimmedStringValue(preview.command),
    filePath: trimmedStringValue(preview.filePath),
    fileName: trimmedStringValue(preview.fileName),
    mimeType: trimmedStringValue(preview.mimeType),
    contentSummary: trimmedStringValue(preview.contentSummary),
  };
}

export function buildArtifactAICreateGenerateParams(
  preview: ArtifactAICreatePreview,
  sourceRunId?: string,
): GenerateParams {
  const normalizedPreview = normalizeArtifactAICreatePreviewDraft(preview);
  return {
    title: normalizedPreview.title,
    type: normalizedPreview.type,
    description: normalizedPreview.description,
    tags: normalizedPreview.tags,
    html: normalizedPreview.html,
    url: normalizedPreview.url,
    command: normalizedPreview.command,
    filePath: normalizedPreview.filePath,
    fileName: normalizedPreview.fileName,
    fileSize: normalizedPreview.fileSize,
    mimeType: normalizedPreview.mimeType,
    externalFormat: normalizedPreview.externalFormat,
    contentSummary: normalizedPreview.contentSummary,
    reuseKind: normalizedPreview.reuseKind,
    importFile: normalizedPreview.importFile,
    source: { type: 'action_run', id: sourceRunId, name: 'AI 魔法创建' },
  };
}

function parseLegacyAiActionPreviews(response: string): ArtifactAICreatePreview[] {
  const previews: ArtifactAICreatePreview[] = [];
  const blocks = Array.from(response.matchAll(/```ai-action\s*([\s\S]*?)```/gi));
  for (const block of blocks) {
    try {
      const obj = JSON.parse(block[1].trim());
      const result = obj.result;
      if (!result || typeof result.title !== 'string' || !isValidArtifactType(result.type)) continue;
      if (HTML_ARTIFACT_TYPES.includes(result.type) && typeof result.html !== 'string') continue;
      previews.push({
        title: result.title,
        type: result.type,
        description: stringValue(result.description),
        tags: Array.isArray(result.tags) ? result.tags.map(String) : undefined,
        html: stringValue(result.html),
        url: stringValue(result.url),
        command: stringValue(result.command),
        filePath: stringValue(result.filePath),
        fileName: stringValue(result.fileName),
        fileSize: numberValue(result.fileSize),
        mimeType: stringValue(result.mimeType),
        externalFormat: isValidExternalFormat(result.externalFormat) ? result.externalFormat : undefined,
        contentSummary: stringValue(result.contentSummary),
        reuseKind: isValidReuseKind(result.reuseKind) ? result.reuseKind : undefined,
        importFile: result.importFile === true,
      });
    } catch {
      /* skip invalid ai-action blocks */
    }
  }
  return previews;
}

function isValidArtifactType(type: unknown): type is ArtifactType {
  return typeof type === 'string' && ARTIFACT_TYPES.includes(type as ArtifactType);
}

function isValidExternalFormat(format: unknown): format is ArtifactExternalFormat {
  const valid: ArtifactExternalFormat[] = [
    'html',
    'link',
    'app',
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
  ];
  return typeof format === 'string' && valid.includes(format as ArtifactExternalFormat);
}

function isValidReuseKind(kind: unknown): kind is ArtifactReuseKind {
  const valid: ArtifactReuseKind[] = ['asset', 'template', 'tool', 'script', 'workflow'];
  return typeof kind === 'string' && valid.includes(kind as ArtifactReuseKind);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function trimmedStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTags(tags: string[] | undefined): string[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  const normalized = tags.map((tag) => tag.trim()).filter(Boolean);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
}
