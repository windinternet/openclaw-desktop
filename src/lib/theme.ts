import type { AppSettings, ThemeMode } from './settings-types';

const PRESET_COLORS: Record<string, string> = {
  blue: '#0066FF',
  purple: '#722ED1',
  cyan: '#00A870',
  orange: '#ED7B2F',
  pink: '#E91E63',
  indigo: '#2E4CFF',
};

function getColorValue(colorName: string): string {
  return PRESET_COLORS[colorName] ?? PRESET_COLORS.blue;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

export function getEffectiveThemeMode(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(settings: AppSettings): void {
  const effectiveMode = getEffectiveThemeMode(settings.themeMode);
  const body = document.body;

  if (effectiveMode === 'dark') {
    body.setAttribute('theme-mode', 'dark');
  } else {
    body.removeAttribute('theme-mode');
  }

  const baseColor = getColorValue(settings.themeColor);

  Object.entries({
    '--semi-color-primary': baseColor,
    '--semi-color-primary-hover': lighten(baseColor, 0.1),
    '--semi-color-primary-active': darken(baseColor, 0.1),
    '--semi-color-primary-disabled': lighten(baseColor, 0.4),
    '--semi-color-primary-light-default': lighten(baseColor, 0.9),
    '--semi-color-primary-light-hover': lighten(baseColor, 0.85),
    '--semi-color-primary-light-active': lighten(baseColor, 0.8),
  }).forEach(([name, value]) => {
    document.body.style.setProperty(name, value);
    document.documentElement.style.setProperty(name, value);
  });
}

export function setupThemeListener(getSettings: () => AppSettings): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = () => {
    const settings = getSettings();
    if (settings.themeMode === 'auto') {
      applyTheme(settings);
    }
  };

  mediaQuery.addEventListener('change', handler);

  return () => {
    mediaQuery.removeEventListener('change', handler);
  };
}
