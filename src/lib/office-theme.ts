export type OfficeThemeMode = 'light' | 'dark';

export interface OfficeTheme {
  mode: OfficeThemeMode;
  pageBackground: string;
  scene: {
    background: string;
    fog: string;
    floor: string;
    wall: string;
    desk: string;
    screen: string;
    trim: string;
    face: string;
    floorGrid: string;
    zoneBorder: string;
    zoneOpacity: number;
    propShadow: string;
    labelBackground: string;
    labelText: string;
    accent: string;
    work: string;
    meeting: string;
    lounge: string;
  };
  panel: {
    background: string;
    border: string;
    shadow: string;
    text: string;
    muted: string;
    tertiary: string;
  };
}

export function createOfficeTheme(mode: OfficeThemeMode, accent: string): OfficeTheme {
  if (mode === 'light') {
    return {
      mode,
      pageBackground: `linear-gradient(135deg, #f6fbf8 0%, #eef7ff 48%, #fff8ed 100%)`,
      scene: {
        background: '#f7fbf9',
        fog: '#f7fbf9',
        floor: '#edf6f1',
        wall: '#cbd5e1',
        desk: '#b7c8d8',
        screen: '#2563eb',
        trim: '#ffffff',
        face: '#1f2937',
        floorGrid: '#b9c9c1',
        zoneBorder: '#6b7280',
        zoneOpacity: 0.38,
        propShadow: '#94a3b8',
        labelBackground: 'rgba(255, 255, 255, 0.86)',
        labelText: '#1f2937',
        accent,
        work: '#3b82f6',
        meeting: '#f59e0b',
        lounge: '#10b981',
      },
      panel: {
        background: 'rgba(255, 255, 255, 0.78)',
        border: 'rgba(15, 23, 42, 0.12)',
        shadow: '0 16px 50px rgba(15, 23, 42, 0.12)',
        text: '#111827',
        muted: '#475569',
        tertiary: '#64748b',
      },
    };
  }

  return {
    mode,
    pageBackground: `
      radial-gradient(circle at 20% 18%, rgba(34, 197, 94, 0.13), transparent 32%),
      radial-gradient(circle at 76% 20%, rgba(59, 130, 246, 0.18), transparent 34%),
      radial-gradient(circle at 52% 78%, rgba(245, 158, 11, 0.15), transparent 35%),
      #08111f
    `,
    scene: {
      background: '#08111f',
      fog: '#08111f',
      floor: '#0f172a',
      wall: '#475569',
      desk: '#1e3a5f',
      screen: '#38bdf8',
      trim: '#dbeafe',
      face: '#020617',
      floorGrid: '#334155',
      zoneBorder: '#94a3b8',
      zoneOpacity: 0.34,
      propShadow: '#020617',
      labelBackground: 'rgba(15, 23, 42, 0.78)',
      labelText: '#e5e7eb',
      accent,
      work: '#1d4ed8',
      meeting: '#d97706',
      lounge: '#16a34a',
    },
    panel: {
      background: 'rgba(15, 23, 42, 0.78)',
      border: 'rgba(148, 163, 184, 0.28)',
      shadow: '0 16px 50px rgba(0, 0, 0, 0.28)',
      text: '#f8fafc',
      muted: '#cbd5e1',
      tertiary: '#94a3b8',
    },
  };
}
