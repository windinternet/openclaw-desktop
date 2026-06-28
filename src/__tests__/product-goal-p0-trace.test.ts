import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDesktopSelfKnowledgeSkillContent } from '../lib/desktop-self-knowledge';

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('product goal P0 traceability', () => {
  it('keeps screenshot-confirmed P0 scope visible in planning docs and Desktop self-knowledge', () => {
    const plans = readText('docs/PLANS.md');
    const roadmap = readText('docs/design-docs/product-goal-roadmap.md');
    const source = readText('docs/references/product-goal-conversation-2026-06-28.md');
    const skillContent = buildDesktopSelfKnowledgeSkillContent();

    const p0Scopes = [
      '开箱体验与工作系统金线',
      'Dashboard 真实推进状态',
      'Knowledge 导入/消化/健康检查',
      '事务推进闭环',
      '开始一件事闭环',
      '可复用资产一等对象',
    ];

    for (const scope of p0Scopes) {
      expect(plans).toContain(scope);
      expect(roadmap).toContain(scope);
    }

    expect(plans).toContain('截图追溯 P0 基线');
    expect(plans).toContain('不得在后续推进中降级为 P1/P2');
    expect(roadmap).toContain('不得判定 P0 已整体完成');
    expect(source).toContain('这些也是 P0 级别的内容');
    expect(source).toContain('截图追溯确认');
    expect(skillContent).toContain('Screenshot-confirmed P0 baseline');
    expect(skillContent).toContain('Do not demote these scopes to P1/P2');
  });
});
