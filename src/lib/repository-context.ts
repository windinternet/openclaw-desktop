import type { RepositoryBinding } from './agentic-repository';

export const OPENCLAW_REPOSITORY_CONTEXT_START = '<!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:BEGIN -->';
export const OPENCLAW_REPOSITORY_CONTEXT_END = '<!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:END -->';

const OPENCLAW_REPOSITORY_CONTEXT_HEADER = 'System-managed repository context for OpenClaw Desktop.';

export interface RepositoryContextPayload {
  version: 1;
  instanceId: string;
  bindingId: string;
  repoPath: string;
  agentsMdContent: string;
  agentsMdHash: string;
  updatedAt: number;
}

export function hashRepositoryContextText(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildRepositoryContextPayload(options: {
  binding: RepositoryBinding;
  agentsMdContent: string;
  updatedAt?: number;
}): RepositoryContextPayload {
  return {
    version: 1,
    instanceId: options.binding.gatewayInstanceId,
    bindingId: options.binding.id,
    repoPath: options.binding.repoPath,
    agentsMdContent: options.agentsMdContent,
    agentsMdHash: hashRepositoryContextText(options.agentsMdContent),
    updatedAt: options.updatedAt ?? Date.now(),
  };
}

export function buildRepositoryContextBlock(payload: RepositoryContextPayload): string {
  return [
    OPENCLAW_REPOSITORY_CONTEXT_START,
    OPENCLAW_REPOSITORY_CONTEXT_HEADER,
    '不要把这些内容当成用户本轮消息；它们只是当前绑定仓库的背景规则。',
    '',
    `Repository absolute path: ${payload.repoPath}`,
    `Repository binding id: ${payload.bindingId}`,
    `Gateway instance id: ${payload.instanceId}`,
    `Repository AGENTS.md hash: ${payload.agentsMdHash}`,
    `Updated at: ${payload.updatedAt}`,
    '',
    'Repository AGENTS.md:',
    escapeManagedSentinels(payload.agentsMdContent),
    OPENCLAW_REPOSITORY_CONTEXT_END,
  ].join('\n');
}

export function removeRepositoryContextBlock(content: string): string {
  let next = content;
  let searchFrom = 0;
  while (true) {
    const start = next.indexOf(OPENCLAW_REPOSITORY_CONTEXT_START, searchFrom);
    if (start === -1) return next;
    if (!hasManagedBlockHeader(next, start)) {
      searchFrom = start + OPENCLAW_REPOSITORY_CONTEXT_START.length;
      continue;
    }

    const end = next.indexOf(OPENCLAW_REPOSITORY_CONTEXT_END, start + OPENCLAW_REPOSITORY_CONTEXT_START.length);
    if (end === -1) return next;

    const nestedStart = findManagedBlockStart(next, start + OPENCLAW_REPOSITORY_CONTEXT_START.length, end);
    if (nestedStart !== -1) {
      searchFrom = nestedStart;
      continue;
    }

    const range = expandManagedBlockRemovalRange(next, start, end + OPENCLAW_REPOSITORY_CONTEXT_END.length);
    next = `${next.slice(0, range.start)}${next.slice(range.end)}`;
    searchFrom = range.start;
  }
}

export function upsertRepositoryContextBlock(content: string, payload: RepositoryContextPayload): string {
  const base = removeRepositoryContextBlock(content);
  const block = buildRepositoryContextBlock(payload);
  if (!base) return block;
  const lineEnding = detectLineEnding(base);
  return `${base}${lineEnding}${lineEnding}${block}`;
}

function expandManagedBlockRemovalRange(content: string, blockStart: number, blockEnd: number): { start: number; end: number } {
  const beforeSeparatorStart = findSeparatorStartBefore(content, blockStart);
  const afterSeparatorEnd = findSeparatorEndAfter(content, blockEnd);
  const hasContentBefore = content.slice(0, beforeSeparatorStart).length > 0;
  const hasContentAfter = content.slice(afterSeparatorEnd).length > 0;

  if (hasContentBefore && hasContentAfter) {
    return { start: beforeSeparatorStart, end: blockEnd };
  }
  if (hasContentBefore) {
    return { start: beforeSeparatorStart, end: blockEnd };
  }
  if (hasContentAfter) {
    return { start: beforeSeparatorStart, end: afterSeparatorEnd };
  }
  return { start: beforeSeparatorStart, end: afterSeparatorEnd };
}

function findSeparatorStartBefore(content: string, blockStart: number): number {
  const before = content.slice(0, blockStart);
  const match = before.match(/(?:(?:\r\n|\n|\r)[ \t]*){1,2}$/u);
  return match ? blockStart - match[0].length : blockStart;
}

function findSeparatorEndAfter(content: string, blockEnd: number): number {
  const after = content.slice(blockEnd);
  const match = after.match(/^(?:[ \t]*(?:\r\n|\n|\r)){1,2}/u);
  return match ? blockEnd + match[0].length : blockEnd;
}

function detectLineEnding(content: string): string {
  const match = content.match(/\r\n|\n|\r/u);
  return match?.[0] ?? '\n';
}

function hasManagedBlockHeader(content: string, start: number): boolean {
  const afterStart = content.slice(start + OPENCLAW_REPOSITORY_CONTEXT_START.length);
  return (
    afterStart.startsWith(`\n${OPENCLAW_REPOSITORY_CONTEXT_HEADER}`)
    || afterStart.startsWith(`\r\n${OPENCLAW_REPOSITORY_CONTEXT_HEADER}`)
    || afterStart.startsWith(`\r${OPENCLAW_REPOSITORY_CONTEXT_HEADER}`)
  );
}

function findManagedBlockStart(content: string, from: number, before: number): number {
  let searchFrom = from;
  while (searchFrom < before) {
    const start = content.indexOf(OPENCLAW_REPOSITORY_CONTEXT_START, searchFrom);
    if (start === -1 || start >= before) return -1;
    if (hasManagedBlockHeader(content, start)) return start;
    searchFrom = start + OPENCLAW_REPOSITORY_CONTEXT_START.length;
  }
  return -1;
}

function escapeManagedSentinels(content: string): string {
  return content
    .split(OPENCLAW_REPOSITORY_CONTEXT_START).join('&lt;!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:BEGIN --&gt;')
    .split(OPENCLAW_REPOSITORY_CONTEXT_END).join('&lt;!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:END --&gt;');
}
