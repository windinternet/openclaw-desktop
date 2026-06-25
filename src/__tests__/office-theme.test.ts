import { describe, expect, it } from 'vitest';
import { createOfficeTheme } from '../lib/office-theme';

function hexDistance(a: string, b: string): number {
  const parts = [a, b].map((hex) => {
    const clean = hex.replace('#', '');
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  });

  return Math.hypot(
    parts[0][0] - parts[1][0],
    parts[0][1] - parts[1][1],
    parts[0][2] - parts[1][2],
  );
}

describe('office theme', () => {
  it('uses a light office palette for light app theme', () => {
    const theme = createOfficeTheme('light', '#00A870');

    expect(theme.mode).toBe('light');
    expect(theme.pageBackground).toContain('#f7eee9');
    expect(theme.scene.background).toBe('#f7fbf9');
    expect(theme.scene.floor).toBe('#e7eef0');
    expect(theme.scene.wall).toBe('#f1d8cf');
    expect(theme.panel.background).toContain('255, 255, 255');
    expect(theme.scene.accent).toBe('#00A870');
    expect(theme.scene.zoneOpacity).toBeLessThan(0.24);
    expect(theme.scene.zoneBorder).toBe('#ff765f');
    expect(theme.scene.labelBackground).toContain('255, 255, 255');
  });

  it('uses a dark office palette for dark app theme', () => {
    const theme = createOfficeTheme('dark', '#722ED1');

    expect(theme.mode).toBe('dark');
    expect(theme.pageBackground).toContain('#08111f');
    expect(theme.scene.background).toBe('#08111f');
    expect(theme.scene.floor).toBe('#151c26');
    expect(theme.scene.wall).toBe('#3d2b29');
    expect(theme.panel.background).toContain('15, 23, 42');
    expect(theme.scene.accent).toBe('#722ED1');
    expect(theme.scene.zoneOpacity).toBeGreaterThan(0.3);
    expect(theme.scene.zoneBorder).toBe('#ff765f');
    expect(theme.scene.labelBackground).toContain('15, 23, 42');
  });

  it('keeps office zone colors visually separated in both themes', () => {
    const themes = [
      createOfficeTheme('light', '#00A870'),
      createOfficeTheme('dark', '#722ED1'),
    ];

    themes.forEach((theme) => {
      expect(hexDistance(theme.scene.work, theme.scene.meeting)).toBeGreaterThan(120);
      expect(hexDistance(theme.scene.work, theme.scene.lounge)).toBeGreaterThan(120);
      expect(hexDistance(theme.scene.meeting, theme.scene.lounge)).toBeGreaterThan(120);
      expect(hexDistance(theme.scene.floor, theme.scene.desk)).toBeGreaterThan(36);
      expect(hexDistance(theme.scene.floor, theme.scene.wall)).toBeGreaterThan(24);
    });
  });
});
