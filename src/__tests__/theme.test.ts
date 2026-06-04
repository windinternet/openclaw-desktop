import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme } from '../lib/theme';
import { DEFAULT_SETTINGS } from '../lib/settings-types';

function createStyleDeclaration() {
  const values = new Map<string, string>();
  return {
    setProperty(name: string, value: string) {
      values.set(name, value);
    },
    getPropertyValue(name: string) {
      return values.get(name) ?? '';
    },
  };
}

function createElement() {
  const attributes = new Map<string, string>();
  return {
    style: createStyleDeclaration(),
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    removeAttribute(name: string) {
      attributes.delete(name);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
  };
}

describe('applyTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses translucent primary light colors for dark mode', () => {
    const body = createElement();
    const documentElement = createElement();

    vi.stubGlobal('document', {
      body,
      documentElement,
    });

    applyTheme({
      initialized: false,
      themeMode: 'dark',
      themeColor: 'purple',
      locale: 'zh-CN',
      userDisplayName: '',
      aiCompletionSound: 'mixkit-message-pop-alert-2354.mp3',
      connectAllInstancesOnStartup: false,
      externalLinkMode: 'system',
      agentSwitchStrategy: 'new-session',
    });

    expect(body.style.getPropertyValue('--semi-color-primary')).toBe('#722ED1');
    expect(body.style.getPropertyValue('--semi-color-primary-hover')).toBe('#8043d6');
    expect(body.style.getPropertyValue('--semi-color-primary-light-default')).toBe(
      'rgba(114, 46, 209, 0.2)',
    );
    expect(body.style.getPropertyValue('--semi-color-primary-light-hover')).toBe(
      'rgba(114, 46, 209, 0.3)',
    );
    expect(body.style.getPropertyValue('--semi-color-primary-light-active')).toBe(
      'rgba(114, 46, 209, 0.4)',
    );
    expect(body.getAttribute('theme-mode')).toBe('dark');
    expect(documentElement.style.getPropertyValue('--semi-color-primary')).toBe('#722ED1');
  });

  it('keeps opaque primary light colors for light mode', () => {
    const body = createElement();
    const documentElement = createElement();

    vi.stubGlobal('document', {
      body,
      documentElement,
    });

    applyTheme({
      initialized: false,
      themeMode: 'light',
      themeColor: 'purple',
      locale: 'zh-CN',
      userDisplayName: '',
      aiCompletionSound: 'mixkit-message-pop-alert-2354.mp3',
      connectAllInstancesOnStartup: false,
      externalLinkMode: 'system',
      agentSwitchStrategy: 'new-session',
    });

    expect(body.style.getPropertyValue('--semi-color-primary-light-default')).toBe('#f1eafa');
    expect(body.style.getPropertyValue('--semi-color-primary-light-hover')).toBe('#eae0f8');
    expect(body.style.getPropertyValue('--semi-color-primary-light-active')).toBe('#e3d5f6');
    expect(body.getAttribute('theme-mode')).toBeNull();
  });

  it('defaults to connecting only the current instance on startup', () => {
    expect(DEFAULT_SETTINGS.connectAllInstancesOnStartup).toBe(false);
  });

  it('defaults to creating a new visible session when switching agents', () => {
    expect(DEFAULT_SETTINGS.agentSwitchStrategy).toBe('new-session');
  });
});
