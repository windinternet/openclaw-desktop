import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAgentEventSessionKey,
  getAssistantCompletionSummary,
  getCurrentChatSessionKey,
  isAssistantCompletionEvent,
  notifyAssistantCompletion,
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

  it('builds a reusable activity summary from the matching session title', () => {
    expect(
      getAssistantCompletionSummary(
        {
          type: 'event',
          event: 'run.completed',
          payload: { sessionKey: 'session-a' },
        },
        [{ key: 'session-a', title: '部署检查' }],
      ),
    ).toBe('会话「部署检查」已完成');
  });

  it('includes the instance name in system notifications', async () => {
    const show = vi.fn(async () => true);
    vi.stubGlobal(
      'Audio',
      class {
        play() {
          return Promise.resolve();
        }
      },
    );
    vi.stubGlobal('window', {
      location: { hash: '#/dashboard' },
      electronAPI: { notifications: { show } },
    });
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      hasFocus: () => false,
    });

    notifyAssistantCompletion(
      {
        type: 'event',
        event: 'run.completed',
        payload: { sessionKey: 'session-a', runId: 'notification-instance-name' },
      },
      [{ key: 'session-a', title: '部署检查' }],
      'Instance A',
    );

    await vi.waitFor(() => {
      expect(show).toHaveBeenCalledWith({
        title: 'OpenClaw · Instance A',
        body: '会话「部署检查」的 AI 回复已完成',
      });
    });
  });
});
