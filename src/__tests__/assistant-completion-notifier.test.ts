import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAgentEventSessionKey,
  getCurrentChatSessionKey,
  isAssistantCompletionEvent,
  shouldNotifyAssistantCompletion,
} from '../lib/assistant-completion-notifier';
import { DEFAULT_ALERT_SOUND, alertSounds } from '../assets/sound/alert';

describe('assistant completion notifier', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the requested message pop sound as the default alert', () => {
    expect(DEFAULT_ALERT_SOUND).toBe('mixkit-message-pop-alert-2354.mp3');
    expect(alertSounds[DEFAULT_ALERT_SOUND].labelKey).toBe('settings.alertSounds.messagePop');
  });

  it('recognizes lifecycle completion events only', () => {
    expect(
      isAssistantCompletionEvent({
        type: 'event',
        event: 'agent',
        payload: { stream: 'lifecycle', phase: 'end', sessionKey: 's1' },
      }),
    ).toBe(true);

    expect(
      isAssistantCompletionEvent({
        type: 'event',
        event: 'agent',
        payload: { stream: 'lifecycle', phase: 'start', sessionKey: 's1' },
      }),
    ).toBe(false);

    expect(
      isAssistantCompletionEvent({
        type: 'event',
        event: 'agent',
        payload: { stream: 'assistant', data: { delta: 'hello' } },
      }),
    ).toBe(false);

    expect(
      isAssistantCompletionEvent({
        type: 'event',
        event: 'run.completed',
        payload: { sessionKey: 's1' },
      }),
    ).toBe(true);
  });

  it('reads session keys from gateway payload variants', () => {
    expect(
      getAgentEventSessionKey({
        type: 'event',
        event: 'agent',
        payload: { sessionKey: 'session-a' },
      }),
    ).toBe('session-a');

    expect(
      getAgentEventSessionKey({
        type: 'event',
        event: 'agent',
        payload: { session_key: 'session-b' },
      }),
    ).toBe('session-b');
  });

  it('suppresses the alert for the focused current chat session', () => {
    vi.stubGlobal('window', { location: { hash: '#/chat/session-a' } });
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      hasFocus: () => true,
    });

    expect(getCurrentChatSessionKey()).toBe('session-a');
    expect(shouldNotifyAssistantCompletion('session-a')).toBe(false);
    expect(shouldNotifyAssistantCompletion('session-b')).toBe(true);
  });

  it('alerts for the current chat session when the window is inactive', () => {
    vi.stubGlobal('window', { location: { hash: '#/chat/session-a' } });
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      hasFocus: () => false,
    });

    expect(shouldNotifyAssistantCompletion('session-a')).toBe(true);
  });
});
