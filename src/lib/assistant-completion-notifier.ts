import { DEFAULT_ALERT_SOUND, playAlertSound } from '../assets/sound/alert';
import type { EventFrame, SessionInfo } from './types';
import { decodeSessionKeyParam } from './session-content';
import { useSettingsStore } from './settings-store';

const COMPLETION_PHASES = new Set(['end', 'done', 'complete', 'completed', 'success']);
const notifiedEventKeys = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getAgentEventSessionKey(frame: EventFrame): string | undefined {
  if (!isRecord(frame.payload)) return undefined;
  const raw = frame.payload.sessionKey ?? frame.payload.session_key;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}

function getAgentEventRunId(frame: EventFrame): string | undefined {
  if (!isRecord(frame.payload)) return undefined;
  const raw = frame.payload.runId ?? frame.payload.run_id;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}

export function isAssistantCompletionEvent(frame: EventFrame): boolean {
  if (frame.event === 'run.completed') return true;
  if (frame.event !== 'agent' || !isRecord(frame.payload)) return false;
  const stream = frame.payload.stream ?? frame.payload.state;
  if (stream !== 'lifecycle') return false;

  const data = isRecord(frame.payload.data) ? frame.payload.data : undefined;
  const phase = frame.payload.phase ?? data?.phase ?? frame.payload.state;
  return typeof phase === 'string' && COMPLETION_PHASES.has(phase);
}

export function getCurrentChatSessionKey(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const hashPath = window.location.hash.replace(/^#/, '');
  const match = hashPath.match(/^\/chat\/(.+)$/);
  return decodeSessionKeyParam(match?.[1]);
}

export function isCurrentWindowActive(): boolean {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible' && document.hasFocus();
}

export function shouldNotifyAssistantCompletion(sessionKey?: string): boolean {
  if (!isCurrentWindowActive()) return true;
  if (!sessionKey) return false;
  return getCurrentChatSessionKey() !== sessionKey;
}

function findSessionTitle(sessions: SessionInfo[], sessionKey?: string): string | undefined {
  if (!sessionKey) return undefined;
  const session = sessions.find((item) => item.key === sessionKey || item.sessionKey === sessionKey);
  return session?.title?.trim() || session?.key;
}

async function showSystemNotification(title: string, body: string): Promise<void> {
  if (typeof window !== 'undefined' && 'electronAPI' in window && window.electronAPI.notifications) {
    await window.electronAPI.notifications.show({ title, body });
    return;
  }

  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (Notification.permission === 'granted') {
    new Notification(title, { body, silent: true });
  }
}

export function notifyAssistantCompletion(frame: EventFrame, sessions: SessionInfo[]): void {
  if (!isAssistantCompletionEvent(frame)) return;

  const sessionKey = getAgentEventSessionKey(frame);
  if (!shouldNotifyAssistantCompletion(sessionKey)) return;

  const runId = getAgentEventRunId(frame);
  const eventKey = runId ?? `${sessionKey ?? 'unknown'}:${frame.seq ?? 'completion'}`;
  if (notifiedEventKeys.has(eventKey)) return;
  notifiedEventKeys.add(eventKey);
  if (notifiedEventKeys.size > 100) notifiedEventKeys.clear();

  const settings = useSettingsStore.getState().settings;
  const soundId = settings.aiCompletionSound || DEFAULT_ALERT_SOUND;
  const sessionTitle = findSessionTitle(sessions, sessionKey);
  const body = sessionTitle ? `会话「${sessionTitle}」的 AI 回复已完成` : 'AI 回复已完成';

  playAlertSound(soundId);
  showSystemNotification('OpenClaw', body).catch(() => {});
}
