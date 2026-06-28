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

export function buildArtifactAICreateGenerateParams(
  preview: ArtifactAICreatePreview,
  sourceRunId?: string,
): GenerateParams {
  return {
    title: preview.title,
    type: preview.type,
    description: preview.description,
    tags: preview.tags,
    html: preview.html,
    url: preview.url,
    command: preview.command,
    filePath: preview.filePath,
    fileName: preview.fileName,
    fileSize: preview.fileSize,
    mimeType: preview.mimeType,
    externalFormat: preview.externalFormat,
    contentSummary: preview.contentSummary,
    reuseKind: preview.reuseKind,
    importFile: preview.importFile,
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

function numberValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
}
