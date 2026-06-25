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
      pageBackground: `linear-gradient(135deg, #f7eee9 0%, #edf8fb 46%, #f7fbf4 100%)`,
      scene: {
        background: '#f7fbf9',
        fog: '#f7fbf9',
        floor: '#e7eef0',
        wall: '#f1d8cf',
        desk: '#d39a87',
        screen: '#0891b2',
        trim: '#fff1e8',
        face: '#1f2937',
        floorGrid: '#c2d0d2',
        zoneBorder: '#ff765f',
        zoneOpacity: 0.18,
        propShadow: '#8b5e55',
        labelBackground: 'rgba(255, 255, 255, 0.9)',
        labelText: '#1f2937',
        accent,
        work: '#38bdf8',
        meeting: '#fb923c',
        lounge: '#22c55e',
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
      radial-gradient(circle at 18% 16%, rgba(248, 113, 113, 0.16), transparent 31%),
      radial-gradient(circle at 76% 20%, rgba(34, 211, 238, 0.18), transparent 34%),
      radial-gradient(circle at 52% 78%, rgba(251, 146, 60, 0.13), transparent 35%),
      #08111f
    `,
    scene: {
      background: '#08111f',
      fog: '#08111f',
      floor: '#151c26',
      wall: '#3d2b29',
      desk: '#8a6257',
      screen: '#22d3ee',
      trim: '#ffe4d6',
      face: '#111827',
      floorGrid: '#283443',
      zoneBorder: '#ff765f',
      zoneOpacity: 0.34,
      propShadow: '#020617',
      labelBackground: 'rgba(15, 23, 42, 0.78)',
      labelText: '#e5e7eb',
      accent,
      work: '#38bdf8',
      meeting: '#f97316',
      lounge: '#22c55e',
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
