import type { ArtifactMeta } from './artifact-types';

export type ArtifactExportType = 'html' | 'markdown' | 'json' | 'text';

export interface ResolvedArtifactExportRequest {
  type: ArtifactExportType;
  fileName: string;
  content: string;
  mimeType: string;
  filters: Array<{ name: string; extensions: string[] }>;
  bytes: number;
}

const EXPORT_TYPES: Record<
  ArtifactExportType,
  { extension: string; mimeType: string; filterName: string; aliases: string[] }
> = {
  html: { extension: 'html', mimeType: 'text/html', filterName: 'HTML', aliases: ['html', 'htm'] },
  markdown: { extension: 'md', mimeType: 'text/markdown', filterName: 'Markdown', aliases: ['markdown', 'md'] },
  json: { extension: 'json', mimeType: 'application/json', filterName: 'JSON', aliases: ['json'] },
  text: { extension: 'txt', mimeType: 'text/plain', filterName: 'Text', aliases: ['text', 'txt'] },
};

const INVALID_FILE_NAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

export function resolveArtifactExportRequest(
  params: Record<string, unknown>,
  artifact: ArtifactMeta,
  currentHtml: string | null | undefined,
): ResolvedArtifactExportRequest {
  const type = normalizeExportType(params.type);
  const definition = EXPORT_TYPES[type];
  const content = normalizeExportContent(params.content, type, currentHtml);
  const preferredFileName = typeof params.fileName === 'string' ? params.fileName : '';
  const fileName = sanitizeExportFileName(
    preferredFileName,
    preferredFileName ? true : false,
    artifact.title || artifact.id,
    definition.extension,
  );

  return {
    type,
    fileName,
    content,
    mimeType:
      typeof params.mimeType === 'string' && params.mimeType.trim() ? params.mimeType.trim() : definition.mimeType,
    filters: [{ name: definition.filterName, extensions: [definition.extension] }],
    bytes: Buffer.byteLength(content, 'utf-8'),
  };
}

function normalizeExportType(value: unknown): ArtifactExportType {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    for (const [type, definition] of Object.entries(EXPORT_TYPES)) {
      if (definition.aliases.includes(normalized)) return type as ArtifactExportType;
    }
  }
  return 'html';
}

function normalizeExportContent(value: unknown, type: ArtifactExportType, currentHtml: string | null | undefined): string {
  if (typeof value === 'string') return value;
  if (value !== undefined && value !== null) {
    return type === 'json' ? JSON.stringify(value, null, 2) : String(value);
  }
  return currentHtml ?? '';
}

function sanitizeExportFileName(
  preferredFileName: string,
  isPathLike: boolean,
  fallbackBase: string,
  extension: string,
): string {
  const rawBase = preferredFileName.trim() || fallbackBase.trim() || 'artifact-export';
  const base = isPathLike ? rawBase.split(/[\\/]+/).filter(Boolean).pop() ?? rawBase : rawBase;
  const sanitized =
    base
      .split('')
      .map((char) => (INVALID_FILE_NAME_CHARS.has(char) || char.charCodeAt(0) < 32 ? '_' : char))
      .join('')
      .trim() || 'artifact-export';
  return sanitized.toLowerCase().endsWith(`.${extension}`) ? sanitized : `${sanitized}.${extension}`;
}
