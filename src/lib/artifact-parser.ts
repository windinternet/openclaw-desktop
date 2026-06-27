import type { ArtifactType, ArtifactMeta, ArtifactSource } from './artifact-types';
import { artifactService, getDefaultIcon } from './artifact-service';

export interface ParsedArtifact {
  title: string;
  type: ArtifactType;
  icon: string;
  description?: string;
  tags: string[];
  html: string;
  url?: string;
  command?: string;
  filePath?: string;
  fileName?: string;
  mimeType?: string;
}

export function parseArtifactFromText(text: string): ParsedArtifact | null {
  return parseArtifactsFromText(text)[0] ?? null;
}

export function parseArtifactsFromText(text: string): ParsedArtifact[] {
  const artifacts: ParsedArtifact[] = [];
  const matches = text.matchAll(/<artifact>\s*(\{[\s\S]*?\})\s*([\s\S]*?)<\/artifact>/gi);

  for (const match of matches) {
    const parsed = parseArtifactBlock(match[1], match[2]);
    if (parsed) artifacts.push(parsed);
  }

  return artifacts;
}

function parseArtifactBlock(headerText: string, bodyText: string): ParsedArtifact | null {
  try {
    const header = JSON.parse(headerText.trim());
    const html = bodyText.trim();

    if (!header.title) return null;
    const htmlTypes = ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'];
    if (header.type && !htmlTypes.includes(header.type)) {
      // Non-HTML types don't require html
    } else if (!html) {
      return null;
    }

    return {
      title: String(header.title),
      type: isValidArtifactType(header.type) ? header.type : 'other',
      icon: String(header.icon ?? getDefaultIcon(header.type ?? 'other')),
      description: header.description ? String(header.description) : undefined,
      tags: Array.isArray(header.tags) ? header.tags.map(String) : [],
      html,
      url: header.url ? String(header.url) : undefined,
      command: header.command ? String(header.command) : undefined,
      filePath: header.filePath ? String(header.filePath) : undefined,
      fileName: header.fileName ? String(header.fileName) : undefined,
      mimeType: header.mimeType ? String(header.mimeType) : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveArtifactFromChat(
  parsed: ParsedArtifact,
  sourceType: ArtifactSource['type'] = 'chat',
  sourceId?: string,
  sourceName?: string,
): Promise<ArtifactMeta> {
  return artifactService.generate({
    title: parsed.title,
    type: parsed.type,
    icon: parsed.icon,
    description: parsed.description,
    tags: parsed.tags,
    html: parsed.html,
    url: parsed.url,
    command: parsed.command,
    filePath: parsed.filePath,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    source: { type: sourceType, id: sourceId, name: sourceName },
  });
}

function isValidArtifactType(type: unknown): type is ArtifactType {
  const validTypes = [
    'report',
    'dashboard',
    'analysis',
    'checklist',
    'code',
    'document',
    'slide',
    'form',
    'other',
    'link',
    'app',
    'file',
    'audio',
    'image',
    'video',
  ];
  return typeof type === 'string' && validTypes.includes(type);
}
