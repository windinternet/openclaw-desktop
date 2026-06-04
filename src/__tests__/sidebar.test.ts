import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Sidebar session list', () => {
  it('renders a single trailing status indicator for each session row', () => {
    const source = readFileSync('src/components/Sidebar.tsx', 'utf8');

    // activity state indicators use sessionActivityStates map
    expect(source).toContain("sessionActivityStates");
    expect(source).toContain("actState === 'generating'");
    expect(source).toContain("clearSessionActivityState");
    expect(source).toContain('session-spinner');
  });

  it('emphasizes the active session title', () => {
    const source = readFileSync('src/components/Sidebar.tsx', 'utf8');

    expect(source).toContain("decodeSessionKeyParam(location.pathname.replace('/chat/', ''))");
    expect(source).toContain("padding: '0 8px'");
    expect(source).toContain('fontSize: 12');
    expect(source).toContain('fontWeight: isCurrent ? 700 : 400');
    expect(source).toContain("color: isCurrent ? 'var(--semi-color-primary)' : 'var(--semi-color-text-0)'");
  });

  it('anchors the user info popover bottom near the mouse', () => {
    const source = readFileSync('src/components/Sidebar.tsx', 'utf8');

    expect(source).toContain('const bottom = vh - mouseY + 10;');
    expect(source).toContain('bottom: Math.max(8, bottom)');
    expect(source).toContain('onMouseMove={movePopup}');
    expect(source).toContain('onMouseEnter={keepPopupOpen}');
    expect(source).not.toContain('const top = vh - gapFromBottom - 300;');
  });

  it('keeps the macOS top inset inside Sidebar so Nav owns the full sider height', () => {
    const sidebarSource = readFileSync('src/components/Sidebar.tsx', 'utf8');
    const mainPageSource = readFileSync('src/pages/MainPage.tsx', 'utf8');

    expect(sidebarSource).toContain('const SIDEBAR_MACOS_TOP_INSET = 30;');
    expect(sidebarSource).toContain('const SIDEBAR_LINUX_TOP_INSET = 12;');
    expect(sidebarSource).toContain('const sidebarTopInset = isMacOS ? SIDEBAR_MACOS_TOP_INSET : SIDEBAR_LINUX_TOP_INSET;');
    expect(sidebarSource).toContain("style={{ flex: 1, paddingTop: sidebarTopInset, boxSizing: 'border-box' }}");
    expect(sidebarSource).toContain("WebkitAppRegion: 'drag'");
    expect(mainPageSource).not.toContain('paddingTop: isMacOS ? 30 : 0');
    expect(mainPageSource).not.toContain("WebkitAppRegion: 'drag'");
  });

  it('renders per-instance runtime status and recent activity in the instance drawer', () => {
    const source = readFileSync('src/components/InstanceDrawer.tsx', 'utf8');

    expect(source).toContain('instanceRuntimes[inst.id]');
    expect(source).toContain('lastActivitySummary');
    expect(source).toContain('lastActivityAt');
    expect(source).toContain('hasPendingActivity');
  });

  it('keeps the instance drawer header below macOS window controls', () => {
    const source = readFileSync('src/components/InstanceDrawer.tsx', 'utf8');

    expect(source).toContain('const INSTANCE_DRAWER_MACOS_TOP_INSET = 30;');
    expect(source).toContain("window.electronAPI?.platform === 'darwin'");
    expect(source).toContain('const headerPaddingTop = isMacOS ? INSTANCE_DRAWER_MACOS_TOP_INSET + 16 : INSTANCE_DRAWER_LINUX_TOP_INSET + 16;');
    expect(source).toContain('padding: `${headerPaddingTop}px 20px 16px`');
  });
});
