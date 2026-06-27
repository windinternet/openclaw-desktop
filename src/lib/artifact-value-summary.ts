import type { ArtifactExternalFormat, ArtifactType } from './artifact-types';

export interface ArtifactValueSummaryInput {
  type: ArtifactType;
  url?: string;
  command?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  externalFormat?: ArtifactExternalFormat;
}

const HTML_TYPES: ArtifactType[] = [
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

export function inferArtifactExternalFormat(input: ArtifactValueSummaryInput): ArtifactExternalFormat {
  if (input.externalFormat) return input.externalFormat;
  if (input.type === 'link') return 'link';
  if (input.type === 'app') return 'app';
  if (input.type === 'image') return 'image';
  if (input.type === 'audio') return 'audio';
  if (input.type === 'video') return 'video';
  if (HTML_TYPES.includes(input.type)) return input.type === 'code' ? 'code' : 'html';

  const mime = input.mimeType?.toLowerCase() ?? '';
  const ext = extensionFromName(input.fileName ?? input.filePath);

  if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
    return 'powerpoint';
  }
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv' ||
    ['xls', 'xlsx', 'csv'].includes(ext)
  ) {
    return 'excel';
  }
  if (mime.includes('word') || mime.includes('msword') || ['doc', 'docx', 'rtf'].includes(ext)) {
    return 'word';
  }
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
  if (mime.startsWith('text/') || ['txt', 'md', 'markdown'].includes(ext)) return 'text';
  if (['json', 'js', 'jsx', 'ts', 'tsx', 'py', 'sh', 'sql', 'html', 'css'].includes(ext)) return 'code';

  return input.type === 'file' ? 'file' : 'unknown';
}

export function buildArtifactValueSummary(input: ArtifactValueSummaryInput): string | undefined {
  const format = inferArtifactExternalFormat(input);
  const label = FORMAT_LABELS[format];

  if (input.type === 'link') {
    const host = safeHost(input.url);
    return host ? `${label} · ${host}` : label;
  }

  if (input.type === 'app') {
    return input.command ? `${label} · ${compact(input.command, 64)}` : label;
  }

  const name = input.fileName ?? fileNameFromPath(input.filePath);
  if (name) {
    const parts = [label, name];
    const size = formatFileSize(input.fileSize);
    if (size) parts.push(size);
    return parts.join(' · ');
  }

  if (input.url) {
    const host = safeHost(input.url);
    return host ? `${label} · ${host}` : label;
  }

  return format === 'unknown' ? undefined : label;
}

function extensionFromName(value?: string): string {
  const name = fileNameFromPath(value);
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index + 1).toLowerCase() : '';
}

function fileNameFromPath(value?: string): string {
  if (!value) return '';
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function safeHost(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function compact(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function formatFileSize(size?: number): string | null {
  if (size === undefined || !Number.isFinite(size) || size < 0) return null;
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${formatNumber(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${formatNumber(mb)} MB`;
  return `${formatNumber(mb / 1024)} GB`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/u, '');
}
