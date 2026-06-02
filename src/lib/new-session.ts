import { extractSessionMessageText } from './session-content';

export interface NewSessionCreateParams {
  request: {
    agentId: string;
    key: string;
    model?: string;
    label?: string;
  };
  agentId: string;
  key: string;
  peerKey: string;
  title?: string;
}

export interface NewSessionInitialMessage {
  content: unknown;
  model?: string;
  thinking?: string;
}

export interface NewSessionNavigationTarget {
  to: string;
  state?: {
    initialMessage: NewSessionInitialMessage;
  };
}

function generateDashboardPeerKey(): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  return `dashboard:${id}`;
}

export function buildDashboardSessionKey(agentId: string, peerKey: string): string {
  return `agent:${agentId}:${peerKey}`;
}

export function buildNewSessionCreateParams(options: {
  agentId: string;
  model?: string;
  thinking?: string;
  content?: unknown;
}): NewSessionCreateParams {
  const peerKey = generateDashboardPeerKey();
  const sessionKey = buildDashboardSessionKey(options.agentId, peerKey);
  const title = extractSessionMessageText(options.content).trim();

  return {
    request: {
      agentId: options.agentId,
      key: sessionKey,
      model: options.model,
      label: title || undefined,
    },
    agentId: options.agentId,
    key: sessionKey,
    peerKey,
    title: title || undefined,
  };
}

export function resolveCreatedSessionKey(
  response: { key?: string; sessionKey?: string } | null | undefined,
  fallbackKey: string,
): string {
  return response?.key || response?.sessionKey || fallbackKey;
}

export function getChatRoute(sessionKey: string): string {
  return `/chat/${encodeURIComponent(sessionKey)}`;
}

export function buildNewSessionNavigationTarget(options: {
  sessionKey: string;
  content: unknown;
  model?: string;
  thinking?: string;
}): NewSessionNavigationTarget {
  const message = extractSessionMessageText(options.content).trim();
  if (!message) return { to: getChatRoute(options.sessionKey) };

  return {
    to: getChatRoute(options.sessionKey),
    state: {
      initialMessage: {
        content: options.content,
        model: options.model,
        thinking: options.thinking,
      },
    },
  };
}
