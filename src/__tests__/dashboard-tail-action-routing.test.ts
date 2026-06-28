import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dashboard tail action routing', () => {
  it('makes target pages consume Dashboard tail action context from the URL', () => {
    const workbench = readFileSync('src/pages/WorkbenchPage.tsx', 'utf8');
    const workbenchPanel = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
    const artifacts = readFileSync('src/pages/ArtifactsPage.tsx', 'utf8');
    const knowledge = readFileSync('src/pages/KnowledgeBasePage.tsx', 'utf8');
    const knowledgePanel = readFileSync('src/components/KnowledgeRepositoryPanel.tsx', 'utf8');

    expect(workbench).toContain('parseDashboardTailActionRoute(location.search)');
    expect(workbench).toContain('getWorkbenchTailActionTab(tailActionContext)');
    expect(workbench).toContain("t('workbench.tailActionContextTitle')");
    expect(workbench).toContain('context.workItemPath');
    expect(workbench).toContain('tailActionContext={tailActionContext}');

    expect(workbenchPanel).toContain("tailActionContext?.kind === 'status'");
    expect(workbenchPanel).toContain('updateWorkbenchMatterStatusFromTailAction');
    expect(workbenchPanel).toContain('archiveCompletedWorkbenchMatter');
    expect(workbenchPanel).toContain("t('workbench.statusTailActionTitle')");
    expect(workbenchPanel).toContain("t('workbench.updateMatterStatus')");
    expect(workbenchPanel).toContain("t('workbench.archiveCompletedMatter')");
    expect(workbenchPanel).toContain("tailActionContext?.kind === 'review'");
    expect(workbenchPanel).toContain("t('workbench.reviewTailActionTitle')");
    expect(workbenchPanel).toContain("t('workbench.reviewTailActionWriteCommand')");
    expect(workbenchPanel).toContain('writeWorkbenchReviewDraft');
    expect(workbenchPanel).toContain('confirmWorkbenchReviewDraft');
    expect(workbenchPanel).toContain("t('workbench.createReviewDraft')");
    expect(workbenchPanel).toContain("t('workbench.reviewDraftCreated')");
    expect(workbenchPanel).toContain('workbench.confirmReviewDraft');
    expect(workbenchPanel).toContain('workbench.reviewDraftConfirmed');
    expect(workbenchPanel).toContain('workbench.confirmReviewSourceDraft');
    expect(workbenchPanel).toContain('workbench.reviewSourceDraftConfirmed');
    expect(workbenchPanel).toContain('desktop.artifacts.execution.review.write');
    expect(workbenchPanel).toContain('reviews/weekly/');
    expect(workbenchPanel).toContain('reviewTailActionCanConfirm');
    expect(workbenchPanel).toContain("reviewTailActionContext.id.includes(':tail-action:')");
    expect(workbenchPanel).toContain('reviewSourceExecutionCanConfirm');
    expect(workbenchPanel).toContain("reviewTailActionContext.id.startsWith('action-run-review:')");
    expect(workbenchPanel).toContain('reviewTailActionRunId');
    expect(workbenchPanel).toContain('action-run-review:');
    expect(workbenchPanel).toContain("t('workbench.reviewTailActionRunSource')");

    expect(artifacts).toContain('parseDashboardTailActionRoute(location.search)');
    expect(artifacts).toContain("tailActionContext?.kind === 'output'");
    expect(artifacts).toContain('workItemPath={artifactTailActionContext?.workItemPath}');

    expect(knowledge).toContain('parseDashboardTailActionRoute(location.search)');
    expect(knowledge).toContain('getKnowledgeTailActionTab(tailActionContext)');
    expect(knowledge).toContain("t('knowledge.tailActionContextTitle')");
    expect(knowledge).toContain('tailActionContext.workItemPath');
    expect(knowledge).toContain('tailActionContext={tailActionContext}');

    expect(knowledgePanel).toContain("tailActionContext?.kind === 'knowledge'");
    expect(knowledgePanel).toContain('buildKnowledgeTailActionRewriteInstruction');
    expect(knowledgePanel).toContain('confirmWorkbenchKnowledgeTailAction');
    expect(knowledgePanel).toContain("t('knowledge.startTailActionRewrite')");
    expect(knowledgePanel).toContain("t('knowledge.confirmTailAction')");
    expect(knowledgePanel).toContain('workItemPath: knowledgeTailActionContext.workItemPath');
    expect(knowledgePanel).toContain('tailActionId: knowledgeTailActionContext.id');
    expect(knowledgePanel).toContain('knowledgeTailActionCanConfirm');
    expect(knowledgePanel).toContain("knowledgeTailActionContext.id.includes(':tail-action:')");
    expect(knowledgePanel).toContain('knowledgeTailActionRunId');
    expect(knowledgePanel).toContain('action-run-knowledge:');
  });
});
