import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme } from '../lib/theme';
import { DEFAULT_HOME_VIEW_OPTIONS, DEFAULT_SETTINGS } from '../lib/settings-types';
import { NAV_GROUPS } from '../lib/navigation';

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
      ...DEFAULT_SETTINGS,
      initialized: false,
      themeMode: 'dark',
      themeColor: 'purple',
      locale: 'zh-CN',
    });

    expect(body.style.getPropertyValue('--semi-color-primary')).toBe('#722ED1');
    expect(body.style.getPropertyValue('--semi-color-primary-hover')).toBe('#8043d6');
    expect(body.style.getPropertyValue('--semi-color-primary-light-default')).toBe('rgba(114, 46, 209, 0.2)');
    expect(body.style.getPropertyValue('--semi-color-primary-light-hover')).toBe('rgba(114, 46, 209, 0.3)');
    expect(body.style.getPropertyValue('--semi-color-primary-light-active')).toBe('rgba(114, 46, 209, 0.4)');
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
      ...DEFAULT_SETTINGS,
      initialized: false,
      themeMode: 'light',
      themeColor: 'purple',
      locale: 'zh-CN',
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

  it('defaults to a simple session message display for non-technical users', () => {
    expect(DEFAULT_SETTINGS.sessionToolCallDisplay).toBe('compact');
    expect(DEFAULT_SETTINGS.sessionReasoningDisplay).toBe('visible');
    expect(DEFAULT_SETTINGS.assistantReplyGrouping).toBe('merged');
  });

  it('defaults sidebar navigation grouping to off', () => {
    expect(DEFAULT_SETTINGS.sidebarNavGrouped).toBe(false);
  });

  it('defaults the app home view to dashboard', () => {
    expect(DEFAULT_SETTINGS.defaultHomeView).toBe('dashboard');
  });

  it('limits selectable default home views to the left sidebar navigation menu', () => {
    const sidebarItems = NAV_GROUPS.flatMap((group) => group.items);

    expect(DEFAULT_HOME_VIEW_OPTIONS.map((option) => option.value)).toEqual(sidebarItems.map((item) => item.key));
    expect(DEFAULT_HOME_VIEW_OPTIONS.map((option) => option.route)).toEqual(sidebarItems.map((item) => item.route));
    expect(DEFAULT_HOME_VIEW_OPTIONS.map((option) => option.labelKey)).toEqual(sidebarItems.map((item) => item.labelKey));
  });
});
