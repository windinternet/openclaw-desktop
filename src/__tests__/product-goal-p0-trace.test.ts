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
    expect(source).toContain('Knowledge/Teams/RepositoryGate 发起前即时创建事项');
    expect(source).toContain('ActionRun 发起前事项面板组件化');
    expect(source).toContain('ActionRunWorkItemPicker');
    expect(source).toContain('工作事项发起计划 ActionRun');
    expect(source).toContain('事项计划审批写入与互链');
    expect(source).toContain('活跃计划发起执行 ActionRun');
    expect(source).toContain('work_matter_plan');
    expect(source).toContain('plan_execute');
    expect(source).toContain('applyWorkbenchMatterPlanApproval');
    expect(source).toContain('buildPlanExecutePrompt');
    expect(source).toContain('计划执行状态观测');
    expect(source).toContain('findLatestPlanExecutionRun');
    expect(source).toContain('计划执行成果沉淀入口');
    expect(source).toContain('ActionRun 成果沉淀后的 Dashboard 去重');
    expect(source).toContain('shouldOfferPlanExecutionOutputPreservation');
    expect(source).toContain('action-run-output:<runId>');
    expect(source).toContain('artifact.source.type === "action_run"');
    expect(source).toContain('计划执行知识更新入口');
    expect(source).toContain('shouldOfferPlanExecutionKnowledgeUpdate');
    expect(source).toContain('action-run-knowledge:<runId>');
    expect(source).toContain('计划执行复盘草稿入口');
    expect(source).toContain('复盘草稿链接回来源事项');
    expect(source).toContain('计划执行知识/复盘后续入口去重');
    expect(source).toContain('计划执行复盘草稿带入相关知识更新');
    expect(source).toContain('shouldOfferPlanExecutionReview');
    expect(source).toContain('action-run-review:<runId>');
    expect(source).toContain('relatedKnowledgeRunIds');
    expect(source).toContain('未失败/未取消的 `knowledge_rewrite`');
    expect(source).toContain('来源事项 `## 复盘`');
    expect(source).toContain('repositoryWrite');
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
    expect(plans).toContain('Knowledge/Teams/RepositoryGate 发起前即时创建事项');
    expect(plans).toContain('ActionRun 发起前事项面板组件化');
    expect(plans).toContain('ActionRunWorkItemPicker');
    expect(plans).toContain('工作事项发起计划 ActionRun');
    expect(plans).toContain('事项计划审批写入与互链');
    expect(plans).toContain('活跃计划发起执行 ActionRun');
    expect(plans).toContain('work_matter_plan');
    expect(plans).toContain('plan_execute');
    expect(plans).toContain('applyWorkbenchMatterPlanApproval');
    expect(plans).toContain('buildPlanExecutePrompt');
    expect(plans).toContain('计划执行状态观测');
    expect(plans).toContain('findLatestPlanExecutionRun');
    expect(plans).toContain('计划执行成果沉淀入口');
    expect(plans).toContain('shouldOfferPlanExecutionOutputPreservation');
    expect(plans).toContain('action-run-output:<runId>');
    expect(plans).toContain('source.type=action_run');
    expect(plans).toContain('计划执行知识更新入口');
    expect(plans).toContain('shouldOfferPlanExecutionKnowledgeUpdate');
    expect(plans).toContain('action-run-knowledge:<runId>');
    expect(plans).toContain('计划执行复盘草稿入口');
    expect(plans).toContain('把草稿链接回来源事项 `## 复盘`');
    expect(plans).toContain('计划执行知识/复盘后续入口状态刷新');
    expect(plans).toContain('计划执行复盘草稿带入相关知识更新');
    expect(plans).toContain('shouldOfferPlanExecutionReview');
    expect(plans).toContain('action-run-review:<runId>');
    expect(plans).toContain('relatedKnowledgeRunIds');
    expect(plans).toContain('repositoryWrite.path/content/workItemPath');
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
    expect(roadmap).toContain('Knowledge、Teams、RepositoryGate');
    expect(roadmap).toContain('Knowledge 普通“消化资料 / 自动改写 / 刷新索引日志”入口');
    expect(roadmap).toContain('Teams 页面自然语言编排和快速创建 Agent 入口');
    expect(roadmap).toContain('RepositoryGate 的知识库语义映射和工作台语义映射入口');
    expect(roadmap).toContain('ActionRunWorkItemPicker');
    expect(roadmap).toContain('work_matter_plan');
    expect(roadmap).toContain('plan_execute');
    expect(roadmap).toContain('buildWorkMatterPlanPrompt');
    expect(roadmap).toContain('buildPlanExecutePrompt');
    expect(roadmap).toContain('计划执行状态观测');
    expect(roadmap).toContain('findLatestPlanExecutionRun');
    expect(roadmap).toContain('计划执行成果沉淀入口');
    expect(roadmap).toContain('shouldOfferPlanExecutionOutputPreservation');
    expect(roadmap).toContain('action-run-output:<runId>');
    expect(roadmap).toContain('source.type=action_run');
    expect(roadmap).toContain('计划执行知识更新入口');
    expect(roadmap).toContain('shouldOfferPlanExecutionKnowledgeUpdate');
    expect(roadmap).toContain('action-run-knowledge:<runId>');
    expect(roadmap).toContain('计划执行复盘草稿入口');
    expect(roadmap).toContain('草稿相对链接写回来源事项的 `## 复盘`');
    expect(roadmap).toContain('sourceExecutionId` 或 `tailActionId` 为 `action-run-review:<runId>`');
    expect(roadmap).toContain('relatedKnowledgeRunIds');
    expect(roadmap).toContain('shouldOfferPlanExecutionReview');
    expect(roadmap).toContain('action-run-review:<runId>');
    expect(roadmap).toContain('applyWorkbenchMatterPlanApproval');
    expect(roadmap).toContain('repositoryWrite.path/content/workItemPath');
    expect(skillContent).toContain('Screenshot-confirmed P0 baseline');
    expect(skillContent).toContain('Do not demote these scopes to P1/P2');
    expect(skillContent).toContain('Knowledge tail actions can start a source-bound `knowledge_rewrite` ActionRun');
    expect(skillContent).toContain('check off only the matching source knowledge tail action');
    expect(skillContent).toContain('work/completed/*.md');
    expect(skillContent).toContain('workItemUnassignedReason: pending_work_item_assignment');
    expect(skillContent).toContain('ActionCenter can let the user choose an existing work item to backfill assignment');
    expect(skillContent).toContain('Standalone Artifacts AI creation can also list existing');
    expect(skillContent).toContain('can create a new `work/active` matter before starting `artifact_create`');
    expect(skillContent).toContain(
      'Knowledge, Teams, and RepositoryGate entry points can also create a new `work/active` matter',
    );
    expect(skillContent).toContain('Ordinary Knowledge rewrite entry points');
    expect(skillContent).toContain('Teams natural-language compose and quick Agent creation entry points');
    expect(skillContent).toContain('RepositoryGate semantic mapping entry points');
    expect(skillContent).toContain('ActionRunWorkItemPicker');
    expect(skillContent).toContain('shared pre-run matter picker');
    expect(skillContent).toContain('work_matter_plan');
    expect(skillContent).toContain('plan_execute');
    expect(skillContent).toContain('buildWorkMatterPlanPrompt');
    expect(skillContent).toContain('buildPlanExecutePrompt');
    expect(skillContent).toContain('findLatestPlanExecutionRun');
    expect(skillContent).toContain('latest plan execution status');
    expect(skillContent).toContain('shouldOfferPlanExecutionOutputPreservation');
    expect(skillContent).toContain('`action-run-output:<runId>`');
    expect(skillContent).toContain('Preserve Output');
    expect(skillContent).toContain('source.type=action_run');
    expect(skillContent).toContain('shouldOfferPlanExecutionKnowledgeUpdate');
    expect(skillContent).toContain('`action-run-knowledge:<runId>`');
    expect(skillContent).toContain('Update Knowledge');
    expect(skillContent).toContain('shouldOfferPlanExecutionReview');
    expect(skillContent).toContain('`action-run-review:<runId>`');
    expect(skillContent).toContain('Write Review');
    expect(skillContent).toContain('links the draft back to the source matter `## 复盘`');
    expect(skillContent).toContain('non-failed, non-cancelled `knowledge_rewrite`');
    expect(skillContent).toContain('sourceExecutionId` or `tailActionId` equal to `action-run-review:<runId>`');
    expect(skillContent).toContain('relatedKnowledgeRunIds');
    expect(skillContent).toContain('applyWorkbenchMatterPlanApproval');
    expect(skillContent).toContain('repositoryWrite.path/content/workItemPath');
    expect(skillContent).toContain('Artifacts UI also exposes a reuse-kind filter');
    expect(skillContent).toContain('Repository `outputs/assets/index.md`');
    expect(skillContent).toContain('post-run review clues');
    expect(skillContent).toContain('desktop.artifacts.execution.review.write');
  });
});
