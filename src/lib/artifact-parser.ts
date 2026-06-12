import type { ArtifactType, ArtifactMeta } from './artifact-types';
import { artifactService, getDefaultIcon } from './artifact-service';

interface ParsedArtifact {
  title: string;
  type: ArtifactType;
  icon: string;
  description?: string;
  tags: string[];
  html: string;
}

export function parseArtifactFromText(text: string): ParsedArtifact | null {
  const match = text.match(/<artifact>\s*(\{[\s\S]*?\})\s*([\s\S]*?)<\/artifact>/i);
  if (!match) return null;

  try {
    const header = JSON.parse(match[1].trim());
    const html = match[2].trim();

    if (!header.title || !html) return null;

    return {
      title: String(header.title),
      type: isValidArtifactType(header.type) ? header.type : 'other',
      icon: String(header.icon ?? getDefaultIcon(header.type ?? 'other')),
      description: header.description ? String(header.description) : undefined,
      tags: Array.isArray(header.tags) ? header.tags.map(String) : [],
      html,
    };
  } catch {
    return null;
  }
}

export async function saveArtifactFromChat(
  parsed: ParsedArtifact,
  sourceType: 'chat' | 'mcp_tool' = 'chat',
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
    source: { type: sourceType, id: sourceId, name: sourceName },
  });
}

function isValidArtifactType(type: unknown): type is ArtifactType {
  const validTypes = ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'];
  return typeof type === 'string' && validTypes.includes(type);
}
