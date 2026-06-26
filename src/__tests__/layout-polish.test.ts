import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('chat configuration selects', () => {
  it('opens session detail and new-session configure selects upward near the viewport bottom', () => {
    const chat = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');
    const newSession = readFileSync('src/components/NewSessionComposer.tsx', 'utf8');

    for (const source of [chat, newSession]) {
      expect(source).toContain('configureSelectProps');
      expect(source).toContain('position: \'top\'');
      expect(source).toContain('{...configureSelectProps}');
    }
  });

  it('moves the session dashboard control into a detail page header', () => {
    const chat = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');

    expect(chat).toContain('function SessionHeader');
    expect(chat).toContain('session-detail-header');
    expect(chat).toContain('session-detail-context-progress');
    expect(chat).toContain('onOpenDashboard');
    expect(chat).toContain('chat.header');
    expect(chat).not.toContain("position: 'absolute',\n            right: 12,\n            top: 42");
  });

  it('supports a clearer session detail entry and pinned detail panel mode', () => {
    const chat = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');

    expect(chat).toContain('IconIndentLeft');
    expect(chat).toContain('IconIndentRight');
    expect(chat).toContain('function PinIcon');
    expect(chat).toContain('theme="borderless"');
    expect(chat).not.toContain("theme={dashboardOpen ? 'solid' : 'light'}");
    expect(chat).not.toContain("theme={pinned ? 'solid' : 'borderless'}");
    expect(chat).toContain('session-detail-pinned-panel');
    expect(chat).toContain('sidePanelPinned');
    expect(chat).toContain('onTogglePinned');
    expect(chat).toContain('chat.pinDashboard');
    expect(chat).toContain('chat.unpinDashboard');
    expect(chat).toContain('chat.expandSessionDetails');
  });

  it('restores 14px session list labels and supports resizing the left sidebar', () => {
    const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
    const main = readFileSync('src/pages/MainPage.tsx', 'utf8');
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(sidebar).toContain('className="sidebar-session-title"');
    expect(sidebar).toContain('fontSize: 14');
    expect(main).toContain('SIDEBAR_DEFAULT_WIDTH = 300');
    expect(main).toContain('sidebarWidth');
    expect(main).toContain('handleSidebarResizeStart');
    expect(main).toContain('className="sidebar-resize-handle"');
    expect(css).toContain('.sidebar-resize-handle');
    expect(css).toContain('cursor: col-resize;');
  });

  it('provides global cursor fallbacks for Electron interactive regions', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(css).toContain('/* ── Electron Cursor Fallbacks');
    expect(css).toContain(':where(button, a[href], [role="button"], .semi-button, .semi-navigation-item, .semi-select, .semi-tabs-tab, .semi-checkbox, .semi-radio, .semi-switch, .semi-upload-add)');
    expect(css).toContain(':where(button, a[href], [role="button"], .semi-button, .semi-navigation-item, .semi-select, .semi-tabs-tab, .semi-checkbox, .semi-radio, .semi-switch, .semi-upload-add) *');
    expect(css).toContain(':where(input, textarea, select, [contenteditable="true"], .ProseMirror, .semi-input, .semi-input-textarea, .semi-aiChatInput-editor-content) *');
    expect(css).toContain('-webkit-app-region: no-drag;');
    expect(css).toContain('cursor: pointer !important;');
    expect(css).toContain(':where(input, textarea, [contenteditable="true"], .ProseMirror, .semi-input, .semi-input-textarea, .semi-aiChatInput-editor-content)');
    expect(css).toContain('cursor: text !important;');
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
