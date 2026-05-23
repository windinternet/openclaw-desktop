import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme } from '../lib/theme';

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

  it('writes primary color variables to body so Semi components update immediately', () => {
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
    });

    expect(body.style.getPropertyValue('--semi-color-primary')).toBe('#722ED1');
    expect(body.style.getPropertyValue('--semi-color-primary-hover')).toBe('#8043d6');
    expect(body.getAttribute('theme-mode')).toBe('dark');
    expect(documentElement.style.getPropertyValue('--semi-color-primary')).toBe('#722ED1');
  });
});
