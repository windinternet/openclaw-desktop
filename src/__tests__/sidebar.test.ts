import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Sidebar session list', () => {
  it('renders a single trailing status indicator for each session row', () => {
    const source = readFileSync('src/components/Sidebar.tsx', 'utf8');

    expect(source).not.toMatch(/<span\s+style=\{\{\s*width:\s*6,\s*height:\s*6,[\s\S]*?backgroundColor:\s*statusColor/);
    expect(source).toContain("isActive ? (");
    expect(source).toContain('<Spin size="small" />');
    expect(source).toMatch(/width:\s*12,\s*height:\s*12,[\s\S]*?backgroundColor:\s*statusColor/);
  });

  it('emphasizes the active session title', () => {
    const source = readFileSync('src/components/Sidebar.tsx', 'utf8');

    expect(source).toContain("decodeSessionKeyParam(location.pathname.replace('/chat/', ''))");
    expect(source).toContain("padding: '0 0 0 8px'");
    expect(source).toContain('fontSize: isCurrent ? 14 : 13');
    expect(source).toContain('fontWeight: isCurrent ? 700 : 400');
    expect(source).toContain("color: isCurrent ? 'var(--semi-color-primary)' : 'var(--semi-color-text-0)'");
  });
});
