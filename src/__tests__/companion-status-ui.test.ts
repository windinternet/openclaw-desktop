import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('companion status UI', () => {
  it('offers a fallback install session action when companion is missing', () => {
    const source = readFileSync('src/pages/MainPage.tsx', 'utf8');

    expect(source).toContain('createDesktopCompanionInstallSessionForInstance');
    expect(source).toContain('创建安装会话');
  });

  it('renders a main-page authorization modal for Desktop node approval', () => {
    const source = readFileSync('src/pages/MainPage.tsx', 'utf8');

    expect(source).toContain('companionApprovalRequest');
    expect(source).toContain('approveDesktopCompanionForInstance');
    expect(source).toContain('授权并重连');
  });

  it('renders per-instance companion status and manual recheck in the instance drawer', () => {
    const source = readFileSync('src/components/InstanceDrawer.tsx', 'utf8');

    expect(source).toContain('companionInfo');
    expect(source).toContain('detectDesktopCompanionForInstance');
    expect(source).toContain('Companion');
  });
});
