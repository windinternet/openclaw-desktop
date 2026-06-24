import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('chat configuration selects', () => {
  it('opens session detail and new-session configure selects upward near the viewport bottom', () => {
    const chat = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');
    const newSession = readFileSync('src/pages/NewSessionPage.tsx', 'utf8');

    for (const source of [chat, newSession]) {
      expect(source).toContain('configureSelectProps');
      expect(source).toContain('position: \'top\'');
      expect(source).toContain('{...configureSelectProps}');
    }
  });
});

describe('3D office layout', () => {
  it('lets the office tab fill the remaining collaboration page height', () => {
    const collaboration = readFileSync('src/pages/CollaborationPage.tsx', 'utf8');

    expect(collaboration).toContain('collaboration-page');
    expect(collaboration).toContain('collaboration-tabs');
    expect(collaboration).toContain('semi-tabs-pane-motion-overlay');
    expect(collaboration).toContain('office-tab-body');
    expect(collaboration).toContain('height: \'100%\'');
    expect(collaboration).toContain('<Office3DPage embedded />');
  });

  it('supports a viewport fullscreen mode from the 3D office controls', () => {
    const office = readFileSync('src/pages/Office3DPage.tsx', 'utf8');

    expect(office).toContain('office-page--fullscreen');
    expect(office).toContain('office-page--embedded');
    expect(office).toContain('setFullscreen');
    expect(office).toContain("t('office.fullscreen')");
    expect(office).toContain("t('office.exitFullscreen')");
    expect(office).toContain('IconMaximize');
    expect(office).toContain('IconMinimize');
  });
});
