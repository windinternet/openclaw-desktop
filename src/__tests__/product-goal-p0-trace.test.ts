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
    expect(plans).toContain('Artifacts 页面已提供复用分类筛选');
    expect(roadmap).toContain('Artifacts 页面已提供复用分类筛选');
    expect(plans).toContain('outputs/assets/index.md');
    expect(roadmap).toContain('outputs/assets/index.md');
    expect(source).toContain('这些也是 P0 级别的内容');
    expect(source).toContain('截图追溯确认');
    expect(source).toContain('Artifacts 页面复用分类筛选');
    expect(source).toContain('Repository 可复用资产索引第一片');
    expect(source).toContain('可复用资产运行后复盘线索');
    expect(source).toContain('可复用资产运行后复盘写入入口');
    expect(source).toContain('事项尾动作复盘入口');
    expect(source).toContain('事项尾动作复盘草稿写入');
    expect(source).toContain('事项尾动作复盘确认联动');
    expect(source).toContain('事项状态尾动作处理入口');
    expect(source).toContain('事项成果尾动作保存后回写');
    expect(source).toContain('事项知识尾动作发起 ActionRun');
    expect(source).toContain('事项知识尾动作确认联动');
    expect(source).toContain('事项完成后显式归档');
    expect(source).toContain('Artifacts 发起前事项选择');
    expect(source).toContain('Artifacts 发起前即时创建事项');
    expect(source).toContain('Knowledge 发起前事项选择');
    expect(source).toContain('Teams 发起前事项选择');
    expect(source).toContain('Repository 语义映射发起前事项选择');
    expect(source).toContain('ActionRun 未归属原因协议');
    expect(source).toContain('ActionRun 补归属流程');
    expect(source).toContain('archiveCompletedWorkbenchMatter');
    expect(source).toContain('workItemUnassignedReason');
    expect(source).toContain('assignAiActionRunToWorkItem');
    expect(source).toContain('confirmWorkbenchKnowledgeTailAction');
    expect(plans).toContain('发起知识更新 ActionRun');
    expect(plans).toContain('显式确认该尾动作');
    expect(plans).toContain('归档完成事项');
    expect(plans).toContain('workItemRequired: true');
    expect(plans).toContain('已有无事项运行的补归属流程已接入 ActionCenter');
    expect(plans).toContain('Artifacts 普通魔法创建发起前事项选择');
    expect(plans).toContain('Artifacts 普通魔法创建发起前即时创建事项');
    expect(plans).toContain('Knowledge 普通自动改写发起前事项选择');
    expect(plans).toContain('Teams 自然语言编排发起前事项选择');
    expect(plans).toContain('Repository 语义映射发起前事项选择');
    expect(roadmap).toContain('Dashboard 知识类尾动作进入 Knowledge');
    expect(roadmap).toContain('确认已处理并完成尾动作');
    expect(roadmap).toContain('归档完成事项');
    expect(roadmap).toContain('workItemUnassignedReason');
    expect(roadmap).toContain('assignAiActionRunToWorkItem');
    expect(roadmap).toContain('Artifacts 普通“AI 魔法创建”入口');
    expect(roadmap).toContain('即时创建事项');
    expect(roadmap).toContain('Knowledge 普通“消化资料 / 自动改写 / 刷新索引日志”入口');
    expect(roadmap).toContain('Teams 页面自然语言编排和快速创建 Agent 入口');
    expect(roadmap).toContain('RepositoryGate 的知识库语义映射和工作台语义映射入口');
    expect(skillContent).toContain('Screenshot-confirmed P0 baseline');
    expect(skillContent).toContain('Do not demote these scopes to P1/P2');
    expect(skillContent).toContain('Knowledge tail actions can start a source-bound `knowledge_rewrite` ActionRun');
    expect(skillContent).toContain('check off only the matching source knowledge tail action');
    expect(skillContent).toContain('work/completed/*.md');
    expect(skillContent).toContain('workItemUnassignedReason: pending_work_item_assignment');
    expect(skillContent).toContain('ActionCenter can let the user choose an existing work item to backfill assignment');
    expect(skillContent).toContain('Standalone Artifacts AI creation can also list existing');
    expect(skillContent).toContain('can create a new `work/active` matter before starting `artifact_create`');
    expect(skillContent).toContain('Ordinary Knowledge rewrite entry points');
    expect(skillContent).toContain('Teams natural-language compose and quick Agent creation entry points');
    expect(skillContent).toContain('RepositoryGate semantic mapping entry points');
    expect(skillContent).toContain('Artifacts UI also exposes a reuse-kind filter');
    expect(skillContent).toContain('Repository `outputs/assets/index.md`');
    expect(skillContent).toContain('post-run review clues');
    expect(skillContent).toContain('desktop.artifacts.execution.review.write');
  });
});
