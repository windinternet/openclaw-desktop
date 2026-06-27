import { describe, expect, it } from 'vitest';
import { stripGeneratedSessionLabelSuffix } from '../lib/session-label';

describe('stripGeneratedSessionLabelSuffix', () => {
  it('hides the generated dashboard label suffix from session list display', () => {
    expect(stripGeneratedSessionLabelSuffix('整理发布计划 · a1b2', 'agent:main:dashboard:mzz9')).toBe('整理发布计划');
  });

  it('keeps the same text for non-dashboard sessions', () => {
    expect(stripGeneratedSessionLabelSuffix('日报 · a1b2', 'agent:main:feishu:direct:user')).toBe('日报 · a1b2');
  });

  it('keeps dashboard labels when the trailing segment is not the generated four-character suffix', () => {
    expect(stripGeneratedSessionLabelSuffix('排查 action-abc123', 'agent:main:dashboard:mzz9')).toBe(
      '排查 action-abc123',
    );
  });
});
