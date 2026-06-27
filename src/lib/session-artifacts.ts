import type { ArtifactMeta } from './artifact-types';
import { parseArtifactFromText } from './artifact-parser';
import { extractSessionMessageText } from './session-content';

export type ParsedChatArtifact = NonNullable<ReturnType<typeof parseArtifactFromText>>;

export interface ChatArtifactCandidate {
  key: string;
  sourceSessionKey: string;
  sourceMessageId: string;
  parsed: ParsedChatArtifact;
}

export interface ChatArtifactCandidateSource {
  id: string;
  runId?: string;
  role: string;
  status?: string;
  sourceSessionKey: string;
  content: unknown;
}

function isAssistantRole(role: string): boolean {
  return role !== 'user' && role !== 'system';
}

function isFinalStatus(status?: string): boolean {
  return !status || !['in_progress', 'running', 'streaming'].includes(status);
}

export function collectChatArtifactCandidates(chats: ChatArtifactCandidateSource[]): ChatArtifactCandidate[] {
  const candidates: ChatArtifactCandidate[] = [];

  for (const chat of chats) {
    if (!isAssistantRole(chat.role) || !isFinalStatus(chat.status)) continue;

    const text = extractSessionMessageText(chat.content);
    if (!text || text === '[object Object]') continue;

    const parsed = parseArtifactFromText(text);
    if (!parsed) continue;

    const sourceMessageId = chat.runId || chat.id;
    candidates.push({
      key: `${chat.sourceSessionKey}:${sourceMessageId}:${parsed.title}`,
      sourceSessionKey: chat.sourceSessionKey,
      sourceMessageId,
      parsed,
    });
  }

  return candidates;
}

export function filterArtifactsForSessionKeys(artifacts: ArtifactMeta[], sessionKeys: string[]): ArtifactMeta[] {
  const keySet = new Set(sessionKeys.filter(Boolean));
  return artifacts.filter(
    (artifact) =>
      artifact.source.type === 'chat' && typeof artifact.source.id === 'string' && keySet.has(artifact.source.id),
  );
}
